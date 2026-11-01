/**
 * Phase 5E: 모집공고 Evidence Extraction 도메인 스키마
 * 
 * 원칙:
 * 1. PDF Evidence 원본의 각 수치에 evidenceSourceId + page + table/section + rawValue 보존.
 * 2. 원본에서 누락되었거나 식별되지 않는 수치는 0이 아닌 null 유지 (추정 금지).
 * 3. OCR/파싱 실패 시 임의 보간 금지.
 * 4. 자동 verified 승격 금지 (반드시 human review를 거쳐야 verified 전환).
 * 5. extracted 상태에서는 Phase 5D Registry 등록 전면 차단.
 */

import { AnnouncementVerificationStatus } from './subscriptionAnnouncement.ts';

/** 개별 추출 사실값의 생애주기 상태 */
export type ExtractionFactStatus =
  | 'extracted'       // 원본 문서에서 파싱/추출된 초기 상태 (검증 전, 승격 불가)
  | 'pending_review'  // 사람 검토 대기
  | 'verified'        // 사람 검토 완료 및 원본 대조 확인 상태
  | 'conflict'        // 복수 페이지/표 간 데이터 상충 발생
  | 'rejected';       // 오추출 또는 반려

/** 후보 공고 전체 생애주기 상태 */
export type CandidateLifecycleStatus =
  | 'extracted'       // 파이프라인 추출 완료 상태
  | 'under_review'    // 사람 검토 진행 중
  | 'verified'        // 검토 승인 완료 (Phase 5D Onboarding 대상)
  | 'conflict'        // 상충값 존재로 보류
  | 'rejected';       // 검토 반려

/** 단일 사실값 및 Evidence Trace 메타데이터 */
export interface ExtractedFactValue<T> {
  /** 정제/파싱된 값 (미확인 시 null 필수) */
  value: T | null;
  /** PDF 원본 문자열 그대로 보존 */
  rawValue: string | null;
  /** 근거 증빙 ID (예: 'ev-doc-chokjin3-p4-tbl2') */
  evidenceSourceId: string;
  /** PDF 페이지 번호 (1-based) */
  page: number;
  /** 공고문 목차 또는 섹션 명칭 */
  section?: string;
  /** 표 번호 또는 표 제목 */
  table?: string;
  /** 검증 상태 */
  status: ExtractionFactStatus;
  /** 비고 또는 파싱 메모 */
  notes?: string;
}

/** PDF 원본 문서 구조화 모델 (추출 파이프라인 입력) */
export interface RawPdfTableData {
  tableName?: string;
  headers: string[];
  rows: string[][];
}

export interface RawPdfPageEvidence {
  pageNumber: number;
  sectionName?: string;
  tables?: RawPdfTableData[];
  textSnippets?: string[];
}

export interface RawPdfAnnouncementDocument {
  documentId: string;
  documentTitle: string;
  projectId: string;
  sourceFileName: string;
  publishedAt?: string;
  pages: RawPdfPageEvidence[];
}

/** 타입별 특별공급 추출 사실 셋 */
export interface ExtractedTypeSpecialSupply {
  multiChildQuota: ExtractedFactValue<number>;
  newlywedQuota: ExtractedFactValue<number>;
  firstLifeQuota: ExtractedFactValue<number>;
  newbornQuota: ExtractedFactValue<number>;
  elderlyParentQuota: ExtractedFactValue<number>;
  institutionQuota: ExtractedFactValue<number>;
  totalSpecialQuota: ExtractedFactValue<number>;
}

/** 타입별 일반공급 추출 사실 셋 */
export interface ExtractedTypeGeneralSupply {
  quota: ExtractedFactValue<number>;
  pointsRatio: ExtractedFactValue<number>;
  lotteryRatio: ExtractedFactValue<number>;
}

/** 타입별 공급 세부 계획 추출 후보 */
export interface ExtractedTypeSupplyPlan {
  typeCode: ExtractedFactValue<string>;
  exclusiveArea: ExtractedFactValue<number>;
  supplyCategory: 'under85' | 'over85';
  totalSupplyUnits: ExtractedFactValue<number>;
  specialSupply: ExtractedTypeSpecialSupply;
  generalSupply: ExtractedTypeGeneralSupply;
}

/**
 * PDF Evidence로부터 추출된 모집공고 후보 데이터 모델 (ExtractedAnnouncementCandidate)
 */
export interface ExtractedAnnouncementCandidate {
  candidateId: string;
  projectId: string;
  projectName: ExtractedFactValue<string>;
  announcementDate: ExtractedFactValue<string>;
  sourceDocumentId: string;
  sourceFileName: string;

  /** 후보 데이터의 현재 생애주기 상태 */
  lifecycleStatus: CandidateLifecycleStatus;

  /** 사람 검토 기록 */
  humanReviewRecord?: {
    reviewerId: string;
    reviewedAt: string;
    decision: 'approved' | 'rejected' | 'conflict';
    comments?: string;
  };

  /** 1. 해당지역 및 거주기간 요건 */
  residenceRequirement: {
    targetRegion: ExtractedFactValue<'busan'>;
    requirementMonths: ExtractedFactValue<number>;
    isRestrictedArea: ExtractedFactValue<boolean>;
  };

  /** 2. 총 공급 세대수 총괄 */
  totalSupplySummary: {
    totalSupplyUnits: ExtractedFactValue<number>;
    specialSupplyTotalUnits: ExtractedFactValue<number>;
    generalSupplyTotalUnits: ExtractedFactValue<number>;
  };

  /** 3. 타입별 면적 및 세부 배정 세대수 */
  typeSupplies: ExtractedTypeSupplyPlan[];

  /** 4. 일반공급 가점/추첨 비율 총괄 */
  generalAllocationRatio: {
    under85PointsRatio: ExtractedFactValue<number>;
    under85LotteryRatio: ExtractedFactValue<number>;
    over85PointsRatio: ExtractedFactValue<number>;
    over85LotteryRatio: ExtractedFactValue<number>;
  };

  /** 5. 청약통장/예치금 요건 */
  bankbookRequirement: {
    minSubscriptionMonths: ExtractedFactValue<number>;
    depositUnder85: ExtractedFactValue<number>;
    depositUnder102: ExtractedFactValue<number>;
    depositUnder135: ExtractedFactValue<number>;
    depositAllAreas: ExtractedFactValue<number>;
  };

  /** 6. 소득/자산 기준 */
  incomeAssetRequirement: {
    incomeApplicablePaths: ExtractedFactValue<string[]>;
    assetThresholdRealEstate: ExtractedFactValue<number>;
    assetThresholdVehicle: ExtractedFactValue<number>;
  };

  /** 파이프라인 추출 중 발생한 경고 및 conflict 목록 */
  extractionLogs: string[];
}
