"""Read only Cloud Run v1 status traffic; never infer production traffic from readiness."""
import argparse
import json
import re
import sys
from urllib.parse import urlsplit

REVISION = re.compile(r"[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?")


def entries(service):
    traffic = service.get("status", {}).get("traffic")
    if not isinstance(traffic, list) or not traffic or not all(isinstance(t, dict) for t in traffic):
        raise ValueError("missing current Cloud Run traffic status")
    return traffic


def revision(target):
    name = target.get("revisionName")
    if not isinstance(name, str) or not REVISION.fullmatch(name):
        raise ValueError("traffic target does not resolve to an exact revision")
    return name


def serving_revision(service):
    targets = entries(service)
    active = []
    for target in targets:
        percent = target.get("percent", 0)  # A candidate tag may have no percent field.
        if type(percent) is not int or not 0 <= percent <= 100:
            raise ValueError("invalid active Cloud Run traffic percentage")
        if percent:
            active.append((percent, revision(target)))
    if len(active) != 1 or active[0][0] != 100:
        raise ValueError("refusing to replace split, missing or unresolved service traffic")
    return active[0][1]


def candidate_url(service, expected, baseline):
    if serving_revision(service) != baseline or baseline == expected:
        raise ValueError("live serving revision changed or candidate already has default traffic")
    tags = [t for t in entries(service) if t.get("tag") == "candidate"]
    if len(tags) != 1 or revision(tags[0]) != expected or tags[0].get("percent", 0) != 0:
        raise ValueError("candidate tag does not point to the expected zero-traffic revision")
    url = tags[0].get("url")
    if not isinstance(url, str):
        raise ValueError("candidate endpoint is missing")
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or not parsed.hostname or not parsed.hostname.endswith(".run.app")
            or not parsed.hostname.startswith("candidate---") or parsed.netloc != parsed.hostname
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        raise ValueError("candidate endpoint is not a Cloud Run HTTPS tag URL")
    return url.rstrip("/")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("action", choices=["serving", "candidate"])
    p.add_argument("expected", nargs="?")
    p.add_argument("baseline", nargs="?")
    args = p.parse_args()
    try:
        service = json.load(sys.stdin)
        if args.action == "serving":
            print(serving_revision(service))
        else:
            print(candidate_url(service, args.expected, args.baseline))
    except (AttributeError, TypeError, ValueError) as exc:
        # Do not print input payloads (which are intentionally status-only in workflow).
        print("Cloud Run traffic validation failed: " + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
