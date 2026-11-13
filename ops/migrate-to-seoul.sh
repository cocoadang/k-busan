#!/usr/bin/env bash
# Moves apt.dsoom.com's Cloud Run service from asia-south1 (Mumbai) to asia-northeast3 (Seoul).
# Run once in Google Cloud Shell as the project owner:
#   bash ops/migrate-to-seoul.sh            # migrate
#   ROLLBACK=1 bash ops/migrate-to-seoul.sh # point traffic back to the Mumbai service
#
# What it does (idempotent; never prints secret values):
#  1. Reports where Firestore lives and creates the per-project news index.
#  2. Creates the Seoul image repository (+ cleanup policy) and lets the GitHub deploy account push.
#  3. Creates the same service in Seoul from the live Mumbai spec (same image, env, secrets,
#     service account, scaling) and the same public access, then checks it read-only.
#  4. Switches the Firebase Hosting rewrite for apt.dsoom.com to the Seoul service.
#  5. Points Cloud Scheduler jobs that call the Mumbai URL directly at the Seoul URL.
# The Mumbai service is left running untouched, so rollback is one command.
# No collection run or Telegram message is triggered.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-busan-redevelopment}"
SERVICE="${SERVICE:-busan-redevelopment-news-monitor}"
OLD_REGION="${OLD_REGION:-asia-south1}"
NEW_REGION="${NEW_REGION:-asia-northeast3}"
DOMAIN="${DOMAIN:-apt.dsoom.com}"
AR_REPO="kbusan-images"
DEPLOY_SA="kbusan-github-deploy@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud config set project "$PROJECT_ID" >/dev/null

if [ "${ROLLBACK:-}" = 1 ]; then FROM="$NEW_REGION"; TO="$OLD_REGION"; else FROM="$OLD_REGION"; TO="$NEW_REGION"; fi
url_of() { gcloud run services describe "$SERVICE" --region "$1" --format='value(status.url)'; }

