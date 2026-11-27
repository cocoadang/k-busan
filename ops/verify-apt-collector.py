#!/usr/bin/env python3
"""Run the read-only Firestore collector rehearsal against the migrated Apt database."""
import argparse
import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
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


def molit_secret(entries, annotation_layers):
    names = {}
    for annotations in annotation_layers:
        for binding in annotations.get("run.googleapis.com/secrets", "").split(","):
            if not binding:
                continue
            alias, sep, reference = binding.partition(":")
            check(sep and alias and reference, "Malformed Cloud Run secret alias")
            check(alias not in names or names[alias] == reference, "Conflicting Cloud Run secret aliases")
            names[alias] = reference

    entry = entries.get("MOLIT_API_KEY", {})
    ref = entry.get("valueFrom", {}).get("secretKeyRef") or entry.get("valueSource", {}).get("secretKeyRef")
    if ref:
        name = ref.get("name") or ref.get("secret")
        version = str(ref.get("key") or ref.get("version") or "")
        check(isinstance(name, str) and name, "MOLIT Secret Manager reference has no name")
        resource = names.get(name, name)
        full = re.fullmatch(r"projects/(9298525505|gen-lang-client-0064554427)/secrets/([A-Za-z0-9_-]+)", resource)
        if full:
            secret = full[2]
        else:
            check(re.fullmatch(r"[A-Za-z0-9_-]+", resource), "MOLIT secret points outside the K-Housing project")
            secret = resource
        check(re.fullmatch(r"latest|[1-9][0-9]*|[A-Za-z][A-Za-z0-9_-]{0,62}", version),
              "Invalid MOLIT Secret Manager version")
    else:
        # Prior rollout verified this stored key. Never extract a literal key or a mounted config.
        secret, version = "khousing-molit", "latest"
        print("Using the existing K-Housing MOLIT Secret Manager entry for the rehearsal.", flush=True)

    metadata = cloud_json("secrets", "versions", "describe", version, "--secret", secret, "--project", KH)
    check(metadata.get("state") == "ENABLED", "MOLIT Secret Manager version is unavailable")
    name = metadata.get("name", "")
    match = re.fullmatch(rf"projects/(?:9298525505|{re.escape(KH)})/secrets/{re.escape(secret)}/versions/([1-9][0-9]*)", name)
    check(match, "Unexpected MOLIT Secret Manager version metadata")
    return secret, match[1]


def collector_settings(reuse_source_egress=False):
    source = cloud_json("run", "jobs", "describe", "khousing-collector", "--project", KH, "--region", REGION)
    job_template = source["spec"]["template"]
    template = job_template["spec"]["template"]
    layers = [item.get("metadata", {}).get("annotations", {}) for item in (source, job_template, template)]
    annotations = {key: value for layer in layers for key, value in layer.items()}
    network = {key: value for key, value in annotations.items() if key.startswith("run.googleapis.com/")
               and ("vpc-access" in key or "network-interfaces" in key or key.endswith("/network-tags"))}
    check(reuse_source_egress or not network, "K-Housing collector uses custom egress; use --khousing-egress")
    container = template["spec"]["containers"][0]
    entries = {entry["name"]: entry for entry in container.get("env", [])}
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
    image = container.get("image", "") if reuse_source_egress else IMAGE
    if reuse_source_egress:
        check(re.fullmatch(r"asia-northeast3-docker\.pkg\.dev/gen-lang-client-0064554427/[a-z0-9_./-]+(?::[a-zA-Z0-9_.-]+|@sha256:[a-f0-9]{64})", image),
              "Unexpected source collector image")
    return values, molit_secret(entries, layers), image, network


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


def execution_logs(name, project=APT, job=JOB):
    check(job in (JOB, "khousing-collector") and re.fullmatch(re.escape(job) + r"-[a-z0-9]+", name),
          "Unexpected Cloud Run execution name")
    predicate = (f'resource.type="cloud_run_job" AND resource.labels.job_name="{job}" '
                 f'AND labels."run.googleapis.com/execution_name"="{name}"')
    return cloud_json("logging", "read", predicate, "--project", project, "--limit", "100")


