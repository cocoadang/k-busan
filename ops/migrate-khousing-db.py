#!/usr/bin/env python3
"""Audit or seed the Apt database from K-Housing without changing the serving app or source DB."""
import argparse
import json
import re
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from http.client import IncompleteRead, RemoteDisconnected
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode
from urllib.request import Request, urlopen

SOURCE_PROJECT = "gen-lang-client-0064554427"
SOURCE_DB = "ai-studio-khousing-38852770-f782-474c-b219-956fbb846237"
APT_PROJECT = "busan-redevelopment"
SOURCE_BUCKET = "run-sources-gen-lang-client-0064554427-asia-northeast3"
APT_BUCKET = "busan-redevelopment-khousing-source"
REVISION = r"r[0-9]{14}(?:_[a-f0-9]{8})?"
COLLECTION_PATTERN = re.compile(
    rf"(?:transactions|monthlyComplexPrices_v2|monthlyStandardAreaPrices_v2)(?:_{REVISION})?"
    r"|monthlyComplexPrices|priceRevisions|backfillJobs|complexes|settings|aptCutoverStages"
)
ARCHIVE_PATTERN = re.compile(rf"gs://{SOURCE_BUCKET}/khousing-source/{REVISION}/source\.json\.gz")
KINDS = ("transactions", "monthlyComplexPrices_v2", "monthlyStandardAreaPrices_v2")
DESTINATIONS = {"settings": "khousingSettings", "aptCutoverStages": "khousingCutoverStages"}


def require(value, message):
    if not value:
        raise RuntimeError(message)


def gcloud(*args, capture=True):
    return subprocess.run(["gcloud", *args, "--quiet"], text=True, check=True,
                          stdout=subprocess.PIPE if capture else None).stdout


def read_json(request, retry=False, timeout=40):
    attempts = 4 if retry else 1
    for attempt in range(attempts):
        try:
            with urlopen(request, timeout=timeout) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code not in (408, 429, 500, 502, 503, 504) or attempt + 1 == attempts:
                raise
            error.close()
        except (TimeoutError, ConnectionError, IncompleteRead, RemoteDisconnected, URLError) as error:
            if attempt + 1 == attempts:
                route = request.full_url.split("?", 1)[0]
                if retry:
                    raise RuntimeError(f"Read failed after {attempts} attempts on {route}: {type(error).__name__}") from None
                raise RuntimeError(f"Write result could not be confirmed on {route}. Re-run to verify and resume.") from None
        time.sleep(2 ** attempt)


class Database:
    def __init__(self, project, database, auth):
        self.auth = auth
        self.name = f"projects/{project}/databases/{database}/documents"
        self.url = f"https://firestore.googleapis.com/v1/{self.name}"

    def call(self, path, body=None, optional=False):
        headers = {"Authorization": "Bearer " + self.auth, "Content-Type": "application/json"}
        data = None if body is None else json.dumps(body).encode()
        try:
            return read_json(Request(self.url + path, data=data, headers=headers),
                             retry=data is None or path == ":listCollectionIds")
        except HTTPError as error:
            if optional and error.code == 404:
                return None
            try:
                details = json.loads(error.read()).get("error", {})
            except (ValueError, AttributeError):
                details = {}
            if not isinstance(details, dict):
                details = {}
            route, _, query = path.partition("?")
            status = details.get("status") or "UNKNOWN"
            reason = ""
            if body is None and query and error.code == 400:
                message = " ".join(str(details.get("message", "")).split())
                page_token = parse_qs(query).get("pageToken", [""])[0]
                for secret in (self.auth, page_token, quote(page_token, safe="")):
                    if secret:
                        message = message.replace(secret, "[redacted]")
                if message:
                    reason = f": {message[:350]}"
            raise RuntimeError(f"Firestore {error.code} {status} on {self.name}{route}{reason}") from None

    def inventory(self):
        output = []
        token = ""
        while True:
            result = self.call(":listCollectionIds", {"pageSize": 200, "pageToken": token})
            output.extend(result.get("collectionIds", []))
            token = result.get("nextPageToken")
            if not token:
                return sorted(output)

    def get(self, collection, id):
        return self.call(f"/{quote(collection, safe='')}/{quote(id, safe='')}", optional=True)

    def documents(self, collection):
        token = None
        path = f"/{quote(collection, safe='')}"
        while True:
            query = {"pageSize": 75}
            if token:
                query["pageToken"] = token
            result = self.call(f"{path}?{urlencode(query)}")
            yield result.get("documents", [])
            token = result.get("nextPageToken")
            if not token:
                return

    def commit(self, writes):
        result = self.call(":commit", {"writes": writes})
        require(len(result.get("writeResults", [])) == len(writes), "Incomplete Firestore commit")

    def write(self, collection, id, fields, prior=None):
        return {
            "update": {"name": f"{self.name}/{collection}/{id}", "fields": fields},
            "currentDocument": {"updateTime": prior["updateTime"]} if prior else {"exists": False},
        }


