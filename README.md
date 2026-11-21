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

When an authorized apt.dsoom.com change is ready, complete validation, merge, run the production workflow, and verify the live site. The maintainer has authorized routine deployments without a separate pre-deployment confirmation. For routine changes requested for apt.dsoom.com, the task includes production deployment. Do not stop after pushing source or passing CI. Start the production workflow on `main` and wait for its terminal result. Then verify the live revision and exercise the changed feature on apt.dsoom.com. Send a single final report with the outcome, live verification, and the workflow link. Send interim updates only for a blocker that requires maintainer action.

Pushes and pull requests to `main` run type checking, all tests and the build (`.github/workflows/deploy.yml`). Production deploys only when **Run workflow** is pressed for `main` in the Actions tab:

1. Docker image built from a clean checkout (`Dockerfile`, Node 22, no local `node_modules`), pushed to Artifact Registry `kbusan-images`.
2. `gcloud run deploy --image --no-traffic --tag candidate`: only the code changes; env vars, secrets, service account, scaling and timeout on the service are kept.
3. Candidate checked read-only (`/api/health` with Firestore ready, `/api/registry`, `/`). Only then is traffic moved 100% to it. A failed check leaves the live revision untouched.

GitHub authenticates to Google Cloud through Workload Identity Federation limited to this repository's `main` branch; no key is stored. One-time setup: run `ops/setup-github-deploy.sh` in Cloud Shell and put the printed values in the workflow `env`. Collection and Telegram are never triggered by a deploy.

## Editing with Claude

Use the official GitHub integration and grant access only to this private repository after reviewing its permission request. Make changes on a branch, run checks, and submit a pull request. Do not share cloud credentials, logs, private data or database exports. Production deploys only through the manual **Run workflow** described above; no cloud key is stored in the repository.

## Operational safeguards

- **Single collection run at a time.** `/api/jobs/poll` and `/api/pipeline/run` take a Firestore lock (`locks/poll`, expires after `POLL_LOCK_TTL_MS`, default 15 min). An overlapping call gets HTTP 409 `POLL_ALREADY_RUNNING`.
- **Fail-closed everywhere in production.** With `NODE_ENV=production`, manual runs follow the same rules as the scheduler: no memory fallback, no Telegram without durable delivery records.
- **Telegram at-most-once.** Sends time out after 10 s. A timeout or dropped connection leaves the delivery `pending`; after 2 minutes it becomes `STALE_PENDING_NEEDS_REVIEW` and is never re-sent automatically. Plain failures retry on later cycles up to 3 attempts. Messages are capped at 4,000 characters.
- **Public APIs.** Read endpoints are cached in memory for `PUBLIC_CACHE_TTL_MS` (default 30 min) and cleared after each run and seed. Public data endpoints send `Cache-Control: public, max-age=60, s-maxage=300`; health/status/admin routes and all errors are `no-store`. Responses are gzip-compressed.
- **Rate limits.** Public reads: 120/min per client (first `X-Forwarded-For` hop) and 1,200/min per instance; admin calls 20/min per instance.
- **Plan images.** Each `public/assets/plans` JPG/JFIF/PNG has a pre-built `<file>.webp` sibling (about half the size). Browsers that accept WebP get it automatically (`Vary: Accept`). When adding a plan image, also add its `.webp` (e.g. `cwebp -q 82`); without one the original is served.
- **Shareable tabs.** The dashboard keeps the tab and project in the URL hash (`#/news/udong-3`), so refresh, links and the back button keep the view. `/api/storage/overview` returns a public view without Telegram chat IDs, message bodies, raw collector errors or per-item audits. 5xx responses carry fixed error codes; details stay in server logs.
- **AI analysis.** Model comes from `GEMINI_ANALYSIS_MODEL` (default `gemini-3.8-flash`; the old `GEMINI_MODEL` variable is ignored on purpose). Collected text is fenced as untrusted data in the prompt, 429/5xx responses retry with backoff, and at most `AI_MAX_ITEMS_PER_CYCLE` (default 80) items are analysed per cycle, newest first.
- **Collection cycle documents** are trimmed below 700 KB (Firestore limit 1 MiB) and record what was dropped in `truncated`.
- **Preview proxy** is opt-in: `PREVIEW_MODE=true` plus `PREVIEW_UPSTREAM_ORIGIN` (https). It is never active when `NODE_ENV=production`.
- **TLS for the association board.** The `start` script appends the RapidSSL TLS RSA CA G1 intermediate (expires 2027-11-02) for `dynamice.busan.go.kr`, which serves an incomplete chain. Replace it before expiry or when the site changes certificates.

## 서울 리전 이전

`ops/migrate-to-seoul.sh` moves the service from asia-south1 (Mumbai) to asia-northeast3 (Seoul). Run it once in Cloud Shell as the project owner. It creates the Seoul service from the live spec, checks it read-only, then switches the Firebase Hosting rewrite for apt.dsoom.com and any Cloud Scheduler job that calls the Mumbai URL. The Mumbai service keeps running; `ROLLBACK=1 bash ops/migrate-to-seoul.sh` switches back. The deploy workflow deploys to Seoul as soon as the service exists there, otherwise to Mumbai. Delete the Mumbai service only after a few days of normal operation.

## 데이터 보관 기간

