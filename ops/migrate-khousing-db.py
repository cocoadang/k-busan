#!/usr/bin/env python3
"""Audit or seed the Apt database from K-Housing without changing the serving app or source DB."""
import argparse
import json
import re
import subprocess
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

SOURCE_PROJECT = "gen-lang-client-0064554427"
SOURCE_DB = "ai-studio-khousing-38852770-f782-474c-b219-956fbb846237"
APT_PROJECT = "busan-redevelopment"
SOURCE_BUCKET = "run-sources-gen-lang-client-0064554427-asia-northeast3"
APT_BUCKET = "busan-redevelopment-khousing-source"
REVISION = r"r[0-9]{14}(?:_[a-f0-9]{8})?"
COLLECTION_PATTERN = re.compile(
    rf"(?:transactions|monthlyComplexPrices_v2|monthlyStandardAreaPrices_v2)(?:_{REVISION})?"
    r"|monthlyComplexPrices|priceRevisions|backfillJobs"
)
ARCHIVE_PATTERN = re.compile(rf"gs://{SOURCE_BUCKET}/khousing-source/{REVISION}/source\.json\.gz")
KINDS = ("transactions", "monthlyComplexPrices_v2", "monthlyStandardAreaPrices_v2")


def require(value, message):
    if not value:
        raise RuntimeError(message)


def gcloud(*args, capture=True):
    return subprocess.run(["gcloud", *args, "--quiet"], text=True, check=True,
                          stdout=subprocess.PIPE if capture else None).stdout


class Database:
    def __init__(self, project, database, auth):
        self.auth = auth
        self.name = f"projects/{project}/databases/{database}/documents"
        self.url = f"https://firestore.googleapis.com/v1/{self.name}"

    def call(self, path, body=None, optional=False):
        headers = {"Authorization": "Bearer " + self.auth, "Content-Type": "application/json"}
        data = None if body is None else json.dumps(body).encode()
        try:
            with urlopen(Request(self.url + path, data=data, headers=headers), timeout=60) as response:
                return json.load(response)
        except HTTPError as error:
            if optional and error.code == 404:
                return None
            message = json.loads(error.read()).get("error", {}).get("status", "UNKNOWN")
            raise RuntimeError(f"Firestore {error.code} {message} on {self.name}{path.split('?')[0]}") from None

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
        token = ""
        while True:
            query = urlencode({"pageSize": 200, "pageToken": token, "orderBy": "__name__ asc"})
            result = self.call(f"/{quote(collection, safe='')}?{query}")
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


def copy_fields(value, archives):
    if isinstance(value, list):
        return [copy_fields(item, archives) for item in value]
    if isinstance(value, dict):
        require("referenceValue" not in value, "Firestore references require explicit mapping")
        if isinstance(uri := value.get("stringValue"), str) and uri.startswith("gs://"):
            require(ARCHIVE_PATTERN.fullmatch(uri), f"Archive URI requires explicit mapping: {uri}")
            archives.add(uri)
            return {"stringValue": uri.replace(SOURCE_BUCKET, APT_BUCKET, 1)}
        return {key: copy_fields(item, archives) for key, item in value.items()}
    return value


def object_digest(uri):
    result = json.loads(gcloud("storage", "objects", "describe", uri, "--format=json"))
    checksum = result.get("crc32c_hash")
    require(bool(checksum) and int(result.get("size", 0)) > 0, f"Missing archive checksum: {uri}")
    return checksum, int(result["size"])


def copy_archives(archives):
    destination = "gs://" + APT_BUCKET
    def owner():
        return gcloud("storage", "buckets", "describe", destination, "--format=value(project_number)").strip()
    try:
        project_number = owner()
    except subprocess.CalledProcessError:
        # The unique bucket is created privately under the verified Apt project on first use.
        gcloud("storage", "buckets", "create", destination, "--project", APT_PROJECT,
               "--location", "asia-northeast3", "--uniform-bucket-level-access", "--public-access-prevention")
        project_number = owner()
    require(project_number == "432348267432", "The destination archive bucket must belong to the Apt project")
    for source in sorted(archives):
        target = source.replace(SOURCE_BUCKET, APT_BUCKET, 1)
        expected = object_digest(source)
        gcloud("storage", "cp", "--no-clobber", source, target, capture=False)
        require(object_digest(target) == expected, f"Archive checksum mismatch: {target}")


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
    require(names and all(COLLECTION_PATTERN.fullmatch(name) for name in names),
            f"Review unrecognized source collections before copying: {names}")

    archives = set()
    expected = {}
    data = {}
    for name in names:
        rows = {}
        for page in source.documents(name):
            for doc in page:
                id = document_id(doc)
                if name == "priceRevisions":
                    expected.update(inspect_manifest(doc, id))
                    if id == "active":
                        require(doc["fields"] == active["fields"], "Source active revision changed during scan")
                        continue
                require(id not in rows, f"Duplicate document in {name}")
                rows[id] = copy_fields(doc.get("fields", {}), archives)
        data[name] = rows
    active_fields = copy_fields(active["fields"], archives)
    require(data.get("priceRevisions", {}).get(revision) == active_fields,
            "Source active and immutable manifests differ")
    for name, count in expected.items():
        require(len(data.get(name, {})) == count, f"Source manifest count mismatch: {name}")

    counts = {}
    for name, rows in data.items():
        present = {document_id(doc): doc.get("fields", {})
                   for page in target.documents(name) for doc in page
                   if not (name == "priceRevisions" and document_id(doc) == "active")}
        # Historical revisions already produced by Apt may exist after a rehearsal.
        # Only an immutable source collection with overlapping IDs must match exactly.
        allow_extra = name == "priceRevisions"
        require((allow_extra or present.keys() <= rows.keys()) and
                all(rows[id] == value for id, value in present.items() if id in rows),
                f"Destination data differs in {name}")
        counts[name] = {"source": len(rows), "alreadyMatched": len(present.keys() & rows.keys())}
    require(source.get("priceRevisions", "active") == active, "Source active revision changed during audit")
    if not stage:
        return {"mode": "audit", "sourceRevision": revision, "collections": counts, "archives": len(archives), "writes": 0}

    copy_archives(archives)
    for name, rows in data.items():
        present = {document_id(doc): doc.get("fields", {})
                   for page in target.documents(name) for doc in page
                   if not (name == "priceRevisions" and document_id(doc) == "active")}
        missing = [target.write(name, id, fields) for id, fields in rows.items() if id not in present]
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
        verified = {document_id(doc): doc.get("fields", {})
                    for page in target.documents(name) for doc in page
                    if not (name == "priceRevisions" and document_id(doc) == "active")}
        require((name == "priceRevisions" or len(verified) == len(rows)) and
                all(verified.get(id) == fields for id, fields in rows.items()),
                f"Destination verification failed: {name}")

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
