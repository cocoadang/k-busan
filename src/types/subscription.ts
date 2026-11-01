/**
 * Phase 5A: 청약전략 분석 도메인 타입 정의
 * 
 * 원칙:
 * 1. 특정 청약 추천 / 당첨 확률 예측 금지 (병렬 비교 원칙)
 * 2. 모집공고별 규칙 versioning (과거 2025 규정을 미래 공고에 하드코딩 금지)
 * 3. 공고문 및 실적 자료 미공개 값은 null 유지 (임의 추정 금지)
 */

/** 거주 지역 구분 */
export type ResidenceRegion = 'busan' | 'ulsan_gyeongnam' | 'other';

/** 혼인 상태 */
export type MarriageStatus = 'single' | 'married' | 'divorced_or_widowed';

/** 소득 분위 기준 (도시근로자 가구원수별 월평균소득 대비) */
export type IncomeTier =
  | 'under_100'  // 100% 이하 (우선공급)
  | 'under_140'  // 100% 초과 ~ 140% 이하 (일반/신혼 맞벌이 등)
  | 'under_160'  // 140% 초과 ~ 160% 이하 (추첨제 대상)
  | 'under_200'  // 160% 초과 ~ 200% 이하 (신생아/맞벌이 완화구간)
  | 'over_limit'; // 소득 기준 초과

/** 사용자 청약 프로필 입력 모델 */
export interface UserSubscriptionProfile {
  /** 거주 지역 */
  residenceRegion: ResidenceRegion;
  /** 부산 전입일 (YYYY-MM-DD) */
  busanTransferDate: string;
  /** 세대주 여부 */
  isHouseholder: boolean;
  /** 무주택 여부 (true: 무주택, false: 유주택) */
  isHomeless: boolean;
  /** 무주택 기간 (년수, 0~15년 이상 - 시점계산 완료값 보존) */
  homelessYears: number;
  /** 무주택 시작일 (YYYY-MM-DD, Phase 5B-1: 시점기준 자동판정용) */
  homelessSince?: string;
  /** 보유 주택 수 (유주택인 경우) */
  ownedHouseCount: number;
  
  /** 혼인 여부 */
  marriageStatus: MarriageStatus;
  /** 혼인 기간 (년수, 혼인신고일 기준, 기혼인 경우 - 시점계산 완료값) */
  marriageYears: number;
  /** 혼인신고일 (YYYY-MM-DD, 선택) */
  marriageDate?: string;

  /** 미성년 자녀 수 (태아 포함 - 시점계산 완료값) */
  minorChildrenCount: number;
  /** 자녀 생년월일 목록 */
  childrenBirthDates: string[];
  /** 임신 중 출산 예정일 (태아, YYYY-MM-DD, Phase 5B-1) */
  expectedBirthDate?: string;
  /** 신생아 요건 (공고일 기준 2년 이내 출생한 자녀 또는 임신 중 태아 유무 - 시점계산 완료값) */
  hasNewborn: boolean;
  /** 신생아 생년월일 또는 출산예정일 (YYYY-MM-DD) */
  newbornBirthDate?: string;

  /** 생애최초 주택구입 요건 (세대원 전원 과거 주택 소유 이력 없음) */
  isFirstLifeEver: boolean;
  /** 과거 5년 이상 소득세 납부 여부 */
  taxPaid5Years: boolean;

  /** 청약통장 가입기간 (개월수) */
  bankbookMonths: number;
  /** 청약통장 예치금 (만원 단위, 부산 기준 전용85㎡ 이하 300만원, 102㎡ 이하 600만원, 135㎡ 이하 1000만원, 모든면적 1500만원) */
  depositAmount: number;

  /** 부양가족 수 (본인 제외, 주민등록표등본 등재 기준) */
  dependentCount: number;
  /** 만 65세 이상 직계존속 부양 여부 */
  supportsElderlyOver65: boolean;
  /** 만 65세 이상 직계존속 부양 기간 (년수, 동일 주민등록등본에 계속 등재된 기간) */
  elderlySupportYears: number;

  /** 소득 요건 충족 여부 / 분위 */
  incomeTier: IncomeTier;
  /** 자산 요건 충족 여부 (부동산 3억 3,100만원 이하 등) */
  assetSatisfied: boolean;
}

/** 청약 경로별 자격 판정 결과 */
export interface PathEligibilityResult {
  /** 신청 가능 여부 */
  eligible: boolean;
  /** 불가 또는 선정 관련 상세 사유 */
  reason: string;
  /** 추가 안내 또는 조건 상세 */
  details: string[];
  /** 우선공급/일반공급/추첨 분류 (해당시) */
  tier?: 'priority' | 'general' | 'lottery' | 'none';
  /** 제도 적용 상태 (not_applicable: 해당 공고일 기준 제도 미적용) */
  status?: 'applicable' | 'not_applicable';
}

