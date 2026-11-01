# Busan Redevelopment News Monitor - Dedicated Firestore Schema Specification

> **현재 기준 안내 (2026-11):** 이 문서는 초기 설계안입니다. 실제 컬렉션 이름과 필드는
> `src/schema/firestoreSchema.ts`의 `FIRESTORE_COLLECTIONS`가 기준입니다:
> `projects`, `documents`, `events`, `collectionCycles`, `telegramDeliveries`, `areaDevelopments`,
> `planVersions`, `unitTypes`, `planAssets`, `sitePlans`, `buildings`, `analysisCache`, `locks`.
> 아래의 `raw_collected_items` 등 이름은 코드에 존재하지 않습니다.

## 1. 개요 및 원칙

본 프로젝트는 **부산 재개발(촉진3구역, 우동3구역)** 전용 독립 시스템으로 설계되었습니다.
- **기존 Firestore 재사용 금지**: K-News, K-Housing, KTX 등 기존 프로젝트의 Firestore 데이터베이스나 컬렉션과 완전히 분리된 전용 Firestore 데이터베이스를 사용합니다.
- **관심사 분리 (Separation of Concerns)**:
  1. 원본 수집 데이터 (`raw_collected_items`)
  2. Gemini AI 분석 데이터 (`analyzed_articles`)
  3. 사건 단위 병합 클러스터 (`redevelopment_events`)
  4. 알림 전송 이력 (`telegram_dispatches`)
  5. 스케줄러 실행 감사로그 (`poll_job_runs`)
- **이벤트 중복 병합 (Event Deduplication)**: 동일 이슈에 대한 여러 언론사 기사 및 고시를 단일 `redevelopment_events` 단위로 묶어, Telegram에 중복 알림이 전송되는 것을 원천 차단합니다.

---

## 2. 컬렉션 구조 상세

```text
Firestore Root (Dedicated DB)
├── redevelopment_projects/      [정비사업 Registry 마스터]
│   ├── chokjin-3
│   └── udong-3
│
├── raw_collected_items/         [수집된 원본 기사 및 행정고시]
│   └── {sha256(sourceUrl + projectId)}
│
├── analyzed_articles/           [Gemini AI 관련성/13대 카테고리/중요도 분석 결과]
│   └── {rawItemId}
│
├── redevelopment_events/        [사건 단위 중복 병합 클러스터 - 텔레그램 발송 단위]
│   └── {sha256(projectId + '_' + eventClusterSignature)}
│
├── telegram_dispatches/         [텔레그램 발송 이력 및 상태]
│   └── {dispatchId}
│
└── poll_job_runs/               [Cloud Scheduler /api/jobs/poll 실행 감사로그]
    └── {runId}
```

---

## 3. 컬렉션별 필드 정의

### 3.1 `redevelopment_projects` (정비사업 레지스트리)
- **문서 ID**: `project.id` (예: `chokjin-3`, `udong-3`)
- **필드**:
  - `id`: string (필수)
  - `name`: string (정식 명칭, 필수)
  - `aliases`: string[] (검색 별칭 목록, 필수)
  - `locationKeywords`: string[] (지리/위치 키워드, 필수)
  - `district`: string (자치구, 예: '부산진구', '해운대구', 필수)
  - `city`: string ('부산광역시', 필수)
  - `stage`: string (사업단계)
  - `builder`: string (시공사/브랜드)
  - `estimatedUnits`: number (세대수)
  - `officialSourceUrls`: string[] (고시공고 링크)
  - `isActiveMonitoring`: boolean
  - `updatedAt`: string (ISO-8601)

### 3.2 `raw_collected_items` (원본 수집자료)
- **문서 ID**: `sha256(sourceUrl + projectId)` (수집 멱등성 보장)
- **필드**:
  - `id`: string
  - `projectId`: string ('chokjin-3' | 'udong-3')
  - `sourceTier`: string ('official' | 'news')
  - `sourceName`: string (매체명: '부산시보', '부산일보' 등)
  - `sourceUrl`: string (원문 링크)
  - `title`: string
  - `content`: string
  - `publishedAt`: string (원문 발행 시각)
  - `collectedAt`: string (수집 시각)
  - `matchedKeywords`: string[]
  - `status`: string ('pending_analysis' | 'analyzed' | 'discarded_irrelevant')

