#!/usr/bin/env python3
"""Run the read-only Firestore collector rehearsal against the migrated Apt database."""
import argparse
import json
import re
import subprocess
import sys
import time
from urllib.request import urlopen

APT = "busan-redevelopment"
KH = "gen-lang-client-0064554427"
REGION = "asia-northeast3"
SERVICE = "busan-redevelopment-news-monitor"
JOB = "apt-collector-rehearsal"
IDENTITY = "apt-collector-rehearsal"
IMAGE = ("asia-northeast3-docker.pkg.dev/busan-redevelopment/kbusan-images/k-busan"
         "@sha256:6239938fad6738292c005c8d2539061c444ba1a0308d094032471e51c2b21aa8")
CANDIDATE = "https://mk-3ff69c85---busan-redevelopment-news-monitor-pij3co2jea-du.a.run.app"
EXPECTED = "r20261127013219_0d34fa17"


def check(condition, message):
    if not condition:
        raise RuntimeError(message)


def gc(*args):
    return subprocess.check_output(["gcloud", *args, "--quiet"], text=True).strip()


def cloud_json(*args):
    return json.loads(gc(*args, "--format=json"))


def active_revision():
    with urlopen(CANDIDATE + "/market/api/data-status", timeout=30) as response:
        return json.load(response)["revision"]


def collector_settings():
    source = cloud_json("run", "jobs", "describe", "khousing-collector", "--project", KH, "--region", REGION)
    template = source["spec"]["template"]["spec"]["template"]
    annotations = template.get("metadata", {}).get("annotations", {})
    check(not any("vpc-access" in key or "network-interfaces" in key for key in annotations),
          "K-Housing collector uses custom egress. Reproduce the approved egress before running the Apt collector.")
    entries = {entry["name"]: entry for entry in template["spec"]["containers"][0].get("env", [])}
    check(not any(entries.get(key, {}).get("value") == "true"
                  for key in ("COLLECTOR_STAGE_ONLY", "COLLECTOR_VALIDATE_ONLY")),
          "K-Housing collector is currently configured for a rehearsal")
    values = {}
    for name in ("COLLECTOR_MONTHS", "COLLECTOR_DISTRICTS", "COLLECTOR_EXTRA_BUCKETS", "COLLECTOR_FULL_HISTORY"):
        if name in entries:
            value = entries[name].get("value")
            check(isinstance(value, str) and re.fullmatch(r"[a-zA-Z0-9,/-]+", value),
                  f"Review the old collector setting {name}")
            values[name] = value
    secret = entries.get("MOLIT_API_KEY", {}).get("valueFrom", {}).get("secretKeyRef", {})
    check(secret.get("name") == "khousing-molit" and re.fullmatch(r"latest|[1-9][0-9]*", str(secret.get("key"))),
          "Unexpected national trade API secret configuration")
    return values, str(secret["key"])


def apt_database():
    service = cloud_json("run", "services", "describe", SERVICE, "--project", APT, "--region", REGION)
    containers = service["spec"]["template"]["spec"]["containers"]
    settings = {v["name"]: v.get("value") for v in containers[0].get("env", [])}
    keys = ("FIRESTORE_PROJECT_ID", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT", "FIRESTORE_DATABASE_ID")
    check(all(key not in settings or settings[key] for key in keys), "Resolve Apt Firestore environment references")
    project = next((settings[key] for key in keys[:3] if key in settings), APT)
    database = settings.get(keys[3], "(default)")
    check(project == APT and re.fullmatch(r"\(default\)|[a-z][a-z0-9-]{2,62}", database), "Unexpected Apt database")
    return database


def execute_rehearsal():
    check(gc("projects", "describe", APT, "--format=value(projectNumber)") == "432348267432",
          "Unexpected Apt project number")
    check(gc("projects", "describe", KH, "--format=value(projectNumber)") == "9298525505",
          "Unexpected K-Housing project number")
    check(active_revision() == EXPECTED, "Apt candidate revision changed")
    values, secret_version = collector_settings()
    database = apt_database()
    email = f"{IDENTITY}@{APT}.iam.gserviceaccount.com"
    account_ids = cloud_json("iam", "service-accounts", "list", "--project", APT, f"--filter=email={email}")
    if not any(account.get("email") == email for account in account_ids):
        gc("iam", "service-accounts", "create", IDENTITY, "--project", APT,
           "--display-name=Apt Firestore collector validation")
    gc("projects", "add-iam-policy-binding", APT, "--member=serviceAccount:" + email,
       "--role=roles/datastore.viewer",
       f'--condition=title=apt-collector-read,expression=resource.name == "projects/{APT}/databases/{database}"')
    gc("secrets", "add-iam-policy-binding", "khousing-molit", "--project", KH,
       "--role=roles/secretmanager.secretAccessor", "--member=serviceAccount:" + email, "--condition=None")
    values.update(GOOGLE_CLOUD_PROJECT=APT, FIRESTORE_DATABASE_ID=database,
                  SOURCE_ARCHIVE_BUCKET="busan-redevelopment-khousing-source",
                  COLLECTOR_VALIDATE_ONLY="true")
    print("Starting the Apt collector in read-only verification mode.", flush=True)
    gc("run", "jobs", "deploy", JOB, "--project", APT, "--region", REGION,
       "--image", IMAGE, "--service-account", email, "--command=node", "--args=/app/market/dist/collector.cjs",
       "--tasks=1", "--max-retries=0", "--task-timeout=900s", "--cpu=1", "--memory=1Gi",
       "--set-env-vars", "^~^" + "~".join(f"{key}={value}" for key, value in values.items()),
       f"--set-secrets=MOLIT_API_KEY=projects/9298525505/secrets/khousing-molit:{secret_version}")
    execution = cloud_json("run", "jobs", "execute", JOB, "--wait", "--project", APT, "--region", REGION)
    name = execution["metadata"]["name"]
    check(re.fullmatch(r"apt-collector-rehearsal-[a-z0-9]+", name), "Unexpected Cloud Run execution name")
    predicate = (f'resource.type="cloud_run_job" AND resource.labels.job_name="{JOB}" '
                 f'AND labels."run.googleapis.com/execution_name"="{name}"')
    for _ in range(12):
        reports = cloud_json("logging", "read", predicate, "--project", APT, "--limit", "100")
        for report in reports:
            record = report.get("jsonPayload")
            if not record and report.get("textPayload", "").startswith("{"):
                try:
                    record = json.loads(report["textPayload"])
                except ValueError:
                    continue
            if isinstance(record, dict) and record.get("databaseWrites") == 0 and "baselineRevision" in record:
                check(record["baselineRevision"] == EXPECTED and record["baselineGroups"] == 1275 and
                      record["groups"] >= 1275 and record["requiresAptReceiptRefresh"] is False and
                      not record["missingAptCells"], "Collector failed the Apt retention or receipt checks")
                check(active_revision() == EXPECTED, "Apt active revision changed during the rehearsal")
                print(json.dumps({"execution": name, "revision": EXPECTED, "baseline": record["baselineGroups"],
                                  "merged": record["groups"], "databaseWrites": 0}))
                return
        time.sleep(5)
    raise RuntimeError("No validation report was found for this execution")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    try:
        execute_rehearsal()
    except (RuntimeError, subprocess.CalledProcessError, KeyError, OSError) as error:
        print(f"Apt collector verification stopped: {error}", file=sys.stderr)
        sys.exit(1)