/** 일반공급 가점 계산 결과 */
export interface GeneralSupplyScoreBreakdown {
  /** 무주택 기간 점수 (0~32점) */
  homelessScore: number;
  /** 부양가족 수 점수 (5~35점) */
  dependentScore: number;
  /** 청약통장 가입기간 점수 (1~17점) */
  bankbookScore: number;
  /** 총 가점 합계 (0~84점) */
  totalScore: number;
}

/** 일반공급 판정 결과 */
export interface GeneralSupplyEligibilityResult extends PathEligibilityResult {
  /** 1순위 충족 여부 */
  isFirstPriority: boolean;
  /** 84점 만점 가점 */
  scoreBreakdown: GeneralSupplyScoreBreakdown;
  /** 추첨제 대상 여부 (85㎡ 이하 60% 추첨, 85㎡ 초과 100% 추첨) */
  lotteryEligible: boolean;
  /** 추첨제 유형 (무주택 우선 75% 또는 1주택 처분조건 등) */
  lotteryCategory?: string;
}

/** 전체 청약 경로 자격 판정 종합 */
export interface ComprehensiveEligibilityAnalysis {
  /** 분석 기준 모집공고 정보 */
  targetRule: AnnouncementRule;
  /** 시점 기준이 반영된 프로필 (Phase 5B-1: 공고일 기준 자동계산 완료) */
  resolvedProfile?: UserSubscriptionProfile;
  /** 부산 거주기간 계산 결과 */
  residenceAnalysis: {
    /** 계산된 거주기간 (개월수) */
    residenceMonths: number;
    /** 표시용 기간 텍스트 (예: "1년 4개월") */
    residenceText: string;
    /** 해당지역(부산) 거주요건 충족 여부 */
    meetsLocalRequirement: boolean;
    /** 요건 설명 */
    description: string;
  };
  /** 신혼부부 특별공급 판정 */
  newlywed: PathEligibilityResult;
  /** 생애최초 특별공급 판정 */
  firstLife: PathEligibilityResult;
  /** 신생아 특별공급 판정 */
  newborn: PathEligibilityResult;
  /** 다자녀가구 특별공급 판정 */
  multiChild: PathEligibilityResult;
  /** 노부모부양 특별공급 판정 */
  elderlyParent: PathEligibilityResult;
  /** 일반공급 판정 */
  generalSupply: GeneralSupplyEligibilityResult;
}

/** 모집공고별 적용 규칙 (Versioning) */
export interface AnnouncementRule {
  /** 규칙 ID (예: 'rule-busan-2025-v1') */
  ruleId: string;
  /** 프로젝트명 또는 공고명 */
  projectName: string;
  /** 입주자모집공고일 (YYYY-MM-DD) */
  announcementDate: string;
  /** 해당지역(부산) 계속 거주 요건 (개월수, 예: 12개월 = 1년) */
  busanResidenceRequirementMonths: number;
  /** 규제지역 여부 (투기과열/조정대상 등, 부산 전지역 현재 비규제) */
  isRestrictedArea: boolean;
  /** 일반공급 공급비율 규칙 */
  generalAllocationRatio: {
    /** 85㎡ 이하 */
    under85: { pointsRatio: number; lotteryRatio: number }; // 예: 가점 40%, 추첨 60%
    /** 85㎡ 초과 */
    over85: { pointsRatio: number; lotteryRatio: number };  // 예: 추첨 100%
  };
  /** 특별공급 법정/공고 배정비율 (민영주택 기준) */
  specialSupplyRatios?: {
    multiChildRatio: number;   // 통상 10%
    newlywedRatio: number;     // 통상 18%
    firstLifeRatio: number;    // 통상 9%
    elderlyParentRatio: number;// 통상 3%
    institutionRatio: number;  // 통상 10%
  };
  /** 규칙 설명 */
  note?: string;
}

/** 특별공급 유형별 세부 데이터 */
export interface SpecialSupplyTypeDetail {
  /** 배정 세대수 (미확인시 null) */
  quota: number | null;
  /** 해당지역 접수 건수 (미확인시 null) */
  localApps: number | null;
  /** 기타지역 접수 건수 (자료 있을 때만) */
  otherApps?: number | null;
  /** 총 접수 건수 (미확인시 null) */
  totalApps: number | null;
  /** 경쟁률 (:1, 미확인시 null) */
  compRatio: number | null;
  /** 제도 적용 상태 */
  status?: 'applicable' | 'not_applicable';
}

