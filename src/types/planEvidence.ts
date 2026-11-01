/**
 * Phase 4F-1: Plan Evidence Onboarding Architecture & Fact Types
 * 
 * 원칙:
 * 1. Evidence가 존재한다 ≠ 운영 데이터로 사용할 수 있다 (반드시 검증/정규화 파이프라인 통과)
 * 2. Document Status (문서 인허가 단계)와 Fact Status (데이터 가공 상태)의 철저한 분리
 * 3. Data Availability (기능별 데이터 보유 여부)와 Fact Status (개별 사실값 상태)의 철저한 분리
 * 4. Automatic Promotion 금지 (오직 normalized 상태만 명시적 승격 대상)
 * 5. Conflict 발생 시 임의 추정/최신일자 자동선택 금지 -> conflicted 상태로 보존
 */

import { PlanDocumentStatus } from './planConfig.ts';

/**
 * 사실값 추출 및 온보딩 생애주기 상태 (Fact Life-cycle Status)
 * - 'extracted': 원본 문서/Evidence에서 값을 읽어낸 초기 상태 (검증 전, 승격 불가)
 * - 'pending_review': 추가 확인이나 교차 검토 대기 상태 (승격 불가)
 * - 'verified': 원본 Evidence 실물과 대조하여 해당 값이 원본에 실재함을 확인한 상태 (승격 불가)
 * - 'normalized': 데이터 모델 의미, 단위(호수/세대), 정합성까지 확인되어 반영 후보가 된 상태 (유일한 승격 대상)
 * - 'conflicted': 상충하는 복수의 Evidence가 존재하여 경합 중인 상태 (승격 불가)
 * - 'rejected': 오추출되었거나 사업지 사실값으로 사용할 수 없어 기각된 상태 (승격 불가)
 */
export type PlanFactStatus =
  | 'extracted'
  | 'pending_review'
  | 'verified'
  | 'normalized'
  | 'conflicted'
  | 'rejected';

/**
 * 단지계획 도메인 표준 사실 필드 식별자
 */
export type PlanFactField =
  | 'totalUnits'
  | 'nonRentalUnits'
  | 'rentalUnits'
  | 'memberUnits'
  | 'reservedUnits'
  | 'generalSaleUnits'
  | 'unitTypeSupply'
  | 'buildingMapping'
  | 'sitePlan'
  | 'unitPlan'
  | 'unitType'
  | 'unitCount'
  | 'netAreaM2'
  | (string & {});

/**
 * 원본 문서 내 세부 위치 정보 (Evidence Location)
 */
export interface PlanEvidenceLocation {
  /** 문서 내 페이지 번호 (PDF/문헌 자료인 경우) */
  page?: number;
  /** 문서 목차 또는 섹션 명칭 */
  section?: string;
  /** 표 번호 또는 표 제목 */
  table?: string;
  /** 원본 이미지 또는 에셋 상대/정적 경로 (Phase 4F-2) */
  assetPath?: string;
  /** 원본 파일명 (예: '84a1.jfif') (Phase 4F-2) */
  fileName?: string;
  /** 주석, 각주 또는 부가 식별 메모 */
  note?: string;
}

/**
 * 경합 및 충돌 상세 정보
 */
export interface PlanFactConflictDetail {
  /** 충돌하는 다른 사실값 식별자 목록 */
  conflictingFactIds: string[];
  /** 경합 중인 값 목록 */
  competingValues: unknown[];
  /** 충돌 감지 일시 (ISO String) */
  detectedAt: string;
  /** 충돌 상세 메모 */
  note?: string;
}

/**
 * 온보딩 대상 사실 후보 인터페이스 (PlanFactCandidate)
 */
export interface PlanFactCandidate<T = unknown> {
  /** 사실 후보 고유 식별자 (예: 'fact-chokjin3-total-units-2026') */
  factId: string;
  /** 대상 사업지 식별자 (예: 'chokjin-3') */
  projectId: string;
  /** 사실 대상 필드 */
  field: PlanFactField;
  /** 추출/정규화된 사실값 */
  value: T;
  /** 근거 원천 자료 식별자 (PlanEvidenceReference.sourceId) */
  sourceId: string;
  /** 온보딩 상태 (extracted -> verified -> normalized / conflicted / rejected) */
  status: PlanFactStatus;
  /** 원본 문서 내 위치 */
  evidenceLocation?: PlanEvidenceLocation;
  /** 추출 일시 */
  extractedAt?: string;
  /** 검증 일시 */
  verifiedAt?: string;
  /** 검증자 메모 */
  verificationNote?: string;
  /** 정규화 일시 */
  normalizedAt?: string;
  /** 정규화 메모 */
  normalizationNote?: string;
  /** 기각 사유 (rejected 상태인 경우) */
  rejectedReason?: string;
  /** 충돌 상세 (conflicted 상태인 경우) */
  conflictDetails?: PlanFactConflictDetail;
  /** 임의 메모 */
  auditNotes?: string;
}

/**
 * Fact 검증 입력 파라미터
 */
export interface PlanFactVerificationInput {
  verifiedBy?: string;
  notes?: string;
  evidenceLocation?: PlanEvidenceLocation;
}

/**
 * Fact 정규화 입력 파라미터
 */
export interface PlanFactNormalizationInput<T = unknown> {
  normalizedValue?: T;
  normalizedBy?: string;
  notes?: string;
}

/**
 * 검증 및 무결성 이슈 코드 (V1 ~ V8)
 */
export type EvidenceValidationCode =
  | 'V1_MISSING_SOURCE_REGISTRATION'
  | 'V2_NORMALIZED_WITHOUT_SOURCE'
  | 'V3_NO_EVIDENCE_LOCATION'
  | 'V4_FACT_VALUE_CONFLICT'
  | 'V5_CANNOT_PROMOTE_CONFLICTED'
  | 'V6_CANNOT_PROMOTE_REJECTED'
  | 'V7_CANNOT_PROMOTE_EXTRACTED'
  | 'V8_STATUS_TYPE_CONFUSION';

export interface EvidenceValidationIssue {
  code: EvidenceValidationCode;
  level: 'error' | 'warning';
  message: string;
  factId?: string;
  field?: string;
  sourceId?: string;
}

export interface EvidenceValidationResult {
  isValid: boolean;
  errors: EvidenceValidationIssue[];
  warnings: EvidenceValidationIssue[];
}

export interface FactPromotionResult<T = unknown> {
  eligible: boolean;
  error?: string;
  fact?: PlanFactCandidate<T>;
}