def error_codes(entries):
    diagnostics = []
    for entry in entries:
        text = entry.get("textPayload")
        if not isinstance(text, str):
            text = (entry.get("jsonPayload") or {}).get("message", "")
        if not isinstance(text, str):
            continue
        for pattern in (
            r"(?:MOLIT_FETCH_FAILED|MOLIT_HTTP_[0-9]{3}|MOLIT_REQUEST_FAILED)(?:: [0-9/]+)?",
            r"MOLIT_NETWORK_UNAVAILABLE_AFTER_RETRIES|MOLIT_KEY_REQUIRED|RETRYABLE_UPSTREAM_STATUS",
            r"TRUSTED_ACTIVE_BASELINE_REQUIRED|BASELINE_MANIFEST_MISMATCH|BASELINE_TRANSACTION_SET_MISMATCH|ACTIVE_REVISION_CHANGED",
            r"INVALID_MONTH_LIST|UNREGISTERED_DISTRICT|INVALID_EXTRA_SOURCE_BUCKET|TOO_MANY_EXTRA_SOURCE_BUCKETS|INVALID_TOTAL_COUNT",
            r"INCOMPLETE_SOURCE_PAGINATION|APT_SOURCE_IDENTITY_MISMATCH|INVALID_MATCHED_SOURCE_ROW|AMBIGUOUS_SOURCE_GROUP|APT_CANCELLATION_DATE_MISSING",
            r"PERMISSION_DENIED|UNAUTHENTICATED|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED|INVALID_ARGUMENT|FAILED_PRECONDITION|UNAVAILABLE",
            r"MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|EACCES|EROFS|ETIMEDOUT|ECONNRESET|URI malformed",
        ):
            for match in re.finditer(r"(?<![A-Z0-9_])(?:" + pattern + r")(?![A-Z0-9_])", text):
                if match.group() not in diagnostics:
                    diagnostics.append(match.group())
    return diagnostics


def explain_failure(name, project=APT):
    for attempt in range(6):
        diagnostics = error_codes(execution_logs(name, project))
        if diagnostics:
            print(json.dumps({"execution": name, "diagnostics": diagnostics}))
            return
        if attempt < 5:
            time.sleep(3)
    raise RuntimeError(f"No recognized diagnostic for {name}. Inspect the execution's container stderr in Cloud Logging.")


def run_collector(*overrides, project=APT):
    command = ["gcloud", "run", "jobs", "execute", JOB, "--wait", "--project", project,
               "--region", REGION, "--format=json", "--quiet", *overrides]
    outcome = subprocess.run(command, capture_output=True, text=True)
    if outcome.returncode:
        match = re.search(r"apt-collector-rehearsal-([a-z0-9]+)-task[0-9]+",
                          outcome.stderr + outcome.stdout)
        if not match:
            match = re.search(r"executions describe (apt-collector-rehearsal-[a-z0-9]+)",
                              outcome.stderr + outcome.stdout)
            name = match[1] if match else None
        else:
            name = JOB + "-" + match[1]
        if name:
            explain_failure(name, project)
        raise RuntimeError(f"Apt collector execution failed{f' ({name})' if name else ''}")
    return json.loads(outcome.stdout)["metadata"]["name"]


