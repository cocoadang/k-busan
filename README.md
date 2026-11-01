# K-busan

Redevelopment monitoring application: TypeScript/React dashboard, public-source collectors, Firestore persistence, optional AI analysis and Telegram notifications.

## Development

Use Node.js 22. Install dependencies with `npm ci`. Run `npm run lint` and `npm run build`.

Safe mocked collector regression suite:

```sh
node --import tsx --test src/tests/newsCollector.test.ts src/tests/rssRecovery.test.ts src/tests/rssRestrictionChunks.test.ts src/tests/monitoringCollection.test.ts src/tests/cityPaginationRegression.test.ts src/tests/externalLinksRegression.test.ts src/tests/pdfAttachmentRegression.test.ts
```

Copy `.env.example` only into an isolated development environment. Never use production credentials for local tests. `npm run dev` starts the app; it is not a mock test. Keep internal scheduling disabled. Do not call `/api/jobs/poll` or notification routes during routine validation.

## Deployment workflow

Pushes and pull requests to `main` run type checking, all tests and the build (`.github/workflows/deploy.yml`). Production deploys only when **Run workflow** is pressed for `main` in the Actions tab:

1. Docker image built from a clean checkout (`Dockerfile`, Node 22, no local `node_modules`), pushed to Artifact Registry `kbusan-images`.
2. `gcloud run deploy --image --no-traffic --tag candidate`: only the code changes; env vars, secrets, service account, scaling and timeout on the service are kept.
3. Candidate checked read-only (`/api/health` with Firestore ready, `/api/registry`, `/`). Only then is traffic moved 100% to it. A failed check leaves the live revision untouched.

GitHub authenticates to Google Cloud through Workload Identity Federation limited to this repository's `main` branch; no key is stored. One-time setup: run `ops/setup-github-deploy.sh` in Cloud Shell and put the printed values in the workflow `env`. Collection and Telegram are never triggered by a deploy.

## Editing with Claude

Use the official GitHub integration and grant access only to this private repository after reviewing its permission request. Make changes on a branch, run checks, and submit a pull request. Do not share cloud credentials, logs, private data or database exports. No automatic deployment workflow or cloud authentication is included here.

## Operational safeguards

- **Single collection run at a time.** `/api/jobs/poll` and `/api/pipeline/run` take a Firestore lock (`locks/poll`, expires after `POLL_LOCK_TTL_MS`, default 15 min). An overlapping call gets HTTP 409 `POLL_ALREADY_RUNNING`.
- **Fail-closed everywhere in production.** With `NODE_ENV=production`, manual runs follow the same rules as the scheduler: no memory fallback, no Telegram without durable delivery records.
- **Telegram at-most-once.** Sends time out after 10 s. A timeout or dropped connection leaves the delivery `pending`; after 2 minutes it becomes `STALE_PENDING_NEEDS_REVIEW` and is never re-sent automatically. Plain failures retry on later cycles up to 3 attempts. Messages are capped at 4,000 characters.
- **Public APIs.** Read endpoints are cached in memory for `PUBLIC_CACHE_TTL_MS` (default 60 s) and cleared after each run and seed. `/api/storage/overview` returns a public view without Telegram chat IDs, message bodies, raw collector errors or per-item audits. 5xx responses carry fixed error codes; details stay in server logs.
- **AI analysis.** Model comes from `GEMINI_ANALYSIS_MODEL` (default `gemini-3.8-flash`; the old `GEMINI_MODEL` variable is ignored on purpose). Collected text is fenced as untrusted data in the prompt, 429/5xx responses retry with backoff, and at most `AI_MAX_ITEMS_PER_CYCLE` (default 80) items are analysed per cycle, newest first.
- **Collection cycle documents** are trimmed below 700 KB (Firestore limit 1 MiB) and record what was dropped in `truncated`.
- **Preview proxy** is opt-in: `PREVIEW_MODE=true` plus `PREVIEW_UPSTREAM_ORIGIN` (https). It is never active when `NODE_ENV=production`.
- **TLS for the association board.** The `start` script appends the RapidSSL TLS RSA CA G1 intermediate (expires 2027-11-02) for `dynamice.busan.go.kr`, which serves an incomplete chain. Replace it before expiry or when the site changes certificates.

Recommended Firestore TTL policies: `analysisCache.expiresAt`. Collections `documents`, `collectionCycles` and `telegramDeliveries` grow without cleanup.

## 데이터 보관 기간

Stored documents carry an `expiresAt` timestamp: collection cycles 30 days, news documents 365 days after they were last seen, AI analysis cache 30 days. Events and Telegram delivery records are kept (project history and duplicate-alert guard). Firestore deletes expired documents only after TTL policies are enabled; run `ops/setup-retention.sh` once in Cloud Shell. It also keeps only the 10 newest deploy images (images older than 30 days are removed).

## 운영 알림

When the scheduled run (`/api/jobs/poll`) fails twice in a row (Firestore unavailable, missing Gemini key, or a run error), one Telegram operations message is sent, repeated at most every 6 hours while it keeps failing, and a recovery message follows the next successful run. State is kept in `opsState/pollHealth`. A crash before the app answers (container fails to start) cannot be reported by the app itself; Cloud Scheduler then shows the failed attempts.

## Collector behavior

Access restrictions stop requests; the app must not bypass them. Failed or incomplete collection must not be recorded as proof that no new material exists. A valid attachment URL or HTML detail page does not prove PDF download or text extraction success. The collector does not implement OCR.

## Publication scope

The intended repository contains application source and development documentation. Excludes operational incident reports, audit records, real environment files, credentials, database exports, logs, generated builds and dependency directories.

## Reference material

Plan images, project history, aggregate plan/supply data, subscription comparisons and related tests are included for private development. Source availability and redistribution rights have not been independently verified for every item. Inclusion is not a license or proof of public availability. Keep this repository private and review rights before any further distribution. See docs/SOURCE_PROVENANCE.md.

## Tests

All suites pass: `node --import tsx --test src/tests/*.test.ts`. Plan-data tests check that capability flags (coordinates, building mappings) match the data actually present, since later phases onboarded verified coordinates for 우동3 and 삼익비치.