TOKEN="$(gcloud auth print-access-token)"
api() { # api METHOD URL [JSON]
  local m="$1" u="$2"; shift 2
  local args=(-sS --fail-with-body -X "$m" "$u" -H "Authorization: Bearer $TOKEN"
    -H "x-goog-user-project: $PROJECT_ID" -H 'Content-Type: application/json')
  [ $# -gt 0 ] && args+=(--data "$1")
  curl "${args[@]}"
}
FH="https://firebasehosting.googleapis.com/v1beta1"

if [ "${ROLLBACK:-}" != 1 ]; then
  echo "== 1. Firestore =="
  DB="$(gcloud run services describe "$SERVICE" --region "$OLD_REGION" --format=json | python3 -c '
import json,sys
env=json.load(sys.stdin)["spec"]["template"]["spec"]["containers"][0].get("env",[])
print(next((e.get("value","") for e in env if e["name"]=="FIRESTORE_DATABASE_ID"),"") or "(default)")')"
  echo "데이터베이스: $DB / 위치: $(gcloud firestore databases describe --database="$DB" --format='value(locationId)')"
  gcloud firestore indexes composite create --database="$DB" --collection-group=documents \
    --field-config=field-path=matchedProjectIds,array-config=contains \
    --field-config=field-path=publishedAt,order=descending --async --quiet >/dev/null 2>&1 \
    && echo "구역별 뉴스 색인 생성 요청" || echo "구역별 뉴스 색인: 이미 있음"

  echo "== 2. 서울 이미지 저장소 =="
  gcloud artifacts repositories describe "$AR_REPO" --location "$NEW_REGION" >/dev/null 2>&1 || \
    gcloud artifacts repositories create "$AR_REPO" --repository-format=docker --location "$NEW_REGION" \
      --description="k-busan images" --quiet
  gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --location "$NEW_REGION" \
    --member="serviceAccount:$DEPLOY_SA" --role=roles/artifactregistry.writer --quiet >/dev/null
  POLICY="$(mktemp)"
  echo '[{"name":"keep-recent","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":10}},{"name":"delete-old","action":{"type":"Delete"},"condition":{"olderThan":"30d"}}]' > "$POLICY"
  gcloud artifacts repositories set-cleanup-policies "$AR_REPO" --location "$NEW_REGION" \
    --policy="$POLICY" --no-dry-run --quiet >/dev/null
  rm -f "$POLICY"; echo "저장소 준비: $NEW_REGION/$AR_REPO"

  echo "== 3. 서울 서비스 =="
  SPEC="$(mktemp --suffix=.yaml)"; chmod 600 "$SPEC"
  gcloud run services describe "$SERVICE" --region "$OLD_REGION" --format=export > "$SPEC"
  NEW_REGION="$NEW_REGION" python3 - "$SPEC" <<'PY'
import os, sys, yaml
path = sys.argv[1]
svc = yaml.safe_load(open(path))
meta = svc.setdefault('metadata', {})
meta.setdefault('labels', {})['cloud.googleapis.com/location'] = os.environ['NEW_REGION']
for m in (meta, svc['spec']['template'].get('metadata') or {}):
    ann = m.get('annotations') or {}
    for k in list(ann):
        if k.startswith('run.googleapis.com/') and ('source' in k or 'build' in k or k.endswith('/urls') or 'operation-id' in k):
            ann.pop(k)
    m.pop('namespace', None)
tmpl_meta = svc['spec']['template'].setdefault('metadata', {})
tmpl_meta.pop('name', None)  # let Seoul name its own first revision
svc['spec']['traffic'] = [{'latestRevision': True, 'percent': 100}]
yaml.safe_dump(svc, open(path, 'w'), sort_keys=False)
PY
  gcloud run services replace "$SPEC" --region "$NEW_REGION" --quiet >/dev/null
  rm -f "$SPEC"
  if gcloud run services get-iam-policy "$SERVICE" --region "$OLD_REGION" --format=json | grep -q '"allUsers"'; then
    gcloud run services add-iam-policy-binding "$SERVICE" --region "$NEW_REGION" \
      --member=allUsers --role=roles/run.invoker --quiet >/dev/null
  fi
  NEW_URL="$(url_of "$NEW_REGION")"
  echo "서울 서비스: $NEW_URL"
  for i in 1 2 3 4 5 6 7 8 9 10; do
    code="$(curl -s -o /tmp/kbusan-health.json -w '%{http_code}' "$NEW_URL/api/health" || true)"
    [ "$code" = 200 ] && break; sleep 10
  done
  python3 - <<'PY'
import json
h = json.load(open('/tmp/kbusan-health.json'))
assert h.get('status') == 'ok' and h.get('firestoreReady') is True, 'Seoul service is not healthy; nothing was switched.'
print('서울 서비스 점검 통과 (Firestore 연결 정상)')
PY
  curl -sf "$NEW_URL/api/registry" >/dev/null && curl -sf "$NEW_URL/" | grep -q '<div id="root">'
  for path in /api/health /api/storage/overview; do
    for r in "$OLD_REGION" "$NEW_REGION"; do
      t="$(curl -s -o /dev/null -w '%{time_total}' "$(url_of "$r")$path")"; echo "  응답시간 $r $path: ${t}s (Cloud Shell 기준)"
    done
  done
fi

TO_URL="$(url_of "$TO")"; FROM_URL="$(url_of "$FROM")"

echo "== 4. Firebase Hosting ($DOMAIN) → $TO =="
SITE="$(api GET "$FH/projects/$PROJECT_ID/sites" | python3 -c 'import json,sys; [print(s["name"].split("/")[-1]) for s in json.load(sys.stdin).get("sites",[])]' | while read -r s; do
  { api GET "$FH/projects/$PROJECT_ID/sites/$s/customDomains" 2>/dev/null; api GET "$FH/sites/$s/domains" 2>/dev/null; } | grep -q "\"[^\"]*$DOMAIN" && { echo "$s"; break; }
done || true)"
if [ -z "$SITE" ]; then
  echo "주의: $DOMAIN 을 쓰는 Firebase Hosting 사이트를 찾지 못했습니다. 도메인 연결 방식을 확인해야 합니다 (Mumbai 서비스는 그대로)."