# This runs with the same Cloud Run image, identity, secret and egress as the collector.
# It never logs the URL, response body, key, or raw exception.
NETWORK_PROBE = r"""
(async () => {
  const endpoint = new URL('https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev');
  try {
    const key = decodeURIComponent(process.env.MOLIT_API_KEY || '');
    if (!key) {
      console.log(JSON.stringify({molitProbe:true, outcome:'MOLIT_KEY_REQUIRED'}));
      return;
    }
    const month = new Date(Date.now() + 32400000).toISOString().slice(0,7).replace('-', '');
    endpoint.search = new URLSearchParams({serviceKey:key, LAWD_CD:'41290', DEAL_YMD:month, pageNo:'1', numOfRows:'1'});
    const response = await fetch(endpoint, {signal:AbortSignal.timeout(30000)});
    const body = await response.text();
    const serviceCode = body.match(/<(?:resultCode|returnReasonCode)>\s*([A-Za-z0-9_-]{1,24})\s*<\//)?.[1];
    console.log(JSON.stringify({molitProbe:true, outcome:'HTTP_RESPONSE', status:response.status, serviceCode}));
  } catch (error) {
    const allowed = new Set(['EAI_AGAIN','ENOTFOUND','EHOSTUNREACH','ENETUNREACH','ETIMEDOUT','ECONNRESET','ECONNREFUSED',
      'UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED',
      'SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID','EPROTO']);
    const causes = [error?.cause?.code, ...(error?.cause?.errors || []).map(item => item?.code)];
    const codes = [...new Set(causes.filter(code => allowed.has(code)))];
    const outcome = error.name === 'TimeoutError' ? 'TIMEOUT' :
      error.name === 'URIError' ? 'MOLIT_KEY_ENCODING_ERROR' : 'TRANSPORT_ERROR';
    console.log(JSON.stringify({molitProbe:true, outcome, codes}));
  }
})();
"""


EGRESS_COMPARISON = r"""
(async () => {
  const https = require('node:https');
  const endpoint = new URL('https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev');
  const key = decodeURIComponent(process.env.MOLIT_API_KEY || '');
  const emit = result => console.log(JSON.stringify({molitEgressComparison:true, ...result}));
  if (!key) { emit({outcome:'MOLIT_KEY_REQUIRED'}); return; }
  const month = new Date(Date.now() + 32400000).toISOString().slice(0,7).replace('-', '');
  endpoint.search = new URLSearchParams({serviceKey:key, LAWD_CD:'41290', DEAL_YMD:month, pageNo:'1', numOfRows:'1'});
  const allowed = new Set(['EAI_AGAIN','ENOTFOUND','EHOSTUNREACH','ENETUNREACH','ETIMEDOUT','ECONNRESET','ECONNREFUSED',
    'UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED',
    'SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID','EPROTO']);
  function code(error) {
    const value = error?.cause?.code || error?.code;
    return allowed.has(value) ? value : error?.name === 'TimeoutError' ? 'TIMEOUT' : 'TRANSPORT_ERROR';
  }
  function result(status, body) {
    return {status, serviceCode:body.match(/<(?:resultCode|returnReasonCode)>\s*([A-Za-z0-9_-]{1,24})\s*<\//)?.[1]};
  }
  const standard = (async () => {
    try {
      const response = await fetch(endpoint, {signal:AbortSignal.timeout(25000)});
      return result(response.status, await response.text());
    } catch (error) { return {error:code(error)}; }
  })();
  const ipv4 = new Promise(resolve => {
    let phase = 'dns';
    const request = https.get(endpoint,{family:4, signal:AbortSignal.timeout(25000)},response => {
      phase='response';
      response.setEncoding('utf8');
      let body = '';
      response.on('data',chunk=>{ if (body.length < 4096) body += chunk.slice(0,4096-body.length); });
      response.on('end',()=>resolve(result(response.statusCode,body)));
      response.on('error',error=>resolve({phase,error:code(error)}));
    });
    request.on('socket', socket => {
      socket.on('lookup', error => { if (!error) phase='tcp'; });
      socket.on('connect', () => { phase='tls'; });
      socket.on('secureConnect', () => { phase='http'; });
    });
    request.on('error',error=>resolve({phase,error:code(error)}));
  });
  const [defaultPath, ipv4Path] = await Promise.all([standard,ipv4]);
  emit({defaultPath, ipv4Path});
})().catch(() => console.log(JSON.stringify({molitEgressComparison:true,outcome:'PROBE_RUNTIME_UNAVAILABLE'})));
"""


