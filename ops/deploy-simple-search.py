#!/usr/bin/env python3
"""Deploy the Apt search UI on the existing production backend."""
import argparse
import importlib.util
import json
import re
import sys
import tempfile
import time
import subprocess
from pathlib import Path
from urllib.request import urlopen

APT_BASE = "b53b30786864625f6e017a4025601f186c20059f"
KHOUSING_HELPER = "103c044ede1102bea8326d58d60ca153a4182997"
EXPECTED_LIVE = "busan-redevelopment-news-monitor-ap-6b08dc23"
PRODUCTION = "https://apt.dsoom.com"


def checkout(root, name, sha):
    path = root / name
    path.mkdir()
    subprocess.run(["git", "init", "-q", str(path)], check=True)
    subprocess.run(["git", "-C", str(path), "fetch", "-q", "--depth=1",
                    f"https://github.com/cocoadang/{name}.git", sha], check=True)
    subprocess.run(["git", "-C", str(path), "checkout", "-q", "--detach", "FETCH_HEAD"], check=True)
    return path


def frontend(origin):
    with urlopen(origin + "/", timeout=20) as response:
        html = response.read().decode()
    entry = re.search(r'<script[^>]+src="(/assets/[a-zA-Z0-9_.-]+\.js)"', html)
    if not entry:
        raise RuntimeError("Apt entry bundle was not found")
    with urlopen(origin + entry[1], timeout=25) as response:
        bundle = response.read().decode()
    if "아파트 찾기" not in bundle or any(section in bundle for section in (
        "검토한 영상에서 정리한 투자 판단 기준", "영상에서 확인한 입지 비교",
    )):
        raise RuntimeError("Apt landing page did not match the simplified layout")
    return entry[1]


def deploy(root, sha):
    helper = checkout(root, "k-housing", KHOUSING_HELPER)
    spec = importlib.util.spec_from_file_location("apt_run", helper / "scripts/rollout_apt_khousing.py")
    cloud = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cloud)
    cloud.check_resource(cloud.APT_PROJECT, "432348267432")
    apt = checkout(root, "k-busan", sha)
    commit = cloud.run("git", "cat-file", "-p", "HEAD", cwd=apt, capture=True)
    parents = re.findall(r"^parent ([a-f0-9]{40})$", commit.split("\n\n", 1)[0], re.M)
    cloud.require(parents == [APT_BASE], "This release is not based on the verified production source")
    region, original = cloud.apt_location()
    traffic = cloud.traffic_of(original)
    tag = f"ui-{sha[:8]}"
    revision_name = f"{cloud.APT_SERVICE}-{tag}"
    if traffic == {revision_name: 100}:
        print(json.dumps({"production": PRODUCTION, "revision": revision_name, "entry": frontend(PRODUCTION)}))
        return
    cloud.require(traffic == {EXPECTED_LIVE: 100}, "Apt has a different production revision; inspect it before deploying")
    image = f"{region}-docker.pkg.dev/{cloud.APT_PROJECT}/kbusan-images/k-busan:search-{sha[:8]}"
    candidate = next((item for item in original["status"]["traffic"] if item.get("tag") == tag), None)
    if candidate:
        cloud.require(candidate.get("revisionName") == revision_name and candidate.get("url"), "Unexpected search preview")
        url = candidate["url"]
    else:
        old_export = cloud.cloud("run", "services", "describe", cloud.APT_SERVICE, "--project", cloud.APT_PROJECT,
                                 "--region", region, "--format=export", capture=True)
        import yaml
        service = yaml.safe_load(old_export)
        active = yaml.safe_load(cloud.cloud("run", "revisions", "describe", EXPECTED_LIVE,
                                            "--project", cloud.APT_PROJECT, "--region", region,
                                            "--format=export", capture=True))
        inherited = active["metadata"].get("annotations", {})
        annotations = {key: value for key, value in inherited.items()
                       if key.startswith("autoscaling.knative.dev/") or key.startswith(("run.googleapis.com/vpc-", "run.googleapis.com/network-"))
                       or key in ("run.googleapis.com/secrets", "run.googleapis.com/execution-environment",
                                  "run.googleapis.com/cpu-throttling", "run.googleapis.com/startup-cpu-boost",
                                  "run.googleapis.com/sessionAffinity", "run.googleapis.com/encryption-key")}
        service["spec"]["template"] = {"metadata": {"annotations": annotations}, "spec": active["spec"]}
        old_export = yaml.safe_dump(service, sort_keys=False)
        cloud.build(apt, cloud.APT_PROJECT, region, image)
        revision_name, url = cloud.deploy_tagged(
            root, cloud.APT_PROJECT, region, cloud.APT_SERVICE, image, tag, {}, (), traffic, old_export,
        )
    entry = frontend(url)
    # Require that searching still reaches the saved data API.
    response = cloud.api_json(url, "/api/housing/apartment-budget")
    cloud.require(isinstance(response.get("results"), list) and response.get("revision"),
                  "Saved trade search did not return a database revision")
    cloud.require(cloud.traffic_of(cloud.describe_service(cloud.APT_PROJECT, region, cloud.APT_SERVICE)) == traffic,
                  "Production traffic changed while verifying the preview")
    try:
        cloud.change_traffic(cloud.APT_PROJECT, region, cloud.APT_SERVICE, {revision_name: 100})
        for attempt in range(5):
            try:
                if frontend(PRODUCTION) == entry:
                    break
            except (RuntimeError, OSError):
                if attempt == 4:
                    raise
            if attempt == 4:
                raise RuntimeError("Apt production still serves a different frontend bundle")
            time.sleep(5)
        cloud.require(cloud.traffic_of(cloud.describe_service(cloud.APT_PROJECT, region, cloud.APT_SERVICE)) == {revision_name: 100},
                      "Production traffic did not switch to the verified search revision")
    except (Exception, KeyboardInterrupt):
        cloud.rollback_traffic(cloud.APT_PROJECT, region, cloud.APT_SERVICE, revision_name, traffic)
        raise
    print(json.dumps({"production": PRODUCTION, "revision": revision_name, "entry": entry}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apt-source", required=True)
    arguments = parser.parse_args()
    if not re.fullmatch(r"[a-f0-9]{40}", arguments.apt_source):
        parser.error("Pass the exact Apt search commit")
    try:
        with tempfile.TemporaryDirectory(prefix="apt-simple-search-") as directory:
            deploy(Path(directory), arguments.apt_source)
    except Exception as error:
        print(f"Apt search deployment stopped: {error}", file=sys.stderr)
        sys.exit(1)
