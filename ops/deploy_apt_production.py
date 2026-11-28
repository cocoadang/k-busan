"""Verify a tagged Apt revision before promoting it, and verify production afterward."""

import json
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from official_egress import validate_official_egress

SERVICE = os.environ.get("CLOUD_RUN_SERVICE")
PROJECT = os.environ.get("GCP_PROJECT_ID")
REGION = os.environ.get("DEPLOY_REGION")
PRODUCTION = "https://apt.dsoom.com"
TRANSIENT_HTTP = {408, 429, 500, 502, 503, 504}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def cloud(*args, capture=False):
    return subprocess.run(
        ["gcloud", "run", *args, "--project", PROJECT, "--region", REGION, "--quiet"],
        check=True, text=True, stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
    ).stdout


def describe():
    return json.loads(cloud("services", "describe", SERVICE, "--format=json", capture=True))


def live_revision(service):
    targets = [item for item in service["status"]["traffic"] if item.get("percent", 0)]
    require(len(targets) == 1 and targets[0]["percent"] == 100,
            "Expected one revision serving all Apt production traffic")
    return targets[0]["revisionName"]


def check_main():
    head = subprocess.check_output(
        ["gh", "api", "repos/cocoadang/k-busan/git/ref/heads/main", "--jq", ".object.sha"],
        text=True,
    ).strip()
    require(head == os.environ["GITHUB_SHA"], "A newer main commit is ready for deployment")


def create_candidate(service, previous, candidate):
    import yaml

    export = yaml.safe_load(cloud("services", "describe", SERVICE, "--format=export", capture=True))
    active = json.loads(cloud("revisions", "describe", previous, "--format=json", capture=True))
    annotations = active["metadata"].get("annotations", {})
    validate_official_egress(annotations, REGION)
    runtime_annotations = {
        key: value for key, value in annotations.items()
        if key.startswith(("autoscaling.knative.dev/", "run.googleapis.com/vpc-", "run.googleapis.com/network-"))
        or key in {
            "run.googleapis.com/secrets", "run.googleapis.com/execution-environment",
            "run.googleapis.com/cpu-throttling", "run.googleapis.com/startup-cpu-boost",
            "run.googleapis.com/sessionAffinity", "run.googleapis.com/encryption-key",
        }
    }
    spec = active["spec"]
    runtime_class = spec.pop("runtimeClassName", None)
    require(runtime_class in (None, "run.googleapis.com/linux-base-image-update"),
            "Unexpected Apt runtime class")
    containers = spec["containers"]
    require(len(containers) == 1, "Expected a single Apt container")
    containers[0]["image"] = os.environ["IMAGE"]
    env = containers[0].setdefault("env", [])
    collection_flags = {"IMPORT_FLOOR_PLANS_ON_START", "IMPORT_FLOOR_PLANS_ON_POLL"}
    env[:] = [item for item in env if item["name"] not in collection_flags]
    env.extend({"name": name, "value": "false"} for name in sorted(collection_flags))
    export["spec"]["template"] = {
        "metadata": {"name": candidate, "annotations": runtime_annotations}, "spec": spec,
    }
    service_annotations = export["metadata"].get("annotations", {})
    for key in list(service_annotations):
        if key.startswith("run.googleapis.com/") and ("source" in key or "build" in key):
            del service_annotations[key]
    export["spec"]["traffic"] = [{"revisionName": previous, "percent": 100}]
    export["spec"]["traffic"].extend(
        {"revisionName": target["revisionName"], "tag": target["tag"]}
        for target in service["status"]["traffic"] if target.get("tag") and target["tag"] != "candidate"
    )
    export["spec"]["traffic"].append({"revisionName": candidate, "tag": "candidate"})
    require(live_revision(describe()) == previous, "Production traffic changed before candidate deployment")
    with tempfile.TemporaryDirectory(prefix="apt-deploy-") as directory:
        path = Path(directory) / "service.yaml"
        path.write_text(yaml.safe_dump(export, sort_keys=False), encoding="utf-8")
        cloud("services", "replace", str(path))
    reported = describe()
    require(live_revision(reported) == previous, "Candidate deployment changed production traffic")
    url = next((item.get("url") for item in reported["status"]["traffic"]
                if item.get("tag") == "candidate" and item.get("revisionName") == candidate), None)
    require(url, "Cloud Run did not publish the candidate URL")
    return url