FIRESTORE_PROBE = r"""
(async () => {
  const report = {aptFirestoreProbe:true};
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const database = process.env.FIRESTORE_DATABASE_ID;
  if (project !== 'busan-redevelopment' || !/^(?:\(default\)|[a-z][a-z0-9-]{2,62})$/.test(database || '') ||
      process.env.COLLECTOR_VALIDATE_ONLY !== 'true') {
    console.log(JSON.stringify({...report, outcome:'INVALID_REHEARSAL_CONFIGURATION'}));
    return;
  }
  try {
    const tokenResponse = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(8000)});
    report.tokenStatus = tokenResponse.status;
    if (tokenResponse.ok) {
      const {access_token} = await tokenResponse.json();
      const url = 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/' +
        encodeURIComponent(database) + '/documents/priceRevisions/active';
      const response = await fetch(url, {headers:{Authorization:'Bearer ' + access_token},signal:AbortSignal.timeout(12000)});
      report.restStatus = response.status;
      if (!response.ok) {
        const error = (await response.json()).error || {};
        const detail = (error.details || []).find(item => String(item['@type']).endsWith('/google.rpc.ErrorInfo')) || {};
        if (/^[A-Z0-9_]{1,80}$/.test(detail.reason || '')) report.reason = detail.reason;
        if (/^(?:datastore|firestore|serviceusage|resourcemanager)\.[a-zA-Z.]+$/.test(detail.metadata?.permission || '')) {
          report.permission = detail.metadata.permission;
        }
      }
    }
  } catch (_) {
    report.restTransportError = true;
  }
  const {Firestore} = require('@google-cloud/firestore');
  const db = new Firestore({projectId:project,databaseId:database});
  try {
    const document = await db.collection('priceRevisions').doc('active').get();
    report.sdkRead = document.exists;
    const revision = document.get('revision');
    const collection = document.get('collections.transactions');
    if (typeof revision === 'string' && /^r[0-9]{14}(?:_[a-f0-9]{8})?$/.test(revision) &&
        collection === 'transactions_' + revision) {
      report.sdkList = !(await db.collection(collection).limit(1).get()).empty;
    }
  } catch (error) {
    if (Number.isInteger(error?.code)) report.sdkCode = error.code;
    const permission = String(error?.details || error?.message || '').match(/\b(?:datastore|firestore|serviceusage|resourcemanager)\.[a-zA-Z.]+\b/)?.[0];
    if (permission) report.permission = permission;
  } finally {
    await db.terminate();
  }
  console.log(JSON.stringify(report));
})().catch(() => console.log(JSON.stringify({aptFirestoreProbe:true,outcome:'PROBE_RUNTIME_UNAVAILABLE'})));
"""


def run_probe(script, marker, keys, project=APT):
    name = run_collector("--task-timeout=120s", "--args=^~^-e~" + script.strip(), project=project)
    for attempt in range(8):
        for entry in execution_logs(name, project):
            record = entry.get("jsonPayload")
            if not isinstance(record, dict):
                try:
                    record = json.loads(entry.get("textPayload", ""))
                except ValueError:
                    continue
            if isinstance(record, dict) and record.get(marker) is True:
                result = {"execution": name, **{key: record[key] for key in keys if key in record}}
                print(json.dumps(result), flush=True)
                return result
        if attempt < 7:
            time.sleep(3)
    raise RuntimeError(f"No probe report found for {name}")


def report_production_collector():
    executions = cloud_json("run", "jobs", "executions", "list", "--job", "khousing-collector",
                            "--project", KH, "--region", REGION, "--limit", "3")
    recent = []
    for execution in executions:
        metadata = execution.get("metadata", {})
        status = execution.get("status", {})
        name = metadata.get("name")
        if not isinstance(name, str) or not re.fullmatch(r"khousing-collector-[a-z0-9]+", name):
            continue
        completed = next((item for item in status.get("conditions", []) if item.get("type") == "Completed"), {})
        diagnostics = error_codes(execution_logs(name, KH, "khousing-collector")) if completed.get("status") == "False" else []
        recent.append({"name":name, "diagnostics":diagnostics, "startTime":status.get("startTime"), "completed":completed.get("status"),
                       "failed":status.get("failedCount", 0), "succeeded":status.get("succeededCount", 0)})
    print(json.dumps({"existingCollectorExecutions":recent}), flush=True)


def diagnose_molit_egress():
    report_production_collector()
    run_probe(EGRESS_COMPARISON, "molitEgressComparison", ("outcome", "defaultPath", "ipv4Path"), project=KH)