def document_id(doc):
    return doc["name"].rsplit("/", 1)[1]


def revision_of(doc):
    return (doc or {}).get("fields", {}).get("revision", {}).get("stringValue")


def inspect_manifest(review, name):
    require(review["fields"]["status"] == {"stringValue": "READY"}, f"Manifest {name} is not ready")
    revision = revision_of(review)
    require(re.fullmatch(REVISION, revision or "") and (name == "active" or name == revision),
            f"Invalid manifest revision {name}")
    entries = review["fields"]["collections"]["mapValue"]["fields"]
    counts = review["fields"]["counts"]["mapValue"]["fields"]
    require(set(entries) == set(KINDS) and set(counts) == set(KINDS), f"Invalid collections for {name}")
    expected = {}
    for key in KINDS:
        collection = entries[key]["stringValue"]
        require(collection == key + "_" + revision, f"Invalid manifest target {collection}")
        count = int(counts[key]["integerValue"])
        require(count >= 0 and (key != "transactions" or count > 0), f"Invalid row count for {collection}")
        expected[collection] = count
    return expected


def copy_fields(value, archives, source_name, target_name, historical_metadata=False):
    if isinstance(value, list):
        return [copy_fields(item, archives, source_name, target_name, historical_metadata) for item in value]
    if isinstance(value, dict):
        reference = value.get("referenceValue")
        if reference is not None:
            require(isinstance(reference, str) and reference.startswith(source_name + "/"),
                    "Firestore reference targets an unrecognized database")
            collection, _, rest = reference.removeprefix(source_name + "/").partition("/")
            require(COLLECTION_PATTERN.fullmatch(collection) and rest, "Invalid source document reference")
            return {"referenceValue": f"{target_name}/{DESTINATIONS.get(collection, collection)}/{rest}"}
        if isinstance(uri := value.get("stringValue"), str) and uri.startswith("gs://"):
            if ARCHIVE_PATTERN.fullmatch(uri):
                archives.add(uri)
                return {"stringValue": uri.replace(SOURCE_BUCKET, APT_BUCKET, 1)}
            require(historical_metadata, "A source archive URI requires explicit mapping")
        return {key: copy_fields(item, archives, source_name, target_name, historical_metadata)
                for key, item in value.items()}
    return value

def object_digest(uri, headers, optional=False):
    bucket, _, key = uri.removeprefix("gs://").partition("/")
    url = f"https://storage.googleapis.com/storage/v1/b/{bucket}/o/{quote(key, safe='')}?fields=crc32c,size"
    try:
        result = read_json(Request(url, headers=headers), retry=True)
    except HTTPError as error:
        if optional and error.code == 404:
            return None
        raise RuntimeError(f"Cloud Storage HTTP {error.code} reading metadata for {uri}") from None
    checksum = result.get("crc32c")
    require(bool(checksum) and int(result.get("size", 0)) > 0, f"Missing archive checksum: {uri}")
    return checksum, int(result["size"])