Stored documents carry an `expiresAt` timestamp: collection cycles 30 days, news documents 365 days after they were last seen, AI analysis cache 30 days. Events and Telegram delivery records are kept (project history and duplicate-alert guard). Firestore deletes expired documents only after TTL policies are enabled; run `ops/setup-retention.sh` once in Cloud Shell. It also keeps only the 10 newest deploy images (images older than 30 days are removed).

## 운영 알림

Collection runs once a day at 08:00 KST (Cloud Scheduler job `busan-redevelopment-poll-30m`; the name is historical, the schedule is daily). Failed scheduled runs are tracked in `opsState/pollHealth` and logged as `[PollHealth] Scheduled run failed` in Cloud Logging. Telegram failure/recovery messages are **off by default**; set `OPS_TELEGRAM_ALERTS=true` on the Cloud Run service to turn them on (sent on the first failure, repeated at most every 6 hours, plus one recovery message). Event alerts (importance ≥ 4) are unaffected.

## Collector behavior

Access restrictions stop requests; the app must not bypass them. Failed or incomplete collection must not be recorded as proof that no new material exists. A valid attachment URL or HTML detail page does not prove PDF download or text extraction success. The collector does not implement OCR.

## 새 정비구역 추가 방법

수집·분석·알림 설정은 모두 `src/registry/redevelopmentRegistry.ts`의 `REDEVELOPMENT_SEED_PROJECTS` 항목 하나로 정해집니다(타입: `src/types/redevelopment.ts`의 `RedevelopmentProject`). 새 구역은 이 배열에 항목만 추가하면 되고, 수집기·파이프라인·알림 코드는 고칠 필요가 없습니다.

현재 단계(`stage`·`nextStage`)는 진행이력 기반 계산 결과를 `src/registry/seedProjectStages.ts`에 적어 둔 값을 씁니다(브라우저 첫 화면 번들에서 이력 데이터를 빼기 위함). 구역을 추가하거나 진행이력을 바꾼 뒤 `src/tests/seedProjectStages.test.ts`가 실패하면, 실패 메시지에 나온 값으로 이 표를 갱신합니다.

필수:
- `id`: 고유 식별자(예: `'gwacheon-10'`). 핑거프린트·이벤트 ID에 쓰이므로 정한 뒤에는 바꾸지 않습니다.
- `name`, `aliases`, `locationKeywords`, `district`, `city`: 매칭과 관련성 판정에 씁니다. 부산시 고시와 새올 수집은 `city: '부산광역시'`인 구역에만, 과천시 고시 수집은 `city: '과천시'`인 구역에만 적용됩니다.
- `isActiveMonitoring: true`: 수집 대상에 넣습니다.
- `createdAt`, `updatedAt`.

선택(수집·알림 동작):
- `shortName`: Telegram 머리말 `[shortName]`에 쓰는 짧은 이름입니다. 없으면 `name`을 씁니다.
- `newsSearchTerms`: Google News RSS 검색어 목록입니다. 지정하면 별칭 OR 검색 대신 검색어마다 개별로 질의합니다(`when:7d` 질의와 기간 없는 질의를 각각 보냅니다). 구두점이 많은 별칭에 씁니다.
- `associationBoard`: 부산 정비사업 통합홈페이지(dynamice.busan.go.kr) 조합 게시판 설정입니다(`listUrl`, `boardId`, `areaId`, `detailMenuNo`, `titlePattern`, `sourceName`, `auditSourceName`, `matchedKeywords`). 이 값이 있는 구역만 조합 게시판을 수집합니다.
- `relatedReportRules`: 같은 날 같은 사안을 다룬 보도를 하나로 묶는 규칙입니다(`key`, `allOf` 정규식 목록, 제외 정규식 `noneOf`).

화면 표시용 메타데이터(`stage`, `builder`, `officialSourceUrls` 등)와 단지계획·진행이력 데이터(`src/data/`)는 따로 관리합니다.

## Publication scope

The intended repository contains application source and development documentation. Excludes operational incident reports, audit records, real environment files, credentials, database exports, logs, generated builds and dependency directories.

## Reference material

Plan images, project history, aggregate plan/supply data, subscription comparisons and related tests are included for private development. Source availability and redistribution rights have not been independently verified for every item. Inclusion is not a license or proof of public availability. Keep this repository private and review rights before any further distribution. See docs/SOURCE_PROVENANCE.md.

## Tests

All suites pass: `node --import tsx --test src/tests/*.test.ts`. Plan-data tests check that capability flags (coordinates, building mappings) match the data actually present, since later phases onboarded verified coordinates for 우동3 and 삼익비치.

## OpenAI analysis (2026-11-15)
Active text analysis uses OpenAI Responses, `gpt-6-luna`, reasoning none, no tools or automatic retries. `OPENAI_API_KEY` must be bound server-side; `OPENAI_MODEL` optionally overrides the model. Legacy Gemini-named internal fields remain for stored-data/API compatibility; public `aiProvider` and `aiModel` report the actual provider. Existing collection, fact validation, dispatch rules and budget ceilings are preserved. Input reservations include a conservative local UTF-8 bound; output usage includes reasoning once. Gemini keys are retained only for rollback and inactive legacy paths.

GPT-6 Luna의 실제 문서·운영 경로 검증 및 Gemini 재비교(2026-11-15): [검증 보고서](docs/validation/LUNA_COMPARISON.md). 공고 표본 정확도와 운영 뉴스의 확인·재시도 상태를 구분해 기록했습니다.

뉴스 확인·재시도 16건의 원문 검토·운영 정리 결과: [건별 처리와 검증 기록](docs/validation/NEWS_REVIEW16.md).