def resume_when_molit_ready(attempts=1, interval=900):
    report_production_collector()
    # Match the deployed collector's page size and require a successful service response.
    probe = NETWORK_PROBE.replace("numOfRows:'1'", "numOfRows:'1000'")
    for attempt in range(1, attempts + 1):
        result = run_probe(probe, "molitProbe", ("outcome", "status", "serviceCode", "codes"), project=KH)
        status = result.get("status")
        service_code = result.get("serviceCode", "")
        if status == 200 and re.fullmatch(r"0+", service_code):
            resume_khousing_rehearsal()
            return

        transient = (service_code in ("01", "02", "04", "05") or
                     result.get("outcome") in ("TRANSPORT_ERROR", "TIMEOUT") or
                     status in (408, 500, 502, 503, 504))
        if not transient or attempt == attempts:
            print(json.dumps({"state": "WAITING_FOR_MOLIT" if transient else "MOLIT_REQUIRES_REVIEW",
                              "collectorStarted": False, "attempts": attempt}), flush=True)
            return
        print(json.dumps({"state": "WAITING_FOR_MOLIT", "collectorStarted": False,
                          "attempt": attempt, "nextCheckSeconds": interval}), flush=True)
        time.sleep(interval)


def execute_rehearsal(reuse_source_egress=False):
    check(gc("projects", "describe", APT, "--format=value(projectNumber)") == "432348267432",
          "Unexpected Apt project number")
    check(gc("projects", "describe", KH, "--format=value(projectNumber)") == "9298525505",
          "Unexpected K-Housing project number")
    check(active_revision() == EXPECTED, "Apt candidate revision changed")
    values, (secret_name, secret_version), image, network = collector_settings(reuse_source_egress)
    project = KH if reuse_source_egress else APT
    collector_path = "/app/dist/collector.cjs" if reuse_source_egress else "/app/market/dist/collector.cjs"
    database = apt_database()
    email = f"{IDENTITY}@{project}.iam.gserviceaccount.com"
    account_ids = cloud_json("iam", "service-accounts", "list", "--project", project, f"--filter=email={email}")
    if not any(account.get("email") == email for account in account_ids):
        gc("iam", "service-accounts", "create", IDENTITY, "--project", project,
           "--display-name=Apt Firestore collector validation")
    gc("projects", "add-iam-policy-binding", APT, "--member=serviceAccount:" + email,
       "--role=roles/datastore.viewer",
       f'--condition=title=apt-collector-read,expression=resource.name == "projects/{APT}/databases/{database}"')
    gc("secrets", "add-iam-policy-binding", secret_name, "--project", KH,
       "--role=roles/secretmanager.secretAccessor", "--member=serviceAccount:" + email, "--condition=None")
    values.update(GOOGLE_CLOUD_PROJECT=APT, FIRESTORE_DATABASE_ID=database,
                  SOURCE_ARCHIVE_BUCKET="busan-redevelopment-khousing-source",
                  COLLECTOR_VALIDATE_ONLY="true")
    print(f"Starting the Apt collector in read-only verification mode in {project}.", flush=True)
    configuration = {
        "apiVersion": "run.googleapis.com/v1",
        "kind": "Job",
        "metadata": {"name": JOB},
        "spec": {"template": {
            "metadata": {"annotations": {
                **network,
                "run.googleapis.com/secrets": f"apt-molit-key:projects/9298525505/secrets/{secret_name}",
            }},
            "spec": {"taskCount": 1, "parallelism": 1, "template": {"spec": {
                "serviceAccountName": email, "maxRetries": 0, "timeoutSeconds": "900",
                "containers": [{
                    "image": image, "command": ["node"], "args": [collector_path],
                    "resources": {"limits": {"cpu": "1", "memory": "1Gi"}},
                    "env": [{"name": key, "value": value} for key, value in values.items()] + [{
                        "name": "MOLIT_API_KEY",
                        "valueFrom": {"secretKeyRef": {"name": "apt-molit-key", "key": secret_version}},
                    }],
                }],
            }}},
        }},
    }
    with tempfile.TemporaryDirectory(prefix="apt-collector-") as directory:
        config = Path(directory) / "job.json"
        config.write_text(json.dumps(configuration))
        gc("run", "jobs", "replace", str(config), "--project", project, "--region", REGION)
    check_rehearsal(project)


