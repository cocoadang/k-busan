/**
 * Busan Redevelopment News Monitor - Dedicated Firestore Schema
 * Phase 3A: Production Firestore Schema & Index Specifications
 * 
 * 중요 원칙:
 * 1. 기존 타 프로젝트(K-News, K-Housing, KTX 등) Firestore DB를 절대 침범하지 않고 이 앱 전용 Firestore DB를 사용함.
 * 2. collections 5대 표준 구성:
 *    - projects (사업장 레지스트리)
 *    - documents (수집 원문 및 관련성 판정)
 *    - events (중복 병합된 핵심 사건 클러스터)
 *    - collectionCycles (주기별 수집 감사 로그)
 *    - telegramDeliveries (텔레그램 실제 발송 이력)
 * 3. 기사/이벤트 중복 저장 방지:
 *    - documents: URL 해시 기반 고유 ID
 *    - events: 구역 + 사건 클러스터 시그니처 기반 식별
 *    - telegramDeliveries: eventId + messageHash 기반 1회 전송 보장
 */

import {
  AnalysisCategory,
  ImportanceLevel,
  RedevelopmentProject,
  RelatednessStatus,
  SourceTier,
  SourceType,
  EventSourceRef,
  ItemAuditRecord,
  EventSourceTier,
  VerificationStatus,
  EventProvenance,
} from '../types/redevelopment.ts';

/**
 * 전용 Firestore 컬렉션 명칭 상수 (Phase 3A 표준)
 */
export const FIRESTORE_COLLECTIONS = {
  /** 1. 정비사업 Registry 마스터 (chokjin-3, udong-3) */
  PROJECTS: 'projects',
  /** 2. 수집 원문 기사 및 공식 문서 (URL 중복 방지) */
  DOCUMENTS: 'documents',
  /** 3. 사건 단위로 병합된 이벤트 모델 (Telegram 발송 단위) */
  EVENTS: 'events',
  /** 4. 주기별 수집 및 감사 로그 ("왜 알림이 없었는가" 포함) */
  COLLECTION_CYCLES: 'collectionCycles',
  /** 5. Telegram 실제 발송 이력 및 전송 상태 */
  TELEGRAM_DELIVERIES: 'telegramDeliveries',
  /** 6. 정비사업 주변 지역변화 및 개발계획 (Phase 4C) */
  AREA_DEVELOPMENTS: 'areaDevelopments',
  /** 7. 단지계획 버전 메타데이터 (Phase 4D) */
  PLAN_VERSIONS: 'planVersions',
  /** 8. 단위세대 타입 마스터 (Phase 4D) */
  UNIT_TYPES: 'unitTypes',
  /** 9. 도면 및 배치도 에셋 (Phase 4D) */
  PLAN_ASSETS: 'planAssets',
  /** 10. 배치도 버전 관리 (Phase 4D-5D) */
  SITE_PLANS: 'sitePlans',
  /** 11. 주동 정보 및 동-타입 매핑 (Phase 4D-5D) */
  BUILDINGS: 'buildings',
  /** 12. AI 분석 결과 캐시 (서버 전용, expiresAt TTL 정책 대상) */
  ANALYSIS_CACHE: 'analysisCache',
  /** 13. 수집 주기 실행 잠금 (스케줄러·수동 실행 중복 방지) */
  LOCKS: 'locks',
  /** 14. 운영 상태 (수집 연속 실패 횟수·운영 알림 발송 시각) */
  OPS_STATE: 'opsState',
} as const;

/**
 * 7. 컬렉션: planVersions (단지계획 버전 메타데이터)
 * Document ID: planVersionId (예: 'chokjin-3-association-proposal-v1')
 */
export interface FirestorePlanVersionDoc {
  planVersionId: string;
  projectId: string;
  versionName: string;
  sourceType: 'association' | 'official' | 'news' | 'other' | string;
  sourceName: string;
  documentTitle: string;
  publishedDate: string | null;
  sourceDate: string | null;
  confirmationStatus: 'proposal' | 'official';
  verificationStatus: 'verified' | 'unverified';
  isCurrentKnownVersion: boolean;
  supersededBy: string | null;
  totalUnitsInPlanSet: number;
  discrepancyNotice: string;
  versionNotice: string;
  totalUnitTypesCount: number;
  layoutPlanAssetId: string | null;
  sitePlanAssetId: string | null;
  /** Phase 4E-7: 원천 Evidence 참조 식별자 (PlanEvidenceReference.sourceId) */
  evidenceSourceId?: string;
  excludedHousingTypes?: Array<{
    typeCode: string;
    units: number;
    housingCategory: 'rental';
    excludedFromUnitPlanUI: boolean;
  }>;
  totalSupplySummary?: {
    totalUnits: number;
    nonRentalUnits: number;
    rentalUnits: number;
    memberUnits: number;
    reservedUnits: number;
    generalSaleUnits: number;
    /** Phase 4E-7: 공급계획 원천 Evidence 참조 식별자 */
    evidenceSourceId?: string;
  };
  createdAt: string;
  verifiedAt: string;
}

