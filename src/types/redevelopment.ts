/**
 * Busan Redevelopment News Monitor - Domain Types
 * Phase 1: Data model & type definitions
 */

/**
 * 공식 행정자료와 언론 보도를 구분하는 Source Tier
 * - official: 시청/구청 고시·공고, 정비사업 고시문, 국토교통부 등 행정 공식 문서
 * - news: 일간지, 경제지, 지역 언론사 등 언론 보도 기사
 */
export type SourceTier = 'official' | 'news';

/**
 * Phase 4A: 확장된 출처 분류 등급 (진행이력 SSOT 모델)
 * - official: 시청/구청 고시·공고, 정비사업 고시문 등 행정 공식 문서 ("공식자료")
 * - association: 조합 공고, 사업주체 공식 안내문 등 ("사업주체")
 * - news: 일간지, 경제지, 지역 언론사 등 언론 보도 기사 ("언론보도")
 * - other: 기타 참고 자료 ("기타 출처")
 * - mixed: 복수 출처 병합
 */
export type EventSourceTier = 'official' | 'association' | 'news' | 'other' | 'mixed';

/**
 * Phase 4A: 이력 검증 상태
 * - verified: 지자체 공식 고시·공고 등 확인된 공인 자료
 * - supported: 조합/사업주체 공식 자료 또는 다수 언론 교차 확인 자료
 * - unverified: 단일 미확인 보도 또는 확인 필요 자료
 */
export type VerificationStatus = 'verified' | 'supported' | 'unverified';

/**
 * Phase 4A: 원천 출처 추적 (Provenance) 메타데이터
 */
export interface EventProvenance {
  originalSourceId?: string;
  sourceCollection?: string;
  collector?: string;
  notes?: string;
  collectedAt?: string;
  documentNumber?: string;
  department?: string;
  sourceType?: string;
  documentUrlVerified?: boolean;
  documentIdentifierVerified?: boolean;
  actorType?: 'official' | 'association' | 'constructor' | 'court';
}

/**
 * Phase 2D Source Type (출처 상세 구분)
 * - official-api: 공공데이터포털/새올고시정보 등 공식 Open API
 * - official-web: 지자체 공식 웹 고시공고 페이지
 * - news-rss: 언론사/포털 공식 RSS 피드
 * - news-api: 포털 뉴스 검색 API
 */
export type SourceType = 'official-api' | 'official-web' | 'news-rss' | 'news-api';

/**
 * Phase 2 관련성 판정 상태
 * - relevant: 해당 정비사업과 직접적이고 실질적으로 연관된 자료 (이벤트 생성 대상)
 * - irrelevant: 단순 지명 언급, 일반 부동산 시황, 타 구역 기사 등 무관한 자료 (이벤트 생성 금지)
 * - uncertain: 연관성 가능성이 있으나 단정할 수 없는 자료 (Telegram 발송 금지, 검토 대상 보관)
 */
export type RelatednessStatus = 'relevant' | 'irrelevant' | 'uncertain';

/**
 * 정비사업 분석 13대 표준 카테고리
 */
export type AnalysisCategory =
  | '사업단계'
  | '사업성'
  | '공사비'
  | '분담금'
  | '시공사'
  | '설계'
  | '인허가'
  | '총회'
  | '분쟁'
  | '분양'
  | '청약'
  | '주변개발'
  | '시장';

export const ALL_ANALYSIS_CATEGORIES: readonly AnalysisCategory[] = [
  '사업단계',
  '사업성',
  '공사비',
  '분담금',
  '시공사',
  '설계',
  '인허가',
  '총회',
  '분쟁',
  '분양',
  '청약',
  '주변개발',
  '시장',
] as const;

/**
 * 중요도 평가 척도 (1 ~ 5)
 * - 5: 결정적 변화 (시공사 교체/선정, 조합설립인가 취소/인가, 관리처분인가, 공사중단, 랜드마크 고시 등)
 * - 4: 주요 사업 변곡점 (시공사 입찰, 공사비 분쟁 본격화, 정비계획 변경 고시, 정기총회 핵심안건 통과 등) -> [Telegram 기본 발송 기준 >= 4]
 * - 3: 일반 사업 진척 (정기 총회 공고, 환경영향평가 공람, 일반 인허가 신청 등)
 * - 2: 통상 보도 / 주변 시황 (인근 부동산 시세 언급, 기획 기사 내 단순 언급)
 * - 1: 단순 언급 / 노이즈 (재개발 일반 통계 기사 내 단순 이름 나열 등)
 */
