/**
 * Phase 5D: 모집공고 Data-Driven Onboarding 도메인 스키마
 * 
 * 원칙:
 * 1. 향후 촉진3·우동3 실제 공고 발생 시 코드 수정 없이 데이터 등록만으로 엔진 연결.
 * 2. 각 값마다 evidenceSourceId 및 검증 상태(verified / unresolved / conflict) 연계.
 * 3. 미확인 수치는 0이 아닌 null 유지 (임의 추정 엄격 금지).
 * 4. 당첨확률 예측 및 청약경로 순위화/추천 필드 배제.
 */

export type AnnouncementVerificationStatus = 'verified' | 'unresolved' | 'conflict';

/** 공고 유효성 검증 결과 */
export interface AnnouncementValidationResult {
  isValid: boolean;
  canOnboard: boolean;
  status: AnnouncementVerificationStatus;
  errors: string[];
  warnings: string[];
  conflictReport?: string[];
}

/** 해당지역 및 거주기간 요건 */
export interface AnnouncementResidenceRequirement {
  /** 대상 거주 지역 (부산광역시) */
  targetRegion: 'busan';
  /** 우선공급 충족 계속 거주기간 요건 (개월수, 예: 12개월) */
  requirementMonths: number;
  /** 규제지역 여부 (부산 전지역 비규제: false) */
  isRestrictedArea: boolean;
  /** 근거 증빙 ID */
  evidenceSourceId: string;
  /** 검증 상태 */
  status: AnnouncementVerificationStatus;
  notes?: string;
}

/** 총 공급 / 특별공급 / 일반공급 총괄 세대수 */
export interface AnnouncementTotalSupplySummary {
  /** 총 공급 세대수 (미확인 시 null, 추정 0 금지) */
  totalSupplyUnits: number | null;
  /** 특별공급 총 배정 세대수 */
  specialSupplyTotalUnits: number | null;
  /** 일반공급 총 배정 세대수 */
  generalSupplyTotalUnits: number | null;
  /** 근거 증빙 ID */
  evidenceSourceId: string;
  /** 검증 상태 */
  status: AnnouncementVerificationStatus;
}

/** 타입별 특별공급 세부 배정 세대수 */
export interface TypeSpecialSupplyAllocation {
  /** 다자녀가구 배정 세대수 (미확인 시 null) */
  multiChildQuota: number | null;
  /** 신혼부부 배정 세대수 */
  newlywedQuota: number | null;
  /** 생애최초 배정 세대수 */
  firstLifeQuota: number | null;
  /** 신생아 배정 세대수 (2026 현행 규칙) */
  newbornQuota: number | null;
  /** 노부모부양 배정 세대수 */
  elderlyParentQuota: number | null;
  /** 기관추천 배정 세대수 (선택) */
  institutionQuota?: number | null;
  /** 해당 타입 특별공급 합계 */
  totalSpecialQuota: number | null;
}

/** 타입별 일반공급 배정 및 가점/추첨 비율 */
export interface TypeGeneralSupplyAllocation {
  /** 일반공급 배정 세대수 */
  quota: number | null;
  /** 가점제 공급 비율 (%, 예: 40 또는 0) */
  pointsRatio: number;
  /** 추첨제 공급 비율 (%, 예: 60 또는 100) */
  lotteryRatio: number;
}

/** 타입별 공급 세부 계획 */
export interface AnnouncementTypeSupplyPlan {
  /** 주택형 코드 (예: '59A', '84A', '104') */
  typeCode: string;
  /** 전용면적 (㎡) */
  exclusiveArea: number;
  /** 평형 분류 (85㎡ 이하 vs 85㎡ 초과) */
  supplyCategory: 'under85' | 'over85';
  /** 타입별 총 공급 세대수 */
  totalSupplyUnits: number | null;
  /** 특별공급 배정 계획 */
  specialSupply: TypeSpecialSupplyAllocation;
  /** 일반공급 배정 계획 */
  generalSupply: TypeGeneralSupplyAllocation;
  /** 근거 증빙 ID */
  evidenceSourceId: string;
  /** 검증 상태 */
  status: AnnouncementVerificationStatus;
}

/** 일반공급 가점/추첨 비율 총괄 */
export interface AnnouncementGeneralAllocationRatio {
  /** 전용 85㎡ 이하 */
  under85: { pointsRatio: number; lotteryRatio: number };
  /** 전용 85㎡ 초과 */
  over85: { pointsRatio: number; lotteryRatio: number };
  /** 근거 증빙 ID */
  evidenceSourceId: string;
  /** 검증 상태 */
  status: AnnouncementVerificationStatus;
}

/** 청약통장 / 예치금 요건 */
export interface AnnouncementBankbookRequirement {
  /** 1순위 최소 가입기간 (개월수, 통상 6개월) */
  minSubscriptionMonths: number;
  /** 전용면적별 예치금 기준 (만원 단위) */
  depositByArea: {
    under85: number;   // 부산 300만원
    under102: number;  // 부산 600만원
    under135: number;  // 부산 1000만원
    allAreas: number;  // 부산 1500만원
  };
  /** 근거 증빙 ID */
  evidenceSourceId: string;
  /** 검증 상태 */
  status: AnnouncementVerificationStatus;
}

/** 소득 / 자산 요건 */
export interface AnnouncementIncomeAssetRequirement {
  /** 소득 요건 적용 대상 청약경로 (예: ['newlywed', 'firstLife', 'newborn']) */
  incomeApplicablePaths: string[];
  /** 부동산 자산 가액 기준 (만원 단위, 미확인 시 null) */
  assetThresholdRealEstate: number | null;
  /** 자동차 가액 기준 (만원 단위, 미확인 시 null) */
  assetThresholdVehicle: number | null;
  /** 근거 증빙 ID */
  evidenceSourceId: string;
  /** 검증 상태 */
  status: AnnouncementVerificationStatus;
}

/**
 * 입주자모집공고 데이터 온보딩 정규 모델 (SubscriptionAnnouncement)
 */
export interface SubscriptionAnnouncement {
  /** 공고 레코드 고유 ID (예: 'announcement-chokjin-3-2026-official') */
  announcementId: string;
  /** 대상 사업지 ID ('chokjin-3' | 'udong-3' | 'samik-beach' | string) */
  projectId: string;
  /** 단지/공고 공식 명칭 */
  projectName: string;
  /** 공식 입주자모집공고일 (YYYY-MM-DD) */
  announcementDate: string;

  /** 공고 전체 검증 상태 */
  status: AnnouncementVerificationStatus;
  /** 전체 공고문 원본 증빙 ID */
  overallEvidenceSourceId: string;
  /** 검증/대조 비고 */
  verificationNotes?: string;

  /** 1. 해당지역 및 거주기간 요건 */
  residenceRequirement: AnnouncementResidenceRequirement;
  /** 2. 총 공급 / 특별공급 / 일반공급 총괄 세대수 */
  totalSupplySummary: AnnouncementTotalSupplySummary;
  /** 3. 타입별 전용면적 및 세부 배정 세대수 */
  typeSupplies: AnnouncementTypeSupplyPlan[];
  /** 4. 일반공급 가점/추첨 비율 */
  generalAllocationRatio: AnnouncementGeneralAllocationRatio;
  /** 5. 청약통장/예치금 요건 */
  bankbookRequirement: AnnouncementBankbookRequirement;
  /** 6. 소득/자산 요건 */
  incomeAssetRequirement: AnnouncementIncomeAssetRequirement;
}
