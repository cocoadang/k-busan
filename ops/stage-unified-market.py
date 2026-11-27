#!/usr/bin/env python3
"""Build and verify an Apt Cloud Run candidate while keeping its current production traffic."""
import argparse
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import yaml

MARKET_SOURCE = "103c044ede1102bea8326d58d60ca153a4182997"
TAG = "market-unified"
MARKET_SETTINGS = ("GOOGLE_MAPS_API_KEY", "GOOGLE_MAPS_MAP_ID", "GEMINI_API_KEY", "GEMINI_MODEL")
PREVIEW_FLAGS = ("APT_KHOUSING_PREVIEW_ORIGIN", "APT_KHOUSING_PREVIEW_REVISION", "APT_CANONICAL_TRADE_PREVIEW_REVISION")


def checkout(root, repo, commit):
    path = root / repo
    path.mkdir()
    subprocess.run(["git", "init", "-q", str(path)], check=True)
    subprocess.run(["git", "-C", str(path), "fetch", "-q", "--depth=1",
                    f"https://github.com/cocoadang/{repo}.git", commit], check=True)
    subprocess.run(["git", "-C", str(path), "checkout", "-q", "--detach", "FETCH_HEAD"], check=True)
    actual = subprocess.check_output(["git", "-C", str(path), "rev-parse", "HEAD"], text=True).strip()
    if actual != commit:
        raise RuntimeError(f"Unexpected {repo} checkout")
    return path


def load_cloud_helpers(khousing):
    module = importlib.util.spec_from_file_location("cloud_rollout", khousing / "scripts/rollout_apt_khousing.py")
    helpers = importlib.util.module_from_spec(module)
    module.loader.exec_module(helpers)
    return helpers


def configure_market(cloud, source, apt, member):
    src_template = source["spec"]["template"]
    src_env = {item["name"]: item for item in src_template["spec"]["containers"][0].get("env", [])}
    src_aliases = src_template.get("metadata", {}).get("annotations", {}).get("run.googleapis.com/secrets", "")
    source_secrets = dict(entry.split(":", 1) for entry in src_aliases.split(",") if entry)
    apt_annotations = apt["spec"]["template"].setdefault("metadata", {}).setdefault("annotations", {})
    apt_secrets = dict(entry.split(":", 1) for entry in apt_annotations.get("run.googleapis.com/secrets", "").split(",") if entry)
    target_env = apt["spec"]["template"]["spec"]["containers"][0].setdefault("env", [])
    names = {"MARKET_" + key for key in MARKET_SETTINGS}
    target_env[:] = [item for item in target_env if item["name"] not in names]
    for key in MARKET_SETTINGS:
        entry = src_env.get(key)
        if not entry and key == "GOOGLE_MAPS_API_KEY":
            entry = src_env.get("VITE_GOOGLE_MAPS_API_KEY")
        if not entry:
            cloud.require(key != "GOOGLE_MAPS_API_KEY", "Existing K-Housing Maps key configuration was not found")
            continue
        name = "MARKET_" + key
        if "value" in entry:
            target_env.append({"name": name, "value": entry["value"]})
            continue
        ref = entry["valueFrom"]["secretKeyRef"]
        resource = source_secrets.get(ref["name"], f"projects/9298525505/secrets/{ref['name']}")
        match = re.fullmatch(r"projects/(9298525505|gen-lang-client-0064554427)/secrets/([A-Za-z0-9_-]+)", resource)
        cloud.require(match, "Unrecognized K-Housing secret reference")
        secret = match[2]
        alias = "apt-market-" + key.lower().replace("_", "-")
        cloud.cloud("secrets", "add-iam-policy-binding", secret, "--project", cloud.KH_PROJECT,
                    "--member", member, "--role", "roles/secretmanager.secretAccessor", "--condition=None", capture=True)
        apt_secrets[alias] = f"projects/9298525505/secrets/{secret}"
        target_env.append({"name": name, "valueFrom": {"secretKeyRef": {"name": alias, "key": ref["key"]}}})
    if apt_secrets:
        apt_annotations["run.googleapis.com/secrets"] = ",".join(f"{alias}:{resource}" for alias, resource in apt_secrets.items())