def copy_archives(archives):
    if not archives:
        return
    destination = "gs://" + APT_BUCKET
    token = gcloud("auth", "print-access-token").strip()
    headers = {"Authorization": "Bearer " + token}
    request = Request(f"https://storage.googleapis.com/storage/v1/b/{APT_BUCKET}?fields=projectNumber", headers=headers)

    def owner():
        return str(read_json(request, retry=True).get("projectNumber", ""))

    try:
        project_number = owner()
    except HTTPError as error:
        if error.code != 404:
            raise RuntimeError(f"Cloud Storage HTTP {error.code} reading the Apt archive bucket") from None
        gcloud("storage", "buckets", "create", destination, "--project", APT_PROJECT,
               "--location", "asia-northeast3", "--uniform-bucket-level-access", "--public-access-prevention")
        project_number = owner()
    require(project_number == "432348267432", "The destination archive bucket must belong to the Apt project")
    def sync_archive(source):
        target = source.replace(SOURCE_BUCKET, APT_BUCKET, 1)
        expected = object_digest(source, headers)
        existing = object_digest(target, headers, optional=True)
        if existing is not None:
            require(existing == expected, f"Archive checksum mismatch: {target}")
            return 1
        gcloud("storage", "cp", "--no-clobber", source, target, capture=False)
        require(object_digest(target, headers) == expected, f"Archive checksum mismatch: {target}")
        return 0

    with ThreadPoolExecutor(max_workers=4) as workers:
        reused = sum(workers.map(sync_archive, sorted(archives)))
    print(f"ARCHIVES_VERIFIED count={len(archives)} reused={reused}", flush=True)


def migrate(source, target, stage=False, previous=None):
    active = source.get("priceRevisions", "active")
    require(active, "K-Housing active revision was not found")
    inspect_manifest(active, "active")
    revision = revision_of(active)
    target_active = target.get("priceRevisions", "active")
    require(revision_of(target_active) in (None, revision, previous),
            "The existing Apt price pointer differs. A verified baseline is required.")
    require(not target_active or revision_of(target_active), "Apt price pointer has no revision")
    names = source.inventory()
    unknown = sorted(name for name in names if not COLLECTION_PATTERN.fullmatch(name))
    require(names and not unknown, f"Review unrecognized source collections before copying: {unknown}")

    print(f"SOURCE_SCAN_START collections={len(names)} revision={revision}", flush=True)

    def read_source(name):
        rows = {}
        references = set()
        revision_counts = {}
        for page in source.documents(name):
            for doc in page:
                id = document_id(doc)
                if name == "priceRevisions":
                    revision_counts.update(inspect_manifest(doc, id))
                    if id == "active":
                        require(doc["fields"] == active["fields"], "Source active revision changed during scan")
                        continue
                require(id not in rows, f"Duplicate document in {name}")
                rows[id] = copy_fields(doc.get("fields", {}), references, source.name, target.name,
                                       historical_metadata=name in DESTINATIONS)
        return name, rows, references, revision_counts

    archives = set()
    expected = {}
    data = {}
    with ThreadPoolExecutor(max_workers=6) as workers:
        for index, (name, rows, references, revision_counts) in enumerate(workers.map(read_source, names), 1):
            data[name] = rows
            archives.update(references)
            expected.update(revision_counts)
            if index % 8 == 0 or index == len(names):
                print(f"SOURCE_SCAN {index}/{len(names)}", flush=True)

    active_fields = copy_fields(active["fields"], archives, source.name, target.name)
    require(data.get("priceRevisions", {}).get(revision) == active_fields,
            "Source active and immutable manifests differ")
    for name, count in expected.items():
        require(len(data.get(name, {})) == count, f"Source manifest count mismatch: {name}")

    def target_rows(name):
        destination = DESTINATIONS.get(name, name)
        return {document_id(doc): doc.get("fields", {})
                for page in target.documents(destination) for doc in page
                if not (name == "priceRevisions" and document_id(doc) == "active")}

    def audit_target(name):
        rows = data[name]
        present = target_rows(name)
        # Keep unrelated Apt rehearsal manifests and require parity for every shared document.
        require((name == "priceRevisions" or present.keys() <= rows.keys()) and
                all(rows[id] == value for id, value in present.items() if id in rows),
                f"Destination data differs in {name}")
        return name, present.keys() & rows.keys()

    counts = {}
    matched = {}
    print(f"APT_AUDIT_START collections={len(names)}", flush=True)
    with ThreadPoolExecutor(max_workers=6) as workers:
        for index, (name, ids) in enumerate(workers.map(audit_target, names), 1):
            matched[name] = ids
            counts[name] = {"source": len(data[name]), "alreadyMatched": len(ids)}
            if name in DESTINATIONS:
                counts[name]["destination"] = DESTINATIONS[name]
            if index % 8 == 0 or index == len(names):
                print(f"APT_AUDIT {index}/{len(names)}", flush=True)
    require(source.get("priceRevisions", "active") == active, "Source active revision changed during audit")
    if not stage:
        return {"mode": "audit", "sourceRevision": revision, "collections": counts, "archives": len(archives), "writes": 0}

    copy_archives(archives)

    def copy_collection(name):
        rows = data[name]
        destination = DESTINATIONS.get(name, name)
        missing = [target.write(destination, id, fields) for id, fields in rows.items() if id not in matched[name]]
        if not missing:
            return
        print(f"COPY_COLLECTION {destination} remaining={len(missing)}", flush=True)
        batch = []
        size = 0
        for write in missing:
            write_size = len(json.dumps(write).encode())
            if batch and (len(batch) >= 200 or size + write_size > 8_000_000):
                target.commit(batch)
                batch, size = [], 0
            batch.append(write)
            size += write_size
        if batch:
            target.commit(batch)
        verified = target_rows(name)
        require((name == "priceRevisions" or len(verified) == len(rows)) and
                all(verified.get(id) == fields for id, fields in rows.items()),
                f"Destination verification failed: {name}")
        print(f"COLLECTION_VERIFIED {destination} count={len(rows)}", flush=True)

    collections_to_copy = [name for name in names if name != "priceRevisions"]
    with ThreadPoolExecutor(max_workers=3) as workers:
        list(workers.map(copy_collection, collections_to_copy))
    copy_collection("priceRevisions")

    require(source.get("priceRevisions", "active") == active, "Source active revision changed during copy")
    if not target_active or target_active["fields"] != active_fields:
        require(revision_of(target_active) != revision, "Apt already has a different active manifest with this revision ID")
        target.commit([target.write("priceRevisions", "active", active_fields, target_active)])
    require(target.get("priceRevisions", "active")["fields"] == active_fields, "Apt pointer verification failed")
    return {"mode": "stage", "sourceRevision": revision, "collections": counts, "archives": len(archives),
            "aptPointer": revision, "productionTrafficChanged": False}


