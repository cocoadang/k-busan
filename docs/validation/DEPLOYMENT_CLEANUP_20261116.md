# Deployment storage cleanup — 2026-11-16

User authorized removal of obsolete deployment files and paused scheduling while retaining production and recovery material. No collection, poll, analysis, Telegram or scheduler execution endpoints were called. Validation used resource metadata, image references, backup checksums and the public health endpoint.

Removed 5 image versions not referenced by any existing Cloud Run revision (3 diagnostic apt-processing images in Seoul, 2 unused k-busan images in Mumbai). All existing revision image references in both regions were verified present after deletion. Active production image, runtime template and traffic were unchanged. Historical referenced images were deliberately retained to preserve rollback. Docker layers are shared; image sizes cannot be summed to infer exact reclaimed registry bytes.

Removed 50 deployment source objects totaling 4,531,532,888 bytes across the two legacy Mumbai buckets. Kept the newest three original service sources in each bucket and copied them to recovery/cleanup-20261116/ (6 checksum-verified recovery copies). Recovery copies are outside the lifecycle delete prefixes. Existing 7-day soft deletion remains enabled, so savings lag deletion and the net eventual saving excludes added backup storage.

Deleted only the PAUSED asia-south1/busan-poll scheduler after saving its authenticated configuration privately. The enabled Seoul daily 08:00 Asia/Seoul scheduler is unchanged. Do not commit the scheduler backup: it includes its authentication header.

Both image repositories now explicitly keep all pre-existing revision digests, keep the five most recent versions per package, and delete other versions older than 30 days. Both legacy source buckets delete objects after 30 days only under services/busan-redevelopment-news-monitor/ and (where applicable) apt-processing-builds/. No unrelated prefixes are covered. Automatic policies run asynchronously; existing reference pins remain until explicitly reviewed.

The previous cost review incorrectly inferred missing image cleanup policies from a partial listing. Detailed GET confirmed older keep-10/30-day policies already existed; this operation replaced them with the protected-digest/keep-5 policy above.

Important: ops/setup-retention.sh and ops/migrate-to-seoul.sh contain older replace-all image cleanup configurations. Do not rerun their policy steps without merging the keep-deployed condition saved in deployment-cleanup-20261116.json; otherwise rollback digest protection could be lost. No runtime code was changed or redeployed by this cleanup.

All acceptance checks passed, including health/Firestore readiness and all original referenced images. See deployment-cleanup-20261116.json.