/** 단지 타입별 특별공급 통계 */
export interface BenchmarkSpecialSupplyStats {
  /** 다자녀 가구 */
  multiChild?: SpecialSupplyTypeDetail | null;
  /** 신혼부부 */
  newlywed?: SpecialSupplyTypeDetail | null;
  /** 생애최초 */
  firstLife?: SpecialSupplyTypeDetail | null;
  /** 신생아 (2025년 모집공고는 'not_applicable', 2026-06-15 이후 공고 적용) */
  newborn?: SpecialSupplyTypeDetail | 'not_applicable' | null;
  /** 노부모 부양 */
  elderlyParent?: SpecialSupplyTypeDetail | null;
  /** 기관 추천 */
  institution?: SpecialSupplyTypeDetail | null;
  /** 특별공급 총 배정 세대수 */
  totalQuota: number;
  /** 특별공급 총 접수 건수 */
  totalApps: number;
  /** 평균 경쟁률 */
  avgCompRatio: number;
}

/** 단지 타입별 일반공급 통계 */
export interface BenchmarkGeneralSupplyStats {
  /** 일반공급 배정 세대수 (미확인시 null) */
  quota: number | null;
  /** 해당지역 접수 건수 (미확인시 null) */
  localApps: number | null;
  /** 기타지역 접수 건수 (자료 있을 때만) */
  otherApps?: number | null;
  /** 총 접수 건수 (미확인시 null) */
  totalApps: number | null;
  /** 1순위 경쟁률 (미확인시 null) */
  compRatio: number | null;
  /** 최저 당첨 가점 (미공개 또는 추첨제는 null) */
  pointsMin: number | null;
  /** 최고 당첨 가점 (미공개 또는 추첨제는 null) */
  pointsMax: number | null;
  /** 평균 당첨 가점 (미공개 또는 추첨제는 null) */
  pointsAvg: number | null;
}

/** 실적 벤치마크 타입 항목 */
export interface BenchmarkUnitTypeRecord {
  /** 타입 코드 (예: '84A', '84B', '104C', '59A') */
  typeCode: string;
  /** 전용면적 (㎡) */
  exclusiveArea: number;
  /** 공급 방식 분류 */
  supplyCategory: 'under85' | 'over85';
  /** 공급방식 설명 (예: "가점 40% + 추첨 60%" 또는 "추첨 100%") */
  supplyMethodDescription: string;
  /** 특별공급 통계 */
  specialSupply: BenchmarkSpecialSupplyStats;
  /** 일반공급 통계 */
  generalSupply: BenchmarkGeneralSupplyStats;
}

/** 최근 부산 실적 단지 레코드 (써밋 리미티드 남천, 르엘 리버파크 센텀, 베뉴브 해운대) */
export interface BenchmarkProjectRecord {
  id: string;
  name: string;
  location: string;
  announcementDate: string;
  totalUnits: number;
  generalSupplyTotalUnits: number;
  specialSupplyTotalUnits: number;
  rule: AnnouncementRule;
  types: BenchmarkUnitTypeRecord[];
  officialSourceNote: string;
}

/** 향후 모집공고 등록 시 비교 행 모델 (요구사항 4번) */
export interface TypeComparisonRow {
  /** 단지명 */
  projectName: string;
  /** 타입 (예: 59A, 84A, 84B, 114A) */
  typeCode: string;
  /** 전용면적 (㎡) */
  exclusiveArea: number;
  /** 공급방식 (예: 일반(가점 40% + 추첨 60%), 일반(추첨 100%), 특별공급) */
  supplyMethod: string;
  /** 배정세대 (계획 또는 공고 세대수) */
  quota: number | string;
  /** 사용자 조건별 신청가능 여부 */
  eligibilityStatus: {
    canApplySpecial: boolean;
    specialTypes: string[];
    canApplyGeneral: boolean;
    generalMethod: string; // "가점제+추첨제" 또는 "추첨제(100%)"
    userScore?: number;
  };
  /** 과거 유사 경쟁률 및 가점 (벤치마크 실적 연동) */
  historicalBenchmark?: {
    benchmarkProjectName: string;
    benchmarkTypeCode: string;
    compRatio: number;
    pointsMin: number | null;
    pointsAvg: number | null;
  };
}

/** Phase 5B: 다중 청약 신청자 프로필 모델 (별칭 기반) */
export interface MultiSubscriptionProfile {
  /** 고유 식별자 (예: 'profile-a', 'profile-b') */
  id: string;
  /** 프로필 별칭 (예: '프로필 A', '프로필 B', '프로필 C' - 실명/개인정보 사용 금지) */
  alias: string;
  /** 사용자 청약 상세 프로필 데이터 */
  profile: UserSubscriptionProfile;
  /** 생성 시각 */
  createdAt: number;
}

/** Phase 5B: 다중 프로필 병렬 비교 항목 분석 모델 */
export interface ProfileComparisonItem {
  id: string;
  alias: string;
  profile: UserSubscriptionProfile;
  /** 시점 기준 계산 완료 프로필 */
  resolvedProfile?: UserSubscriptionProfile;
  residenceMonths: number;
  residenceText: string;
  meetsLocalRequirement: boolean;
  scoreBreakdown: GeneralSupplyScoreBreakdown;
  analysis: ComprehensiveEligibilityAnalysis;
  isDraftNotice: boolean;
}
