#!/usr/bin/env bash
# One-time setup, run in Google Cloud Shell by the project owner.
# Lets GitHub Actions in cocoadang/k-busan (main branch only) deploy the existing Cloud Run
# service without any stored key (Workload Identity Federation). Idempotent: safe to re-run.
# It also turns monitoring back on: resumes paused Cloud Scheduler poll jobs and removes
# ENABLE_OFFICIAL_API=false. It does NOT deploy code and does NOT print secret values.
set -euo pipefail

REPO="cocoadang/k-busan"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
[ -n "$PROJECT_ID" ] || { echo "PROJECT_ID 를 지정하세요: PROJECT_ID=... bash setup.sh"; exit 1; }
gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

# 1) Find the existing Busan service (override with SERVICE=... REGION=...).
if [ -z "${SERVICE:-}" ] || [ -z "${REGION:-}" ]; then
  mapfile -t CANDIDATES < <(gcloud run services list --format='value(metadata.name,region)' | grep -i busan || true)
  if [ "${#CANDIDATES[@]}" -ne 1 ]; then
    echo "부산 정비사업 Cloud Run 서비스를 하나로 특정하지 못했습니다. 전체 목록:"
    gcloud run services list --format='table(metadata.name,region,status.url)'
    echo "다시 실행: SERVICE=<이름> REGION=<리전> bash setup.sh"; exit 1
  fi
  read -r SERVICE REGION <<<"${CANDIDATES[0]}"
fi
SERVICE_URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
RUNTIME_SA="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(spec.template.spec.serviceAccountName)')"
RUNTIME_SA="${RUNTIME_SA:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"
echo "서비스: $SERVICE ($REGION) $SERVICE_URL / 실행 계정: $RUNTIME_SA"

gcloud services enable artifactregistry.googleapis.com iamcredentials.googleapis.com sts.googleapis.com run.googleapis.com --quiet

# 2) Image repository.
AR_REPO="kbusan-images"
gcloud artifacts repositories describe "$AR_REPO" --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$AR_REPO" --repository-format=docker --location "$REGION" --description="k-busan images" --quiet

# 3) Deploy service account (least privilege).
DEPLOY_SA="kbusan-github-deploy@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts describe "$DEPLOY_SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create kbusan-github-deploy --display-name="k-busan GitHub deploy" --quiet
gcloud run services add-iam-policy-binding "$SERVICE" --region "$REGION" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/run.developer --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/iam.serviceAccountUser --quiet >/dev/null
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --location "$REGION" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/artifactregistry.writer --quiet >/dev/null

# 4) GitHub OIDC trust limited to this repository's main branch.
POOL="kbusan-github"; PROVIDER="github-main"
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="k-busan GitHub" --quiet
gcloud iam workload-identity-pools providers describe "$PROVIDER" --workload-identity-pool="$POOL" --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --workload-identity-pool="$POOL" --location=global \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${REPO}' && assertion.ref=='refs/heads/main'" --quiet
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" \
  --quiet >/dev/null

# 5) Monitoring on: resume paused poll jobs, report if none exists.
FOUND=0
for LOC in $(printf '%s\n' "$REGION" asia-northeast3 asia-northeast1 us-central1 | awk '!seen[$0]++'); do
  while read -r JOB STATE URI; do
    [ -n "$JOB" ] || continue
    case "$URI" in *"/api/jobs/poll"*) ;; *) continue ;; esac
    case "$URI" in "$SERVICE_URL"*|*api.dsoom.com*|*k-busan*) ;; *) continue ;; esac
    FOUND=1
    if [ "$STATE" = "PAUSED" ]; then gcloud scheduler jobs resume "$JOB" --location "$LOC" --quiet && echo "재개함: $JOB"; else echo "스케줄러 정상: $JOB ($STATE)"; fi
  done < <(gcloud scheduler jobs list --location "$LOC" --format='value(name.basename(),state,httpTarget.uri)' 2>/dev/null || true)
done
[ "$FOUND" = 1 ] || echo "주의: /api/jobs/poll 을 호출하는 Cloud Scheduler 작업을 찾지 못했습니다."

OFFICIAL_FLAG="$(gcloud run services describe "$SERVICE" --region "$REGION" --format=json | python3 -c '
import json, sys
env = json.load(sys.stdin)["spec"]["template"]["spec"]["containers"][0].get("env", [])
print(next((e.get("value", "") for e in env if e.get("name") == "ENABLE_OFFICIAL_API"), ""))')"
if [ "$OFFICIAL_FLAG" = "false" ]; then
  gcloud run services update "$SERVICE" --region "$REGION" --remove-env-vars=ENABLE_OFFICIAL_API --quiet && echo "새올 공식 API 수집을 다시 켰습니다."
fi

echo
echo "=== 아래 한 줄을 Claude 에게 붙여넣어 주세요 ==="
echo "KBUSAN_DEPLOY project=$PROJECT_ID number=$PROJECT_NUMBER region=$REGION service=$SERVICE url=$SERVICE_URL scheduler_found=$FOUND"