### 3.3 `analyzed_articles` (AI 분석 결과)
- **문서 ID**: `rawItemId`
- **필드**:
  - `id`: string
  - `rawItemId`: string
  - `projectId`: string
  - `sourceTier`: string ('official' | 'news')
  - `sourceName`: string
  - `sourceUrl`: string
  - `title`: string
  - `publishedAt`: string
  - `isRelevant`: boolean (구역 실질 관련성 여부)
  - `relevanceExplanation`: string
  - `categories`: string[] (13대 카테고리)
  - `primaryCategory`: string
  - `importance`: number (1 ~ 5)
  - `importanceReason`: string
  - `oneLineSummary`: string
  - `keyPoints`: string[]
  - `eventClusterSignature`: string (사건 정규화 키)
  - `mergedIntoEventId`: string (클러스터 이벤트 문서 ID)
  - `analyzedAt`: string

### 3.4 `redevelopment_events` (이벤트 단위 병합)
- **문서 ID**: `sha256(projectId + '_' + eventClusterSignature)`
- **필드**:
  - `id`: string
  - `projectId`: string
  - `eventClusterSignature`: string
  - `headline`: string (대표 헤드라인)
  - `summary`: string (종합 브리핑 요약)
  - `primaryCategory`: string
  - `categories`: string[]
  - `maxImportance`: number (1 ~ 5, **Telegram 발송 기준: >= 4**)
  - `sourceTier`: string ('official' | 'news' | 'mixed')
  - `hasOfficialNotice`: boolean
  - `articles`: array of { rawItemId, title, sourceName, sourceUrl, publishedAt, sourceTier, importance }
  - `articleCount`: number
  - `firstSeenAt`: string
  - `lastUpdatedAt`: string
  - `telegramDispatched`: boolean
  - `telegramDispatchedAt`: string
  - `telegramMessageId`: string

### 3.5 `telegram_dispatches` (전송 이력)
- **문서 ID**: UUID
- **필드**:
  - `id`: string
  - `eventId`: string
  - `projectId`: string
  - `importance`: number
  - `chatId`: string
  - `messageText`: string
  - `dispatchedAt`: string
  - `status`: string ('success' | 'failed')

### 3.6 `poll_job_runs` (스케줄러 감사 로그)
- **문서 ID**: `run_{timestamp}_{random}`
- **필드**:
  - `id`: string
  - `triggeredBy`: string ('cloud_scheduler' | 'manual_dry_run')
  - `startedAt`: string
  - `completedAt`: string
  - `status`: string ('success' | 'failed' | 'running')
  - `itemsCollected`: number
  - `itemsAnalyzed`: number
  - `eventsCreated`: number
  - `eventsMerged`: number
  - `telegramSent`: number
  - `durationMs`: number
  - `errors`: string[]

---

## 4. 복합 인덱스 (Composite Indexes)

다음과 같은 인덱스가 `firestore.indexes.json`에 정의됩니다:

1. `raw_collected_items`: `projectId` (ASC) + `publishedAt` (DESC)
2. `raw_collected_items`: `status` (ASC) + `collectedAt` (ASC)
3. `analyzed_articles`: `projectId` (ASC) + `importance` (DESC) + `publishedAt` (DESC)
4. `redevelopment_events`: `projectId` (ASC) + `lastUpdatedAt` (DESC)
5. `redevelopment_events`: `telegramDispatched` (ASC) + `maxImportance` (DESC) + `lastUpdatedAt` (DESC)

---

## 5. Security Rules 원칙 (firestore.rules)

- 백엔드(Cloud Run 서버)는 Admin SDK / 서버 인증을 통해 안전하게 쓰기/읽기를 수행합니다.
- 클라이언트 직접 쓰기는 완전 차단하며, 인증된 관리자 또는 읽기 전용으로 안전하게 제약합니다.