def read(origin, path):
    request = Request(origin + path, headers={"Cache-Control": "no-cache", "User-Agent": "Apt-Deploy/1.0"})
    for attempt in range(1, 5):
        try:
            with urlopen(request, timeout=30) as response:
                return response.read()
        except HTTPError as error:
            if error.code not in TRANSIENT_HTTP or attempt == 4:
                raise RuntimeError(f"{path}: HTTP {error.code} (attempt {attempt}/4)") from error
            reason = f"HTTP {error.code}"
        except (URLError, TimeoutError) as error:
            if attempt == 4:
                raise RuntimeError(f"{path}: connection failed after {attempt} attempts") from error
            reason = "connection failed"
        print(f"{path}: {reason}; retrying ({attempt}/4)", flush=True)
        time.sleep(5 * attempt)


def frontend_entry(origin):
    html = read(origin, "/").decode()
    entry = re.search(r'<script[^>]+src="(/assets/[a-zA-Z0-9_.-]+\.js)"', html)
    require('<div id="root">' in html and entry, "Apt entry bundle was not found")
    return entry[1]


def verify(origin, expected_entry=None):
    health = json.loads(read(origin, "/api/health"))
    require(health.get("status") == "ok" and health.get("firestoreReady") is True, "Apt health check failed")
    require(health.get("openaiConfigured") is True and health.get("aiModel") == "gpt-6-luna", "Apt OpenAI configuration check failed")
    json.loads(read(origin, "/api/registry"))
    entry = frontend_entry(origin)
    if expected_entry is not None:
        for _ in range(4):
            if entry == expected_entry:
                break
            time.sleep(5)
            entry = frontend_entry(origin)
        require(entry == expected_entry, "Production did not serve the verified Apt bundle")
    bundle = read(origin, entry).decode()
    require(all(label in bundle for label in ("\uc544\ud30c\ud2b8 \ucc3e\uae30", "\ub2e8\uc9c0\uba85 \ub610\ub294 \uc9c0\uc5ed")), "Apt search UI is missing")
    require("\uc785\uc9c0 \ub4f1\uae09\ud45c" not in bundle, "Removed location grade table still appears in the Apt bundle")
    require("1,000\uc138\ub300 \uc774\uc0c1 \uc9c0\uc5ed" in bundle, "K-apt large-apartment regional search is missing")
    search = json.loads(read(origin, "/api/apt/search"))
    expected = {"서울": 422, "과천": 5, "분당": 37, "구성남": 22, "하남": 22}
    directory = search.get("directory", [])
    require(search.get("source") == "APT_FIRESTORE" and len(directory) >= sum(expected.values()),
            "Apt Firestore directory is missing")
    for region, count in expected.items():
        require(sum(row.get("region") == region for row in directory) >= count, f"Missing Apt complexes in {region}")
    require(len({row.get("id") for row in directory}) == len(directory)
            and all(row.get("homes", 0) >= 1000 and len(row.get("grades", [])) == 6
                    and row["grades"][2].get("grade") in (3, 4, 5)
                    and row["grades"][3].get("grade") in (1, 2, 3, 4, 5) for row in directory),
            "Apt complex IDs, household counts, or location grades are invalid")
    if search.get("months") == ["202609", "202610", "202611"] and not search.get("confirmedDistrictMonths"):
        require(len(search.get("prices", {})) == 399 and sum(map(len, search["prices"].values())) == 1046,
                "The verified Apt transaction seed is incomplete")
    require(json.loads(read(origin, "/api/housing/floor-plans/raemian-sur")), "Saved floor plans are empty")
    print(f"{origin}: {len(directory)} Apt complexes, {len(search.get('prices', {}))} with trades, bundle {entry}", flush=True)
    return entry


def set_traffic(revision):
    cloud("services", "update-traffic", SERVICE, "--to-revisions", f"{revision}=100")


def deploy():
    check_main()
    service = describe()
    previous = live_revision(service)
    candidate = f"{SERVICE}-{os.environ['GITHUB_SHA'][:7]}-{os.environ['GITHUB_RUN_ID']}-{os.environ['GITHUB_RUN_ATTEMPT']}"
    require(len(candidate) <= 63, "Candidate revision name exceeds the Cloud Run limit")
    print(f"Production {previous}; candidate {candidate}", flush=True)
    url = create_candidate(service, previous, candidate)
    entry = verify(url)
    check_main()
    require(live_revision(describe()) == previous, "Production traffic changed during candidate verification")
    try:
        set_traffic(candidate)
        require(live_revision(describe()) == candidate, "Production traffic did not reach the verified revision")
        verify(PRODUCTION, entry)
    except (Exception, KeyboardInterrupt):
        if live_revision(describe()) == candidate:
            set_traffic(previous)
            require(live_revision(describe()) == previous, "Apt rollback verification failed")
            print(f"Restored production traffic to {previous}", flush=True)
        raise
    print(f"Verified {candidate} at {PRODUCTION}", flush=True)


if __name__ == "__main__":
    deploy()