def main(root, apt_source, migrate_database=False):
    apt = checkout(root, "k-busan", apt_source)
    khousing = checkout(root, "k-housing", MARKET_SOURCE)
    cloud = load_cloud_helpers(khousing)
    cloud.check_resource(cloud.APT_PROJECT, "432348267432")
    cloud.check_resource(cloud.KH_PROJECT, "9298525505")
    region, current = cloud.apt_location()
    original = cloud.traffic_of(current)
    apt_config = yaml.safe_load(cloud.cloud("run", "services", "describe", cloud.APT_SERVICE,
                                           "--project", cloud.APT_PROJECT, "--region", region,
                                           "--format=export", capture=True))
    source_config = yaml.safe_load(cloud.cloud("run", "services", "describe", cloud.KH_SERVICE,
                                              "--project", cloud.KH_PROJECT, "--region", cloud.KH_REGION,
                                              "--format=export", capture=True))
    account = current["spec"]["template"]["spec"]["serviceAccountName"]
    cloud.require(re.fullmatch(r"[\w.-]+@(?:busan-redevelopment\.iam|developer)\.gserviceaccount\.com", account),
                  "Unexpected Apt runtime account")
    member = "serviceAccount:" + account
    from runpy import run_path
    migration = run_path(str(apt / "ops/migrate-khousing-db.py"))
    project, db = migration["apt_database"](apt_config)
    auth = migration["CloudAuth"]()
    target = migration["Database"](project, db, auth)
    if migrate_database:
        source = migration["Database"](migration["SOURCE_PROJECT"], migration["SOURCE_DB"], auth)
        report = migration["migrate"](source, target, stage=True)
        print(json.dumps(report, ensure_ascii=False), flush=True)
    active_doc = target.get("priceRevisions", "active")
    cloud.require(active_doc, "Stage the Apt database before deploying the web candidate")
    migration["inspect_manifest"](active_doc, "active")
    active = migration["revision_of"](active_doc)
    configure_market(cloud, source_config, apt_config, member)

    context = root / "context"
    cloud.run("bash", str(apt / "ops/package-unified-market.sh"), str(khousing), str(context))
    image = f"{region}-docker.pkg.dev/{cloud.APT_PROJECT}/kbusan-images/k-busan:market-{apt_source[:8]}"
    cloud.cloud("builds", "submit", str(context), "--ignore-file", str(context / ".gcloudignore"),
                "--project", cloud.APT_PROJECT, "--region", region, "--tag", image, "--timeout", "1200s")
    revision, url = cloud.deploy_tagged(
        root, cloud.APT_PROJECT, region, cloud.APT_SERVICE, image, TAG,
        {"APT_UNIFIED_HOUSING": "true", "APT_TRADE_MODE": "khousing-api", "APT_MARKET_DB": "apt",
         "IMPORT_FLOOR_PLANS_ON_START": "false", "IMPORT_FLOOR_PLANS_ON_POLL": "false"},
        PREVIEW_FLAGS, original, yaml.safe_dump(apt_config, sort_keys=False),
    )
    for attempt in range(3):
        try:
            cloud.run("node", str(apt / "ops/verify-unified-market.mjs"), url, active, "202611")
            break
        except subprocess.CalledProcessError:
            if attempt == 2:
                raise
            time.sleep(10)
    cloud.require(cloud.traffic_of(cloud.describe_service(cloud.APT_PROJECT, region, cloud.APT_SERVICE)) == original,
                  "Production traffic changed during preview verification")
    print(json.dumps({"candidateUrl": url, "candidateRevision": revision, "databaseRevision": active,
                      "region": region, "productionTraffic": original}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apt-source", required=True, help="Pinned Apt integration commit")
    parser.add_argument("--migrate-db", action="store_true", help="Copy and verify the source before staging the web candidate")
    arguments = parser.parse_args()
    if not re.fullmatch(r"[a-f0-9]{40}", arguments.apt_source):
        parser.error("A full Git commit SHA is required")
    try:
        with tempfile.TemporaryDirectory(prefix="apt-market-stage-") as directory:
            main(Path(directory), arguments.apt_source, arguments.migrate_db)
    except (RuntimeError, subprocess.CalledProcessError, KeyError) as error:
        print(f"Apt preview stopped: {error}", file=sys.stderr)
        sys.exit(1)