export type ImportanceLevel = 1 | 2 | 3 | 4 | 5;

export const TELEGRAM_MIN_IMPORTANCE_DEFAULT: ImportanceLevel = 4;

/**
 * 정비사업 Registry 인터페이스
 * 필수 필드: id, name, aliases, locationKeywords, district, city
 */
export interface RedevelopmentProject {
  /** 유니크 프로젝트 식별자 (예: 'chokjin-3', 'udong-3') */
  id: string;
  /** 정식 사업 명칭 (예: '부산시민공원주변(촉진3구역) 재정비촉진구역') */
  name: string;
  /** 별칭 및 검색 변형 (예: ['촉진3구역', '촉진3', '아크로 라로체']) */
  aliases: string[];
  /** 위치 및 주변 지리 식별 키워드 (예: ['부산진구', '범전동', '부산시민공원']) */
  locationKeywords: string[];
  /** 관할 자치구 (예: '부산진구', '해운대구') */
  district: string;
  /** 관할 광역자치단체 (예: '부산광역시') */
  city: string;

  // 부가 운영 메타데이터
  type?: '재개발' | '재건축' | '도시환경정비';
  stage?: string; // 현재 사업 단계 (예: 사업시행인가, 관리처분계획인가 등)
  nextStage?: string; // 다음 정비사업 단계 (예: 이주, 관리처분계획인가 등)
  builder?: string; // 시공사 브랜드 (예: DL이앤씨 아크로, 현대건설 디에이치 등)
  estimatedUnits?: number; // 계획 세대수
  description?: string;
  generalSaleStatus?: string; // 일반분양 여부 (예: '확인 필요' 등)
  officialSourceUrls?: string[]; // 해당 구역 관련 고시·공고 페이지
  isActiveMonitoring: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 수집된 원본 뉴스 또는 공식 행정자료 모델
 */
export interface RawCollectedItem {
  actorType?: "official" | "association";
  detailVerified?: boolean;
  attachmentUrls?: string[];
  /** HTML detail verification never implies attachment text was read. */
  attachmentContentStatus?: "unverified" | "not_applicable";
  id: string; // URL 해시 또는 고유 식별자
  projectId: string; // 매칭된 RedevelopmentProject id
  sourceTier: SourceTier; // 'official' | 'news'
  sourceType?: SourceType; // 'official-api' | 'official-web' | 'news-rss' | 'news-api'
  sourceName: string; // 출처 매체명 (예: '부산광역시 새올고시정보', '부산일보', '연합뉴스')
  sourceUrl: string; // 원문 URL (API 제공 시 실제 URL, 미제공 시 고유 식별자 참조)
  title: string; // 원문 제목
  content: string; // 원문 본문 또는 요약
  author?: string; // 기자명 또는 담당 부서
  publishedAt: string; // 원문 발행 시각 (ISO string)
  collectedAt: string; // 수집 시각 (ISO string)
  rawFingerprint: string; // 중복 수집 방지용 핑거프린트
  matchedKeywords: string[]; // 검출된 키워드/별칭 목록