/**
 * 8. 컬렉션: unitTypes (단위세대 타입 마스터)
 * Document ID: unitTypeId (예: 'chokjin-3-proposal-84A1')
 */
export interface FirestoreUnitTypeDoc {
  unitTypeId: string;
  typeName: string;
  typeCode: string;
  units: number;
  projectId: string;
  planVersionId: string;
  areaGroup: string;
  netAreaM2?: number | null;
  floorPlanAssetId: string;
  locationMapIncludedInOriginal: boolean;
  specialFeatures: string[];
  sourceAlias?: string | null;
  verificationStatus: 'verified' | 'unverified';
  confirmationStatus: 'proposal' | 'official';
  verifiedFacts: {
    typeName: string;
    units: number;
    areaGroup: string;
    sourceType: string;
    evidence: string;
    hasLocationMap: boolean;
    verificationStatus: 'verified';
    confirmationStatus: 'proposal';
  };
  derivedAnalysis?: {
    orientation: string;
    view: string;
    bayCount: string;
    roomsBaths: string;
    generalSaleAllocation: string;
    notice: string;
  };
  allocation?: {
    totalUnits: number;
    memberUnits: number;
    reservedUnits: number;
    generalSaleUnits: number;
    rentalUnits: number;
    isArithmeticMatch?: boolean;
    isConflict?: boolean;
    statusNotice?: string;
  };
  sourceAsset: {
    assetId: string;
    originalFileName: string;
    secondaryFileName?: string | null;
    tertiaryFileName?: string | null;
    assetType: 'floor_plan';
    imageUrl: string;
    secondaryImageUrl?: string | null;
    tertiaryImageUrl?: string | null;
    isDuplex?: boolean;
    isMultiLevel?: boolean;
    primaryAssetPath?: string;
    secondaryAssetPath?: string;
    tertiaryAssetPath?: string;
    floor1Label?: string;
    floor2Label?: string;
    floor3Label?: string;
    floors?: Array<{
      floorId: string;
      label: string;
      fileName: string;
      assetPath: string;
    }>;
    sourceAssetVerified?: boolean;
    fileExists?: boolean;
    servedFileName?: string;
    assetPath?: string;
  };
  provenance: {
    sourceType: string;
    sourceName: string;
    documentTitle: string;
    publishedDate: string | null;
  };
  buildingNumbers?: string[];
  mappingStatus?: 'verified' | 'supported' | 'unresolved';
  candidateBuildingNumbers?: string[];
  keyPlanMatched?: boolean;
  evidenceNotes?: string;
  /** Phase 4E-7: 원천 Evidence 참조 식별자 (PlanEvidenceReference.sourceId) */
  evidenceSourceId?: string;
  unverifiedAttributesNotice: string;
  createdAt: string;
}

/**
 * 9. 컬렉션: planAssets (도면 및 배치도 에셋)
 * Document ID: assetId (예: 'asset-chokjin3-layout-master')
 */