else
  echo "사이트: $SITE"
  api GET "$FH/sites/$SITE/channels/live/releases?pageSize=1" > /tmp/kbusan-release.json
  read -r SRC_VERSION FILES NEW_CONFIG < <(SERVICE="$SERVICE" TO="$TO" python3 - <<'PY'
import json, os
rel = json.load(open('/tmp/kbusan-release.json'))['releases'][0]['version']
cfg = rel.get('config', {})
changed = 0
for r in cfg.get('rewrites', []):
    run = r.get('run')
    if run and run.get('serviceId') == os.environ['SERVICE'] and run.get('region') != os.environ['TO']:
        run['region'] = os.environ['TO']; changed += 1
print(rel['name'], rel.get('fileCount', '0') if changed else 'UNCHANGED', json.dumps({'config': cfg}, separators=(',', ':')))
PY
)
  if [ "$FILES" = UNCHANGED ]; then
    echo "이미 $TO 를 가리키고 있습니다."
  else
    if [ "${FILES:-0}" = 0 ]; then
      VERSION="$(api POST "$FH/sites/$SITE/versions" "$NEW_CONFIG" | python3 -c 'import json,sys;print(json.load(sys.stdin)["name"])')"
    else
      OP="$(api POST "$FH/sites/$SITE/versions:clone" "{\"sourceVersion\":\"$SRC_VERSION\",\"finalize\":false}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["name"])')"
      for i in $(seq 1 60); do
        api GET "$FH/$OP" > /tmp/kbusan-op.json
        python3 -c 'import json,sys;sys.exit(0 if json.load(open("/tmp/kbusan-op.json")).get("done") else 1)' && break; sleep 3
      done
      VERSION="$(python3 -c 'import json;print(json.load(open("/tmp/kbusan-op.json"))["response"]["name"])')"
      api PATCH "$FH/$VERSION?updateMask=config" "$NEW_CONFIG" >/dev/null
    fi
    api PATCH "$FH/$VERSION?updateMask=status" '{"status":"FINALIZED"}' >/dev/null
    api POST "$FH/sites/$SITE/releases?versionName=$VERSION" "{\"message\":\"Cloud Run rewrite -> $TO\"}" >/dev/null
    echo "Firebase Hosting 전환 완료: $VERSION"
  fi
fi

echo "== 5. Cloud Scheduler =="
FROM_HOSTS="$(gcloud run services describe "$SERVICE" --region "$FROM" --format=json | python3 -c '
import json,sys
d=json.load(sys.stdin); urls={d["status"]["url"]}
urls.update(json.loads(d["metadata"].get("annotations",{}).get("run.googleapis.com/urls","[]")))
print(" ".join(sorted(urls)))')"
for LOC in "$OLD_REGION" "$NEW_REGION" asia-northeast1 us-central1; do
  while read -r JOB URI; do
    [ -n "$JOB" ] || continue
    for H in $FROM_HOSTS; do
      case "$URI" in "$H"*)
        gcloud scheduler jobs update http "$JOB" --location "$LOC" --uri "${TO_URL}${URI#"$H"}" --quiet >/dev/null
        echo "스케줄러 변경: $JOB → ${TO_URL}${URI#"$H"}";;
      esac
    done
    case "$URI" in *"$DOMAIN"*) echo "스케줄러 그대로 (도메인 경유): $JOB";; esac
  done < <(gcloud scheduler jobs list --location "$LOC" --format='value(name.basename(),httpTarget.uri)' 2>/dev/null || true)
done

echo
echo "=== 아래 한 줄을 Claude 에게 붙여넣어 주세요 ==="
echo "KBUSAN_REGION_SWITCH to=$TO url=$TO_URL site=${SITE:-NOT_FOUND} rollback=${ROLLBACK:-0}"