  // Phase 2D 공식자료 출처 보존 필드 (API 실제 제공 필드만 저장, AI 추론 금지)
  noticeNumber?: string; // 고시공고번호 (API ancmntNo 등 실제 제공 시)
  department?: string; // 담당 부서명 (API tkcgDeptNm 등 실제 제공 시)
  sectionType?: string; // 구분 (API seNm 등 실제 제공 시)
}

/**
 * Gemini AI 분석 결과 모델
 */
export interface ArticleAnalysis {
  itemId: string;
  projectId: string;
  isRelevant: boolean; // 해당 정비사업과 실질적으로 연관되어 있는지 여부
  relevanceExplanation: string; // 관련성 판별 사유
  categories: AnalysisCategory[]; // 13대 카테고리 중 해당되는 항목들
  primaryCategory: AnalysisCategory; // 주 카테고리
  importance: ImportanceLevel; // 1 ~ 5
  importanceReason: string; // 중요도 산정 사유
  oneLineSummary: string; // 1줄 핵심 요약
  keyPoints: string[]; // 2~3개 핵심 불릿포인트
  eventClusterSignature: string; // 사건 병합을 위한 정규화된 시그니처 (예: '2026-09-chokjin-3-contractor-cost-dispute')
  sourceTier: SourceTier;
  analyzedAt: string;
}

/**
 * 이벤트 단위 중복 병합 모델 (RedevelopmentEvent)
 * 같은 사건을 여러 언론사나 공식자료가 보도한 경우 개별 텔레그램을 반복 발송하지 않고
 * 하나의 Event로 클러스터링하여 병합 관리
 */
export interface RedevelopmentEvent {
  id: string; // 이벤트 고유 ID (예: 'evt_chokjin-3_202609_builder_cost')
  projectId: string;
  eventClusterSignature: string;
  title: string; // 병합된 대표 사건 헤드라인
  summary: string; // 종합 브리핑 요약
  primaryCategory: AnalysisCategory;
  categories: AnalysisCategory[];
  maxImportance: ImportanceLevel; // 병합된 기사들 중 최고 중요도
  sourceTier: 'official' | 'news' | 'mixed'; // 공식자료와 뉴스가 섞여있는지 표기
  hasOfficialNotice: boolean; // 공식 행정자료 포함 여부

  // 연계된 기사 및 자료 목록
  articleIds: string[];
  articles: Array<{
    itemId: string;
    title: string;
    sourceName: string;
    sourceUrl: string;
    publishedAt: string;
    sourceTier: SourceTier;
    importance: ImportanceLevel;
  }>;

  articleCount: number;
  firstSeenAt: string;
  lastUpdatedAt: string;

  // Telegram 발송 상태 추적
  telegramDispatched: boolean;
  telegramDispatchedAt?: string;
  telegramMessageId?: string;
}

/**
 * Telegram 발송 로그
 */
export interface TelegramDispatchLog {
  id: string;
  eventId: string;
  projectId: string;
  chatId: string;
  messageText: string;
  importance: ImportanceLevel;
  dispatchedAt: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  errorMessage?: string;
}

/**
 * 외부 Cloud Scheduler에 의한 /api/jobs/poll 실행 기록
 */
export interface PollJobRun {
  id: string;
  jobName: string;
  triggeredBy: 'cloud_scheduler' | 'manual_dry_run';
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'success' | 'failed';
  itemsCollected: number;
  itemsAnalyzed: number;
  eventsCreated: number;
  eventsMerged: number;
  telegramDispatchedCount: number;
  errors?: string[];
  executionTimeMs?: number;
}

/**
 * 이벤트에 연계된 원본 소스 참조 모델
 */
export interface MaterialImpactEvidence {
  kind: "schedule" | "member-cost";
  certainty: "confirmed" | "scheduled";
  quote: string;
  change: string;
  practicalMeaning: string;
  sourceUrl: string;
}

export interface EventSourceRef {
  actorType?: "official" | "association";
  detailVerified?: boolean;
  attachmentUrls?: string[];
  /** HTML detail verification never implies attachment text was read. */
  attachmentContentStatus?: "unverified" | "not_applicable";
  evidenceContent?: string;
  title: string;
  url: string;
  source: string;
  sourceTier: SourceTier;
  sourceType?: SourceType;
  publishedAt: string;
  discoveredAt: string;
  author?: string;
  snippet?: string;
  noticeNumber?: string;
  department?: string;
  sectionType?: string;
}

/**
 * Phase 2 Gemini Event Extraction 결과 및 병합 이벤트 규격
 */
export interface ExtractedEvent {
  materialImpactEvidence?: MaterialImpactEvidence;
  id: string;
  projectId: string;
  eventType: string; // 예: "사업시행인가", "시공사 선정/변경", "공사비 분담금 협상", "총회 의결"
  category: AnalysisCategory;
  title: string;
  summary: string;
  importance: ImportanceLevel; // 1 ~ 5
  confidence: number; // 0.0 ~ 1.0 (신뢰도)
  eventDate: string; // YYYY-MM-DD 또는 ISO string
  primarySourceUrl: string;
  primarySourceTier: SourceTier;
  sources: EventSourceRef[];
  reasoningSummary: string;

  // Telegram Candidate 평가 결과 (Phase 2에서는 실제 전송하지 않고 candidate 여부만 산정)
  // 조건: relevant == true AND confidence >= 0.75 AND importance >= 4 AND 신규 event
  telegramCandidate: boolean;
  telegramCandidateReason?: string;
  alreadyDispatched?: boolean;