export interface FirestorePlanAssetDoc {
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

/**
 * 10. 컬렉션: sitePlans (배치도 버전 및 메타데이터, Phase 4D-5D)
 * Document ID: sitePlanId (예: 'chokjin-3-association-proposal-v1')
 */
export interface FirestoreSitePlanDoc {
  sitePlanId: string;
  projectId: string;
  assetPath: string;
  sourceType: 'association' | 'official' | 'news' | 'other' | string;
  confirmationStatus: 'proposal' | 'official';
  verificationStatus: 'verified-from-image' | 'unverified';
  isCurrentKnownVersion: boolean;
  title: string;
  versionNotice: string;
  totalBuildingsCount: number;
  totalUnitTypesMapped: number;
  /** Phase 4E-7: 원천 Evidence 참조 식별자 (PlanEvidenceReference.sourceId) */
  evidenceSourceId?: string;
  uploadedAt: string;
  verifiedAt: string;
}

/**
 * 11. 컬렉션: buildings (주동 정보 및 동-타입 매핑, Phase 4D-5D)
 * Document ID: buildingId (예: 'chokjin-3-bldg-101')
 */
export interface FirestoreBuildingDoc {
  buildingId: string;
  projectId: string;
  sitePlanId: string;
  buildingNumber: string;
  displayName: string;
  unitTypesShown: string[];
  isTerraceHouse: boolean;
  notes?: string;
}

/**
 * 6. 컬렉션: areaDevelopments (주변 지역변화 및 개발계획)
 * Document ID: developmentId (예: 'dev-butx')
 */
export interface FirestoreAreaDevelopmentDoc {
  developmentId: string;
  title: string;
  category: string;
  affectedProjectIds: string[];
  relevanceLevel: 'direct' | 'regional';
  status: string;
  planStage: string;
  impactDirection: 'positive' | 'negative' | 'mixed' | 'uncertain';
  impactReason: string;
  announcementDate: string;
  expectedCompletionDate: string | null;
  sourceTier: SourceTier;
  sourceName: string;
  sourceUrl: string;
  verificationStatus: VerificationStatus;
  documentUrlVerified: boolean;
  lastVerifiedAt: string;
}

/**
 * 1. 컬렉션: projects (정비사업 레지스트리)
 * Document ID: project.id ('chokjin-3', 'udong-3')
 */
export interface FirestoreProjectDoc extends RedevelopmentProject {}

/**
 * 2. 컬렉션: documents (수집 원본 및 판정 문서)
 * Document ID: sha256(url)
 */
export interface FirestoreDocumentDoc {
  attachmentUrls?:string[];
  attachmentContentStatus?:string;
  attachmentEvidence?:import('../types/redevelopment').RawCollectedItem['attachmentEvidence'];
  id: string; // sha256(url)
  sourceType: SourceType; // 'news-rss' | 'official-api' | 'official-web'
  sourceTier: SourceTier; // 'news' | 'official'
  title: string;
  url: string;
  publishedAt: string; // ISO-8601
  discoveredAt: string; // ISO-8601
  matchedProjectIds: string[]; // ['chokjin-3'] 등
  relatedness: RelatednessStatus; // 'relevant' | 'irrelevant' | 'uncertain'
  confidence: number; // 0.0 ~ 1.0
  sourceName: string;
  content?: string;
  author?: string;
  noticeNumber?: string;
  department?: string;
  sectionType?: string;
  rawFingerprint?: string;
}

/**
 * 3. 컬렉션: events (사건 단위 중복 병합 모델)
 * Document ID: eventId
 */
export interface FirestoreEventDoc {
  materialImpactEvidence?: import("../types/redevelopment").MaterialImpactEvidence;
  id: string;
  projectId: string;
  category: AnalysisCategory;
  eventType: string;
  title: string;
  summary: string;
  importance: ImportanceLevel; // 1 ~ 5
  confidence: number;
  eventDate: string; // YYYY-MM-DD
  isHistorical: boolean;
  telegramEligibleByRecency: boolean;
  sourceTier?: EventSourceTier;
  verificationStatus?: VerificationStatus;
  noticeNumber?: string;
  documentUrlVerified?: boolean;
  documentIdentifierVerified?: boolean;
  actorType?: 'official' | 'association' | 'constructor' | 'court';
  provenance?: EventProvenance;
  primarySource: {
    title: string;
    url: string;
    source: string;
    sourceTier: SourceTier;
    publishedAt: string;
  };
  sources: EventSourceRef[];
  firstSeenAt: string;
  lastSeenAt: string;
  alreadyDispatched: boolean;
  telegramDispatchedAt?: string;
  telegramMessageId?: string;
}

/**
 * 4. 컬렉션: collectionCycles (수집 주기 감사 로그)
 * Document ID: cycle_${timestamp}
 */
export interface FirestoreCollectionCycleDoc {
  sourceDetails?: import("../types/redevelopment").CollectionCycleAudit["sourceDetails"];
  id: string;
  startedAt: string;
  finishedAt: string;
  sourcesChecked: number;
  rssItemsDiscovered: number;
  officialApiStatus: 'disabled' | 'unavailable' | 'active' | 'failed';
  relevantItems: number;
  eventsCreated: number;
  eventsMerged: number;
  telegramCandidates: number;
  telegramSent: number;
  telegramFailed: number;
  /** Events written to Firestore as new documents in this cycle. */
  newEventsStored?: number;
  /** Source documents written to Firestore as new in this cycle. */
  newDocumentsStored?: number;
  errors: string[];
  explanationWhyNoAlert?: string;
  itemAudits?: ItemAuditRecord[];
}

/**
 * 5. 컬렉션: telegramDeliveries (텔레그램 발송 이력 및 중복 차단 트랜잭션)
 * Document ID: deliv_${eventId} (이벤트당 단일 문서로 원자적 중복 방지)
 */
export interface FirestoreTelegramDeliveryDoc {
  id: string; // deliv_${eventId}
  eventId: string;
  projectId: string;
  status: 'pending' | 'sent' | 'failed' | 'success';
  createdAt: string; // ISO-8601
  sentAt?: string; // ISO-8601 (성공 시)
  failedAt?: string; // ISO-8601 (실패 시)
  messageHash: string;
  chatId: string;
  telegramMessageId?: string | number;
  error?: string;
  messageText?: string;
  importance?: number;
  isTest?: boolean;
  /** Number of dispatch attempts (reservations). Failed deliveries stop retrying at the cap. */
  attempts?: number;
}

/**
 * 복합 인덱스 (Composite Indexes) 설계 정의
 * Phase 3A: 5대 컬렉션 인덱스 목록
 */
export const REQUIRED_FIRESTORE_INDEXES = [
  {
    collectionGroup: 'documents',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'matchedProjectIds', arrayConfig: 'CONTAINS' },
      { fieldPath: 'publishedAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'documents',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'relatedness', order: 'ASCENDING' },
      { fieldPath: 'discoveredAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'events',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'importance', order: 'DESCENDING' },
      { fieldPath: 'lastSeenAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'events',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'alreadyDispatched', order: 'ASCENDING' },
      { fieldPath: 'importance', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'telegramDeliveries',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'sentAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'collectionCycles',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'startedAt', order: 'DESCENDING' },
    ],
  },
];