def resume_khousing_rehearsal():
    check(active_revision() == EXPECTED, "Apt candidate revision changed")
    job = cloud_json("run", "jobs", "describe", JOB, "--project", KH, "--region", REGION)
    spec = job["spec"]["template"]["spec"]["template"]["spec"]
    check(spec.get("serviceAccountName") == f"{IDENTITY}@{KH}.iam.gserviceaccount.com",
          "Unexpected rehearsal service account")
    containers = spec.get("containers", [])
    check(len(containers) == 1 and containers[0].get("command") == ["node"] and
          containers[0].get("args") == ["/app/dist/collector.cjs"], "Unexpected rehearsal command")
    entries = containers[0].get("env", [])
    values = {entry["name"]: entry.get("value") for entry in entries}
    check(len(values) == len(entries) and values.get("COLLECTOR_VALIDATE_ONLY") == "true" and
          values.get("COLLECTOR_STAGE_ONLY") in (None, "false") and values.get("GOOGLE_CLOUD_PROJECT") == APT and
          values.get("FIRESTORE_DATABASE_ID") == apt_database(), "Unexpected rehearsal Firestore or write setting")
    print("Resuming the existing K-Housing collector in read-only Apt verification mode.", flush=True)
    check_rehearsal(KH)


def check_rehearsal(project):
    name = run_collector(project=project)
    for _ in range(12):
        reports = execution_logs(name, project)
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
                print(json.dumps({"execution": name, "project": project, "revision": EXPECTED, "baseline": record["baselineGroups"],
                                  "merged": record["groups"], "databaseWrites": 0}))
                return
        time.sleep(5)
    raise RuntimeError("No validation report was found for this execution")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--inspect-execution", help="Read redacted diagnostics from an existing execution")
    modes.add_argument("--network-probe", action="store_true", help="Make one diagnostic request from the existing rehearsal job")
    modes.add_argument("--khousing-egress", action="store_true", help="Rehearse in K-Housing Cloud Run while reading Apt Firestore")
    modes.add_argument("--khousing-firestore-probe", action="store_true", help="Diagnose Apt Firestore access from the existing K-Housing rehearsal")
    modes.add_argument("--resume-khousing-rehearsal", action="store_true", help="Validate and run the existing read-only rehearsal")
    modes.add_argument("--diagnose-molit-egress", action="store_true", help="Compare TCP/TLS paths and read existing collector execution statuses")
    modes.add_argument("--resume-when-molit-ready", action="store_true", help="Audit old executions and resume only if the MOLIT preflight succeeds")
    modes.add_argument("--watch-molit", action="store_true", help="Try up to 9 recovery probes, 15 minutes apart, then run the read-only rehearsal")
    arguments = parser.parse_args()
    try:
        if arguments.inspect_execution:
            explain_failure(arguments.inspect_execution)
        elif arguments.network_probe:
            run_probe(NETWORK_PROBE, "molitProbe", ("outcome", "status", "serviceCode", "codes"))
        elif arguments.khousing_firestore_probe:
            run_probe(FIRESTORE_PROBE, "aptFirestoreProbe", ("outcome", "tokenStatus", "restStatus", "reason",
                      "permission", "restTransportError", "sdkRead", "sdkList", "sdkCode"), project=KH)
        elif arguments.diagnose_molit_egress:
            diagnose_molit_egress()
        elif arguments.resume_when_molit_ready:
            resume_when_molit_ready()
        elif arguments.watch_molit:
            resume_when_molit_ready(attempts=9)
        elif arguments.resume_khousing_rehearsal:
            resume_khousing_rehearsal()
        else:
            execute_rehearsal(arguments.khousing_egress)
    except (RuntimeError, subprocess.CalledProcessError, KeyError, OSError) as error:
        print(f"Apt collector verification stopped: {error}", file=sys.stderr)
        sys.exit(1)