  // Phase 2C Recency Policy 규격 필드 (발행일 vs 발견일 분리 및 실시간 발송 적격성)
  publishedAt?: string; // 원문 발행 시각 (ISO string)
  discoveredAt?: string; // 시스템 최초 수집 시각 (ISO string)
  isHistorical?: boolean; // 과거 기사/아카이브 문서 여부
  telegramEligibleByRecency?: boolean; // 최신성 기준 텔레그램 발송 적격 여부

  // Phase 4A 진행이력 및 Historical SSOT 확장 필드
  sourceTier?: EventSourceTier;
  verificationStatus?: VerificationStatus;
  provenance?: EventProvenance;

  createdAt: string;
  updatedAt: string;
}

export interface ItemAuditRecord {
  projectId: string;
  matchedAlias: string;
  title: string;
  source: string;
  sourceTier: SourceTier;
  sourceType?: SourceType;
  publishedAt: string;
  sourceUrl: string;
  deterministicGateResult: 'relevant' | 'irrelevant';
  gateReason?: string;
  geminiRelatednessResult: 'relevant' | 'irrelevant' | 'uncertain';
  geminiReason?: string;
  confidence: number;
  eventType: string;
  importance: number;
  telegramCandidate: boolean;
  // Recency Policy 규격 필드
  discoveredAt?: string;
  isHistorical?: boolean;
  telegramEligibleByRecency?: boolean;
  // Provenance 필드
  noticeNumber?: string;
  department?: string;
  sectionType?: string;
}

/**
 * Phase 2 수집 주기 감사(Audit) 메트릭 모델
 * "왜 이번에는 알림이 없었는가"를 설명하기 위한 지표
 */
export interface CollectionCycleAudit {
  id: string;
  timestamp: string;
  sourcesChecked: number;
  itemsDiscovered: number;
  relevantItems: number;
  irrelevantItems: number;
  uncertainItems: number;
  eventsCreated: number;
  eventsMerged: number;
  telegramCandidates: number;
  telegramSent?: number;
  telegramFailed?: number;
  officialApiStatus?: 'disabled' | 'unavailable' | 'active' | 'failed';
  errors: string[];
  sourceDetails: Array<{
    sourceName: string;
    sourceTier: SourceTier;
    status: 'success' | 'failed';
    itemsCount: number;
    error?: string;
  }>;
  itemAudits?: ItemAuditRecord[];
  explanationWhyNoAlert?: string;
}

/**
 * Phase 2 Dry-run 검증 결과
 */
export interface DryRunTestCaseResult {
  id: string;
  name: string;
  description: string;
  expected: string;
  actual: string;
  passed: boolean;
  details?: Record<string, any>;
}

export interface DryRunVerificationSummary {
  runAt: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: DryRunTestCaseResult[];
}

/**
 * Phase 4D: 단지계획 & 단위세대 평면 모델
 */
export interface UnitTypeItem {
  unitTypeId: string;
  projectId: string;
  planVersionId: string;
  typeCode: string;
  areaGroup: string;
  netAreaM2?: number | null;
  floorPlanAssetId: string;
  locationMapIncludedInOriginal: boolean;
  provenance: {
    sourceType: string;
    sourceName: string;
    documentTitle: string;
    publishedDate: string | null;
  };
  unverifiedAttributesNotice: string;
  createdAt: string;
}

export interface PlanVersionItem {
  planVersionId: string;
  projectId: string;
  versionName: string;
  sourceType: '조합/사업주체 자료' | '공식 고시/인가자료' | '언론보도' | '기타';
  sourceName: string;
  documentTitle: string;
  publishedDate: string | null;
  versionNotice: string;
  totalUnitTypesCount: number;
  layoutPlanAssetId: string | null;
  sitePlanAssetId: string | null;
  createdAt: string;
  verifiedAt: string;
}

export interface PlanAssetItem {
  assetId: string;
  projectId: string;
  planVersionId: string;
  assetType: 'site_layout' | 'unit_floor_plan';
  title: string;
  targetTypeCode?: string | null;
  imageUrl: string;
  hasLocationMapOverlay: boolean;
  aspectRatioNotice: string;
  originalFileName: string;
}
