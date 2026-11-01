#!/usr/bin/env bash
# One-time: turn on automatic cleanup so storage does not grow forever. Idempotent.
# - Firestore TTL on `expiresAt` for collectionCycles (30d), documents (365d since last seen),
#   analysisCache (30d). Events and telegramDeliveries are kept (history + duplicate guard).
# - Artifact Registry: keep the 10 newest images, delete images older than 30 days.
set -euo pipefail
PROJECT_ID="${PROJECT_ID:-busan-redevelopment}"
REGION="${REGION:-asia-south1}"
DATABASE="${DATABASE:-(default)}"

for COLLECTION in collectionCycles documents analysisCache; do
  gcloud firestore fields ttls update expiresAt --collection-group="$COLLECTION" \
    --enable-ttl --database="$DATABASE" --project="$PROJECT_ID" --async --quiet >/dev/null \
    && echo "TTL 설정 요청: $COLLECTION.expiresAt"
done

POLICY="$(mktemp)"
cat > "$POLICY" <<'JSON'
[
  {"name": "keep-recent", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 10}},
  {"name": "delete-old", "action": {"type": "Delete"}, "condition": {"olderThan": "30d"}}
]
JSON
gcloud artifacts repositories set-cleanup-policies kbusan-images --location="$REGION" \
  --project="$PROJECT_ID" --policy="$POLICY" --no-dry-run --quiet >/dev/null && echo "이미지 정리 정책 적용: kbusan-images"
rm -f "$POLICY"
echo RETENTION-OK
