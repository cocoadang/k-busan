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

GitHub commits do not deploy automatically. Obtain separate deployment authorization, check the live revision for concurrent changes, build frontend/server outputs, and package dependencies for the target Linux environment. Never deploy Windows node_modules. Preserve existing runtime settings, identity, secrets, limits and scheduler. Verify Ready status, intended traffic and read-only health after deployment. Collection and notification tests are separate consequential operations.

The npm lockfile supports development installs. The existing bun lockfile is retained for compatibility; do not assume different package managers resolve identical dependency trees.

## Editing with Claude

Use the official GitHub integration and grant access only to this private repository after reviewing its permission request. Make changes on a branch, run checks, and submit a pull request. Do not share cloud credentials, logs, private data or database exports. No automatic deployment workflow or cloud authentication is included here.

## Collector behavior

Access restrictions stop requests; the app must not bypass them. Failed or incomplete collection must not be recorded as proof that no new material exists. A valid attachment URL or HTML detail page does not prove PDF download or text extraction success. The collector does not implement OCR.

## Publication scope

The intended repository contains application source and development documentation. Excludes operational incident reports, audit records, real environment files, credentials, database exports, logs, generated builds and dependency directories. An unused standalone plan-check script is omitted. Operational report and standalone-script omissions do not affect application runtime.

## Reference material

Plan images, project history, aggregate plan/supply data, subscription comparisons and related tests are included for private development. Source availability and redistribution rights have not been independently verified for every item. Inclusion is not a license or proof of public availability. Keep this repository private and review rights before any further distribution. See docs/SOURCE_PROVENANCE.md.

## Known test limitation

The extended reference-data suite has one pre-existing expectation mismatch in unitPlanViewCommon.test.ts: its Samik Beach scenario expects interactive coordinates/building mappings to be absent, while the current configuration enables them. This import preserves application behavior and does not silently change that assertion. Collector regression tests, type checking and build passed locally with Node 22.23.4 and existing installed dependencies; a fresh lockfile-only install has not been revalidated.


## 사용자 직접 GitHub 업로드

목적지는 기존 비공개 https://github.com/cocoadang/k-busan 입니다. 마지막 확인 시 main은 안내 README만 있는 3423082d54bca6b09c31daf8b06a34c4d3d237b0 커밋이었습니다. 작업 시작 전 현재 상태가 달라졌다면 먼저 변경 내용을 확인하세요. 이 패키지는 자동 업로드나 배포를 수행하지 않습니다.

Git이 설치된 PC에서는 다음 방법이 가장 짧습니다. 사용자가 직접 터미널에서 기존 저장소를 새 폴더에 clone하고, 이 source 폴더의 내용 전체(숨김 이름 .gitignore와 .env.example 포함)를 clone 폴더 안으로 복사하세요. clone 폴더의 .git 폴더는 유지하세요. 일반 GitHub 로그인 창이 나오면 사용자가 직접 완료하며 토큰을 README나 명령에 넣지 마세요.

```powershell
git clone https://github.com/cocoadang/k-busan.git k-busan-user-clone
cd k-busan-user-clone
git switch -c import-source
# 여기서 압축을 푼 source 폴더의 내용 전체를 현재 clone 폴더 안에 복사합니다.
git add .
git diff --cached --stat
git commit -m "Import K-busan source and sanitized fixtures"
git push -u origin import-source
```

그다음 GitHub에서 import-source → main Pull Request를 만들고 파일 목록을 확인한 뒤 병합하세요. 기존 README는 이 README로 교체됩니다. 비공개 설정을 유지하세요. 새 Cloud 설정, 배포, 모델/Telegram 호출이나 Claude 앱 권한 변경은 포함되지 않습니다.

GitHub 웹 업로드는 파일당 25 MiB, 한 번에 100개 제한입니다. 전체 ZIP을 저장소에 올리면 소스 트리로 풀리지 않습니다. 먼저 압축을 풀어야 합니다. 이 PC의 별도 web-batches/batch-01~03 폴더는 100/100/89개로 나눠 같은 상대경로를 유지합니다. 각 batch 폴더 **안의 내용**을 저장소 루트의 Add file → Upload files에 순서대로 끌어다 놓으세요. batch 폴더 자체가 저장소 경로가 되지 않도록 확인하세요. 첫 회에 import-source 브랜치를 만든 뒤 같은 브랜치에 나머지를 올리고, 세 번 모두 완료한 후 PR을 병합하세요.

공식 제한 안내: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository

## AI Studio 원본 범위

사용자는 기존 자료를 Google AI Studio에 직접 등록했다고 확인했습니다. 이 패키지의 이미지 163개는 확보된 원본 소스의 public/assets/plans 이미지와 모두 바이트 단위로 일치합니다. 그러나 AI Studio 별도 원본 첨부 전체 목록과 소스 밖 첨부는 확보하지 못했습니다. 따라서 모든 최초 첨부가 포함됐다고 보장하지 않습니다. 현재 앱에 포함된 이미지와 데이터의 개발용 사본이며, 독립적인 출처·재배포 권리 검증은 완료되지 않았습니다.