def apt_database(service):
    env = {item["name"]: item.get("value") for item in service["spec"]["template"]["spec"]["containers"][0].get("env", [])}
    project = next((env.get(key) for key in ("FIRESTORE_PROJECT_ID", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT") if env.get(key)), APT_PROJECT)
    database = env.get("FIRESTORE_DATABASE_ID", "(default)")
    require(project == APT_PROJECT and database and (database == "(default)" or re.fullmatch(r"[a-z][a-z0-9-]{2,62}", database)),
            "Unexpected Apt Firestore configuration")
    for key in ("FIRESTORE_PROJECT_ID", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT", "FIRESTORE_DATABASE_ID"):
        require(key not in env or env[key] is not None, f"Resolve the Apt configuration for {key} explicitly")
    return project, database


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", action="store_true", help="Copy, verify and seed the Apt price pointer")
    parser.add_argument("--expected-apt-revision", help="Explicitly allow replacing an older mirrored pointer")
    args = parser.parse_args()
    require(not args.expected_apt_revision or re.fullmatch(REVISION, args.expected_apt_revision),
            "Invalid expected Apt revision")
    service = json.loads(gcloud("run", "services", "describe", "busan-redevelopment-news-monitor",
                               "--region", "asia-northeast3", "--project", APT_PROJECT, "--format=json"))
    project, database = apt_database(service)
    token = gcloud("auth", "print-access-token").strip()
    require(token, "Run this from an authorized Cloud Shell session")
    print(json.dumps(migrate(Database(SOURCE_PROJECT, SOURCE_DB, token), Database(project, database, token),
                             args.stage, args.expected_apt_revision), ensure_ascii=False))
