# K-busan

Redevelopment monitoring dashboard and collectors. Production baseline: Cloud Run revision `busan-redevelopment-news-monitor-00053-x5n` (2026-10-31).

## Development

Use Node.js 22 (validated with 22.23.4) and the committed lockfile. Run `npm ci`, `npm run lint`, and `npm run build`. Do not copy production credentials into this repository.

Safe collector regression suite (mocked external requests):

```sh
node --import tsx --test src/tests/newsCollector.test.ts src/tests/rssRecovery.test.ts src/tests/rssRestrictionChunks.test.ts src/tests/monitoringCollection.test.ts src/tests/cityPaginationRegression.test.ts src/tests/externalLinksRegression.test.ts src/tests/pdfAttachmentRegression.test.ts
```

`npm run dev` starts the application, not an isolated test. Use a separate development environment without production credentials. Never invoke `/api/jobs/poll` or send Telegram notifications during routine code validation.

## Production and deployment

Project: `busan-redevelopment`; service: `busan-redevelopment-news-monitor`; region: `asia-south1`. Existing Scheduler runs daily at 08:00 Asia/Seoul. Preserve secrets, service identity, runtime settings, budgets and scheduler configuration. GitHub commits do not automatically deploy.

The existing deployment uses prebuilt frontend/server artifacts and Linux dependencies with Cloud Run Node.js 22. A fresh clone must build and package dependencies for Linux; do not upload Windows node_modules. Before deployment, compare the current production revision with the intended baseline and obtain deployment authorization. Verify Ready state, traffic, source hashes and read-only health afterwards. Do not trigger collection just to validate deployment.

## Known limits

Google News can return restricted HTTP 503 responses. The collector stops on restriction signals; it does not bypass access limits. Attachment links and HTML detail collection do not establish PDF download or PDF text extraction success. No OCR feature is added by this baseline.

## Claude workflow

Grant Claude access only to this private repository through the official GitHub integration, after the owner approves the requested permissions. Work on branches and review pull requests. Do not provide Cloud credentials or real database exports. Code changes, deployment and actual collection are separate actions requiring their own scope.

## Domain

Requested hostname: `apt.dsoom.com`. Connection is pending hosting/DNS verification; do not assume it is active. Do not change unrelated subdomains.

