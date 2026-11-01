/**
 * Phase 5A: 최근 부산 실적 DB & 모집공고 규칙 모듈
 * 
 * 원본 검증 원칙:
 * 1. 실적 데이터는 청약홈 및 공식 보도/공고 자료에서 확인된 값만 등록.
 * 2. 미공개 또는 확인되지 않은 수치는 임의 추정 없이 null로 유지.
 * 3. 85㎡ 초과 추첨제 100% 평형은 당첨가점이 없으므로 pointsMin/Max/Avg는 null.
 * 4. 모집공고별 거주요건 및 공급비율은 고정이 아닌 개별 rule 객체로 versioning 관리.
 */

import {
  AnnouncementRule,
  BenchmarkProjectRecord,
  TypeComparisonRow,
  UserSubscriptionProfile,
} from '../types/subscription.ts';

/**
 * 모집공고별 적용 규칙 레지스트리 (Rule Versioning)
 */
export const ANNOUNCEMENT_RULES: Record<string, AnnouncementRule> = {
  'rule-summit-namcheon-2025': {
    ruleId: 'rule-summit-namcheon-2025',
    projectName: '써밋 리미티드 남천',
    announcementDate: '2025-07-31',
    busanResidenceRequirementMonths: 12, // 부산광역시 1년 이상 계속 거주자 우선공급
    isRestrictedArea: false,
    generalAllocationRatio: {
      under85: { pointsRatio: 40, lotteryRatio: 60 },
      over85: { pointsRatio: 0, lotteryRatio: 100 },
    },
    specialSupplyRatios: {
      multiChildRatio: 10,
      newlywedRatio: 18,
      firstLifeRatio: 9,
      elderlyParentRatio: 3,
      institutionRatio: 10,
    },
    note: '부산광역시 수영구 남천동 대연비치 푸르지오 써밋 입주자모집공고 기준',
  },
  'rule-luel-centum-2025': {
    ruleId: 'rule-luel-centum-2025',
    projectName: '르엘 리버파크 센텀',
    announcementDate: '2025-07-11',
    busanResidenceRequirementMonths: 12, // 부산광역시 1년 이상 계속 거주자 우선공급
    isRestrictedArea: false,
    generalAllocationRatio: {
      under85: { pointsRatio: 40, lotteryRatio: 60 },
      over85: { pointsRatio: 0, lotteryRatio: 100 },
    },
    specialSupplyRatios: {
      multiChildRatio: 10,
      newlywedRatio: 18,
      firstLifeRatio: 9,
      elderlyParentRatio: 3,
      institutionRatio: 10,
    },
    note: '부산광역시 해운대구 재송동 센텀 한진CY부지 입주자모집공고 기준',
  },
  'rule-venueve-haeundae-2025': {
    ruleId: 'rule-venueve-haeundae-2025',
    projectName: '베뉴브 해운대',
    announcementDate: '2025-09-19',
    busanResidenceRequirementMonths: 12, // 부산광역시 1년 이상 계속 거주자 우선공급
    isRestrictedArea: false,
    generalAllocationRatio: {
      under85: { pointsRatio: 40, lotteryRatio: 60 },
      over85: { pointsRatio: 0, lotteryRatio: 100 },
    },
    specialSupplyRatios: {
      multiChildRatio: 10,
      newlywedRatio: 18,
      firstLifeRatio: 9,
      elderlyParentRatio: 3,
      institutionRatio: 10,
    },
    note: '부산광역시 해운대구 우동 1074번지 입주자모집공고 기준',
  },
  // 향후 등록될 촉진3구역 / 우동3구역 / 삼익비치 예정 공고 규칙 프로토타입
  'rule-chokjin-3-draft': {
    ruleId: 'rule-chokjin-3-draft',
    projectName: '촉진3구역 (모집공고 예정 모델)',
    announcementDate: '2026-06-30',
    busanResidenceRequirementMonths: 12,
    isRestrictedArea: false,
    generalAllocationRatio: {
      under85: { pointsRatio: 40, lotteryRatio: 60 },
      over85: { pointsRatio: 0, lotteryRatio: 100 },
    },
    note: '촉진3구역 사업시행인가 기반 모집공고 예상 적용 규칙 (Rule Version 2026-draft)',
  },
  'rule-udong-3-draft': {
    ruleId: 'rule-udong-3-draft',
    projectName: '우동3구역 (모집공고 예정 모델)',
    announcementDate: '2026-09-30',
    busanResidenceRequirementMonths: 12,
    isRestrictedArea: false,
    generalAllocationRatio: {
      under85: { pointsRatio: 40, lotteryRatio: 60 },
      over85: { pointsRatio: 0, lotteryRatio: 100 },
    },
    note: '우동3구역 정비계획 기반 모집공고 예상 적용 규칙 (Rule Version 2026-draft)',
  },
  'rule-samik-beach-draft': {
    ruleId: 'rule-samik-beach-draft',
    projectName: '삼익비치(남천2구역) (모집공고 예정 모델)',
    announcementDate: '2027-03-31',
    busanResidenceRequirementMonths: 12,
    isRestrictedArea: false,
    generalAllocationRatio: {
      under85: { pointsRatio: 40, lotteryRatio: 60 },
      over85: { pointsRatio: 0, lotteryRatio: 100 },
    },
    note: '삼익비치 사업계획 기반 모집공고 예상 적용 규칙 (Rule Version 2027-draft)',
  },
};

/**
 * 1. 써밋 리미티드 남천 실적 레코드
 */
export const SUMMIT_NAMCHEON_BENCHMARK: BenchmarkProjectRecord = {
  id: 'summit-namcheon',
  name: '써밋 리미티드 남천',
  location: '부산광역시 수영구 남천동 545-2번지 일원 (대연비치 푸르지오 써밋)',
  announcementDate: '2025-07-31',
  totalUnits: 835,
  generalSupplyTotalUnits: 720,
  specialSupplyTotalUnits: 164,
  rule: ANNOUNCEMENT_RULES['rule-summit-namcheon-2025'],
  officialSourceNote:
    '청약홈 및 입주자모집공고 접수결과 (일반공급 720세대 16,286명 접수 평균 22.6:1, 특별공급 164세대 1,150명 접수 평균 7.01:1)',
  types: [
    {
      typeCode: '84A',
      exclusiveArea: 84.92,
      supplyCategory: 'under85',
      supplyMethodDescription: '가점 40% + 추첨 60%',
      specialSupply: {
        totalQuota: 40,
        totalApps: 377,
        avgCompRatio: 9.43,
        multiChild: null,
        newlywed: null,
        firstLife: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: 33,
        localApps: 4150,
        otherApps: null,
        totalApps: 4150,
        compRatio: 125.8,
        pointsMin: null,
        pointsMax: null,
        pointsAvg: 67.79,
      },
    },
    {
      typeCode: '84B',
      exclusiveArea: 84.95,
      supplyCategory: 'under85',
      supplyMethodDescription: '가점 40% + 추첨 60%',
      specialSupply: {
        totalQuota: 31,
        totalApps: 717,
        avgCompRatio: 23.13,
        newlywed: {
          quota: 15,
          localApps: 524,
          otherApps: null,
          totalApps: 524,
          compRatio: 34.93,
        },
        firstLife: {
          quota: 5,
          localApps: 217,
          otherApps: null,
          totalApps: 217,
          compRatio: 43.4,
        },
        multiChild: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: 24,
        localApps: 7840,
        otherApps: 540,
        totalApps: 8380,
        compRatio: 326.67, // 청약홈 공식 해당지역 경쟁률 (기타지역 단순합산 비공식치: 349.17:1)
        pointsMin: 72,
        pointsMax: 80,
        pointsAvg: 75.1,
      },
    },
    {
      typeCode: '112A',
      exclusiveArea: 112.4,
      supplyCategory: 'over85',
      supplyMethodDescription: '추첨 100%',
      specialSupply: {
        totalQuota: 28,
        totalApps: null,
        avgCompRatio: 0,
        multiChild: null,
        newlywed: null,
        firstLife: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: null,
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: null,
        pointsMin: null, // 85㎡ 초과 추첨 100% (가점 미적용)
        pointsMax: null,
        pointsAvg: null,
      },
    },
    {
      typeCode: '112B',
      exclusiveArea: 112.5,
      supplyCategory: 'over85',
      supplyMethodDescription: '추첨 100%',
      specialSupply: {
        totalQuota: 25,
        totalApps: null,
        avgCompRatio: 0,
        multiChild: null,
        newlywed: null,
        firstLife: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: null,
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: 18.68,
        pointsMin: null,
        pointsMax: null,
        pointsAvg: null,
      },
    },
    {
      typeCode: '122',
      exclusiveArea: 122.8,
      supplyCategory: 'over85',
      supplyMethodDescription: '추첨 100%',
      specialSupply: {
        totalQuota: 14,
        totalApps: 18,
        avgCompRatio: 1.29,
        multiChild: {
          quota: 14,
          localApps: 18,
          otherApps: null,
          totalApps: 18,
          compRatio: 1.29,
        },
        newlywed: null,
        firstLife: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: null,
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: null,
        pointsMin: null,
        pointsMax: null,
        pointsAvg: null,
      },
    },
  ],
};

/**
 * 2. 르엘 리버파크 센텀 실적 레코드
 */
export const LUEL_CENTUM_BENCHMARK: BenchmarkProjectRecord = {
  id: 'luel-centum',
  name: '르엘 리버파크 센텀',
  location: '부산광역시 해운대구 재송동 일원 (센텀 한진CY부지)',
  announcementDate: '2025-07-11',
  totalUnits: 2070,
  generalSupplyTotalUnits: 1961,
  specialSupplyTotalUnits: 310,
  rule: ANNOUNCEMENT_RULES['rule-luel-centum-2025'],
  officialSourceNote:
    '청약홈 및 공식 접수결과 (일반공급 1,961세대 9,150건 접수 평균 4.66:1, 특별공급 310세대 575건 접수 평균 1.85:1)',
  types: [
    {
      typeCode: '84',
      exclusiveArea: 84.88,
      supplyCategory: 'under85',
      supplyMethodDescription: '가점 40% + 추첨 60%',
      specialSupply: {
        totalQuota: 64,
        totalApps: 380,
        avgCompRatio: 5.94,
        multiChild: null,
        newlywed: null,
        firstLife: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: 56,
        localApps: 6517,
        otherApps: null,
        totalApps: 6517,
        compRatio: 116.4,
        pointsMin: 65,
        pointsMax: null, // 미공개 null
        pointsAvg: null, // 미공개 null
      },
    },
    {
      typeCode: '104A',
      exclusiveArea: 104.2,
      supplyCategory: 'over85',
      supplyMethodDescription: '추첨 100%',
      specialSupply: {
        totalQuota: 20,
        totalApps: 15,
        avgCompRatio: 0.75,
        multiChild: null,
        newlywed: null,
        firstLife: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: null,
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: 1.3,
        pointsMin: null,
        pointsMax: null,
        pointsAvg: null,
      },
    },
    {
      typeCode: '104B',
      exclusiveArea: 104.5,
      supplyCategory: 'over85',
      supplyMethodDescription: '추첨 100%',
      specialSupply: {
        totalQuota: 15,
        totalApps: 10,
        avgCompRatio: 0.67,
        multiChild: null,
        newlywed: null,
        firstLife: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: null,
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: 1.3,
        pointsMin: null,
        pointsMax: null,
        pointsAvg: null,
      },
    },
    {
      typeCode: '104C',
      exclusiveArea: 104.8,
      supplyCategory: 'over85',
      supplyMethodDescription: '추첨 100%',
      specialSupply: {
        totalQuota: 15,
        totalApps: 42,
        avgCompRatio: 2.8,
        multiChild: null,
        newlywed: null,
        firstLife: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: 105,
        localApps: 1292,
        otherApps: null,
        totalApps: 1292,
        compRatio: 13.2,
        pointsMin: 12,
        pointsMax: null,
        pointsAvg: null,
      },
    },
    {
      typeCode: '104D',
      exclusiveArea: 104.9,
      supplyCategory: 'over85',
      supplyMethodDescription: '추첨 100%',
      specialSupply: {
        totalQuota: 10,
        totalApps: 8,
        avgCompRatio: 0.8,
        multiChild: null,
        newlywed: null,
        firstLife: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: null,
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: 1.38,
        pointsMin: null,
        pointsMax: null,
        pointsAvg: null,
      },
    },
    {
      typeCode: '244 (펜트)',
      exclusiveArea: 244.5,
      supplyCategory: 'over85',
      supplyMethodDescription: '추첨 100%',
      specialSupply: {
        totalQuota: 0,
        totalApps: 0,
        avgCompRatio: 0,
        newborn: 'not_applicable',
      },
      generalSupply: {
        quota: null,
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: 2.33,
        pointsMin: null,
        pointsMax: null,
        pointsAvg: null,
      },
    },
  ],
};

/**
 * 3. 베뉴브 해운대 실적 레코드
 */
export const VENUEVE_HAEUNDAE_BENCHMARK: BenchmarkProjectRecord = {
  id: 'venueve-haeundae',
  name: '베뉴브 해운대',
  location: '부산광역시 해운대구 우동 1074번지 일원',
  announcementDate: '2025-09-19',
  totalUnits: 660,
  generalSupplyTotalUnits: 331,
  specialSupplyTotalUnits: 298,
  rule: ANNOUNCEMENT_RULES['rule-venueve-haeundae-2025'],
  officialSourceNote:
    '청약홈 및 입주자모집공고(공고번호 2025000415) 결과 (일반공급 331세대 8,781명 접수, 특별공급 298세대 1,208건 접수 평균 4.05:1)',
  types: [
    {
      typeCode: '59A',
      exclusiveArea: 59.92,
      supplyCategory: 'under85',
      supplyMethodDescription: '가점 40% + 추첨 60%',
      specialSupply: {
        totalQuota: 13,
        totalApps: 556,
        avgCompRatio: 42.77,
        newlywed: {
          quota: 6,
          localApps: 131,
          otherApps: null,
          totalApps: 131,
          compRatio: 21.83,
        },
        firstLife: {
          quota: 2,
          localApps: 412,
          otherApps: null,
          totalApps: 412,
          compRatio: 206.0,
        },
        multiChild: {
          quota: 2,
          localApps: 11,
          otherApps: null,
          totalApps: 11,
          compRatio: 5.5,
        },
        elderlyParent: {
          quota: 1,
          localApps: 2,
          otherApps: null,
          totalApps: 2,
          compRatio: 2.0,
        },
        institution: {
          quota: 2,
          localApps: null,
          otherApps: null,
          totalApps: null,
          compRatio: null,
        },
        newborn: 'not_applicable',
      },
      generalSupply: {
        quota: 11,
        localApps: 1952,
        otherApps: 269,
        totalApps: 2221,
        compRatio: 177.5,
        pointsMin: 67,
        pointsMax: 67,
        pointsAvg: 67,
      },
    },
    {
      typeCode: '59B',
      exclusiveArea: 59.85,
      supplyCategory: 'under85',
      supplyMethodDescription: '가점 40% + 추첨 60%',
      specialSupply: {
        totalQuota: 0,
        totalApps: 0,
        avgCompRatio: 0,
        multiChild: null,
        newlywed: null,
        firstLife: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: 1,
        localApps: 132,
        otherApps: null,
        totalApps: 132,
        compRatio: 132.0,
        pointsMin: 69,
        pointsMax: 69,
        pointsAvg: 69,
      },
    },
    {
      typeCode: '84A',
      exclusiveArea: 84.91,
      supplyCategory: 'under85',
      supplyMethodDescription: '가점 40% + 추첨 60%',
      specialSupply: {
        totalQuota: 50,
        totalApps: null,
        avgCompRatio: 0,
        newlywed: {
          quota: 21,
          localApps: 14,
          otherApps: null,
          totalApps: 14,
          compRatio: 0.67,
        },
        elderlyParent: {
          quota: 3,
          localApps: 1,
          otherApps: null,
          totalApps: 1,
          compRatio: 0.33,
        },
        multiChild: {
          quota: 9,
          localApps: null,
          otherApps: null,
          totalApps: null,
          compRatio: null,
        },
        firstLife: {
          quota: 8,
          localApps: null,
          otherApps: null,
          totalApps: null,
          compRatio: null,
        },
        institution: {
          quota: 9,
          localApps: null,
          otherApps: null,
          totalApps: null,
          compRatio: null,
        },
        newborn: 'not_applicable',
      },
      generalSupply: {
        quota: 42,
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: 9.4,
        pointsMin: 51,
        pointsMax: 51,
        pointsAvg: 51,
      },
    },
    {
      typeCode: '84B',
      exclusiveArea: 84.88,
      supplyCategory: 'under85',
      supplyMethodDescription: '가점 40% + 추첨 60%',
      specialSupply: {
        totalQuota: 50,
        totalApps: 96,
        avgCompRatio: 1.92,
        newlywed: {
          quota: 21,
          localApps: 65,
          otherApps: null,
          totalApps: 65,
          compRatio: 3.1,
        },
        multiChild: {
          quota: 9,
          localApps: 26,
          otherApps: null,
          totalApps: 26,
          compRatio: 2.89,
        },
        elderlyParent: {
          quota: 5,
          localApps: 5,
          otherApps: null,
          totalApps: 5,
          compRatio: 1.0,
        },
        firstLife: null,
        newborn: 'not_applicable',
      },
      generalSupply: {
        quota: 41, // 원자료 41세대 (기존 오류값: 42세대)
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: 32.90, // 원자료 청약홈 공식 경쟁률 32.90:1 (기존 오입력치 20.95 -> 32.90 수정)
        pointsMin: 65,
        pointsMax: 65,
        pointsAvg: 65,
      },
    },
    {
      typeCode: '84C',
      exclusiveArea: 84.95,
      supplyCategory: 'under85',
      supplyMethodDescription: '가점 40% + 추첨 60%',
      specialSupply: {
        totalQuota: 73,
        totalApps: null,
        avgCompRatio: 0,
        elderlyParent: {
          quota: 2,
          localApps: 2,
          otherApps: null,
          totalApps: 2,
          compRatio: 1.0,
        },
        multiChild: null,
        newlywed: null,
        firstLife: null,
        newborn: 'not_applicable',
      },
      generalSupply: {
        quota: 61,
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: 6.0,
        pointsMin: 45,
        pointsMax: 45,
        pointsAvg: 45,
      },
    },
    {
      typeCode: '84D',
      exclusiveArea: 84.93,
      supplyCategory: 'under85',
      supplyMethodDescription: '가점 40% + 추첨 60%',
      specialSupply: {
        totalQuota: 24,
        totalApps: 28,
        avgCompRatio: 1.17,
        firstLife: {
          quota: 5,
          localApps: 28,
          otherApps: null,
          totalApps: 28,
          compRatio: 5.6,
        },
        multiChild: null,
        newlywed: null,
        newborn: 'not_applicable',
        elderlyParent: null,
      },
      generalSupply: {
        quota: 20,
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: 85.9,
        pointsMin: 69,
        pointsMax: 69,
        pointsAvg: 69,
      },
    },
    {
      typeCode: '84E',
      exclusiveArea: 84.89,
      supplyCategory: 'under85',
      supplyMethodDescription: '가점 40% + 추첨 60%',
      specialSupply: {
        totalQuota: 74,
        totalApps: null,
        avgCompRatio: 0,
        newborn: 'not_applicable',
      },
      generalSupply: {
        quota: 61,
        localApps: null,
        otherApps: null,
        totalApps: null,
        compRatio: 3.4,
        pointsMin: 34,
        pointsMax: 34,
        pointsAvg: 34,
      },
    },
    {
      typeCode: '99',
      exclusiveArea: 99.82,
      supplyCategory: 'over85',
      supplyMethodDescription: '추첨 100%',
      specialSupply: {
        totalQuota: 14,
        totalApps: 4,
        avgCompRatio: 0.29,
        elderlyParent: {
          quota: 3,
          localApps: 4,
          otherApps: null,
          totalApps: 4,
          compRatio: 1.33,
        },
        newborn: 'not_applicable',
      },
      generalSupply: {
        quota: 94,
        localApps: 1721,
        otherApps: null,
        totalApps: 1721,
        compRatio: 18.3,
        pointsMin: null, // 추첨 100% (가점 미적용)
        pointsMax: null,
        pointsAvg: null,
      },
    },
  ],
};

/** 최근 부산 실적 3대 복합단지 DB 목록 */
export const BENCHMARK_PROJECTS: BenchmarkProjectRecord[] = [
  SUMMIT_NAMCHEON_BENCHMARK,
  LUEL_CENTUM_BENCHMARK,
  VENUEVE_HAEUNDAE_BENCHMARK,
];

/**
 * 9가지 필수 검증 프리셋 프로필 (사용자 편의 및 검증 테스트용)
 */
export const SUBSCRIPTION_PRESETS: {
  id: string;
  name: string;
  badge: string;
  description: string;
  profile: UserSubscriptionProfile;
}[] = [
  {
    id: 'preset-newlywed',
    name: '신혼부부',
    badge: '혼인 3년차',
    description: '혼인 3년차 기혼, 무주택 3년, 자녀 1명, 소득 140% 이하 충족',
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2023-01-10',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 3,
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 3,
      marriageDate: '2022-05-15',
      minorChildrenCount: 1,
      childrenBirthDates: ['2023-03-20'],
      hasNewborn: false,
      isFirstLifeEver: false,
      taxPaid5Years: true,
      bankbookMonths: 36,
      depositAmount: 300,
      dependentCount: 2,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_140',
      assetSatisfied: true,
    },
  },
  {
    id: 'preset-newlywed-firstlife',
    name: '신혼 + 생애최초',
    badge: '신혼·생초 동시',
    description: '결혼 2년차, 과거 주택 소유 이력 전무, 5년 소득세 납부 완료',
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2022-08-01',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 5,
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 2,
      marriageDate: '2023-06-10',
      minorChildrenCount: 0,
      childrenBirthDates: [],
      hasNewborn: false,
      isFirstLifeEver: true,
      taxPaid5Years: true,
      bankbookMonths: 48,
      depositAmount: 600,
      dependentCount: 1,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_140',
      assetSatisfied: true,
    },
  },
  {
    id: 'preset-newlywed-newborn',
    name: '신혼 + 신생아',
    badge: '혼인1년·생후6개월',
    description: '혼인 1년차, 공고일 기준 2년 이내 출생 신생아 보유, 무주택',
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2022-03-15',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 4,
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 1,
      marriageDate: '2024-04-12',
      minorChildrenCount: 1,
      childrenBirthDates: ['2025-01-20'],
      hasNewborn: true,
      newbornBirthDate: '2025-01-20',
      isFirstLifeEver: true,
      taxPaid5Years: true,
      bankbookMonths: 30,
      depositAmount: 300,
      dependentCount: 2,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_140',
      assetSatisfied: true,
    },
  },
  {
    id: 'preset-multi-child',
    name: '자녀 2명 이상 (다자녀)',
    badge: '2자녀 다자녀',
    description: '미성년 자녀 2명(2024 개정 다자녀 요건 완화 충족), 무주택 7년',
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2021-02-01',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 7,
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 8,
      minorChildrenCount: 2,
      childrenBirthDates: ['2016-05-10', '2019-11-22'],
      hasNewborn: false,
      isFirstLifeEver: false,
      taxPaid5Years: true,
      bankbookMonths: 84,
      depositAmount: 600,
      dependentCount: 3,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_160',
      assetSatisfied: true,
    },
  },
  {
    id: 'preset-newborn-multichild',
    name: '신생아 + 다자녀',
    badge: '2자녀+신생아',
    description: '미성년 자녀 2명 중 1명이 1세 영아, 신생아 및 다자녀 동시 충족',
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2020-05-01',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 6,
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 5,
      minorChildrenCount: 2,
      childrenBirthDates: ['2021-07-15', '2024-10-05'],
      hasNewborn: true,
      newbornBirthDate: '2024-10-05',
      isFirstLifeEver: false,
      taxPaid5Years: true,
      bankbookMonths: 60,
      depositAmount: 600,
      dependentCount: 3,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_160',
      assetSatisfied: true,
    },
  },
  {
    id: 'preset-elderly-70-homeless',
    name: '70세 장기무주택 세대주',
    badge: '가점 고득점자',
    description: '만 70세, 무주택 15년 이상(32점 만점), 청약통장 15년(17점 만점)',
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2010-01-01',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 15,
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 40,
      minorChildrenCount: 0,
      childrenBirthDates: [],
      hasNewborn: false,
      isFirstLifeEver: false,
      taxPaid5Years: true,
      bankbookMonths: 180,
      depositAmount: 1000,
      dependentCount: 2,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_100',
      assetSatisfied: true,
    },
  },
  {
    id: 'preset-elderly-parent',
    name: '65세 이상 부모 부양 세대주',
    badge: '노부모부양 특공',
    description: '만 68세 모친을 4년간 동일등본 계속 부양, 무주택 세대주',
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2018-03-01',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 9,
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 10,
      minorChildrenCount: 1,
      childrenBirthDates: ['2017-04-12'],
      hasNewborn: false,
      isFirstLifeEver: false,
      taxPaid5Years: true,
      bankbookMonths: 96,
      depositAmount: 600,
      dependentCount: 3,
      supportsElderlyOver65: true,
      elderlySupportYears: 4,
      incomeTier: 'under_140',
      assetSatisfied: true,
    },
  },
  {
    id: 'preset-busan-recent-transfer',
    name: '부산 전입 직후',
    badge: '전입 2개월',
    description: '부산 전입 2개월 (공고일 기준 1년 미만 → 기타지역 접수)',
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2025-05-20', // 공고일(2025-07-31) 기준 약 2개월
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 4,
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 3,
      minorChildrenCount: 1,
      childrenBirthDates: ['2023-08-10'],
      hasNewborn: false,
      isFirstLifeEver: true,
      taxPaid5Years: true,
      bankbookMonths: 36,
      depositAmount: 300,
      dependentCount: 2,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_140',
      assetSatisfied: true,
    },
  },
  {
    id: 'preset-busan-longterm',
    name: '부산 장기거주',
    badge: '부산 10년 거주',
    description: '부산 10년 거주로 공고일 기준 1년 이상 우선공급 100% 충족',
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2015-01-01',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 8,
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 6,
      minorChildrenCount: 1,
      childrenBirthDates: ['2020-03-01'],
      hasNewborn: false,
      isFirstLifeEver: true,
      taxPaid5Years: true,
      bankbookMonths: 72,
      depositAmount: 600,
      dependentCount: 2,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_140',
      assetSatisfied: true,
    },
  },
];

/**
 * 향후 촉진3 / 우동3 / 삼익비치 등 계획 단지의 타입별 공급방식 시뮬레이션 테이블 생성
 * 
 * 85㎡ 이하/초과에 따른 공급방식 차이는 해당 공고 규칙을 기준으로 동적 계산
 */
export function generateFuturePlanComparisonRows(
  projectId: string,
  userProfile: UserSubscriptionProfile,
  rule: AnnouncementRule
): TypeComparisonRow[] {
  // 프로젝트별 계획 타입군
  let rawTypes: {
    projectName: string;
    typeCode: string;
    exclusiveArea: number;
    quota: number;
    benchmarkRef?: {
      benchmarkProjectName: string;
      benchmarkTypeCode: string;
      compRatio: number;
      pointsMin: number | null;
      pointsAvg: number | null;
    };
  }[] = [];

  if (projectId === 'chokjin-3') {
    rawTypes = [
      {
        projectName: '촉진3구역',
        typeCode: '59A',
        exclusiveArea: 59.9,
        quota: 174,
        benchmarkRef: {
          benchmarkProjectName: '베뉴브 해운대',
          benchmarkTypeCode: '59A',
          compRatio: 177.5,
          pointsMin: 67,
          pointsAvg: 67,
        },
      },
      {
        projectName: '촉진3구역',
        typeCode: '59B',
        exclusiveArea: 59.8,
        quota: 300,
        benchmarkRef: {
          benchmarkProjectName: '베뉴브 해운대',
          benchmarkTypeCode: '59B',
          compRatio: 21.33,
          pointsMin: 69,
          pointsAvg: 69,
        },
      },
      {
        projectName: '촉진3구역',
        typeCode: '84A1',
        exclusiveArea: 84.9,
        quota: 232,
        benchmarkRef: {
          benchmarkProjectName: '써밋 리미티드 남천',
          benchmarkTypeCode: '84A',
          compRatio: 125.8,
          pointsMin: null,
          pointsAvg: 67.79,
        },
      },
      {
        projectName: '촉진3구역',
        typeCode: '84B',
        exclusiveArea: 84.8,
        quota: 148,
        benchmarkRef: {
          benchmarkProjectName: '써밋 리미티드 남천',
          benchmarkTypeCode: '84B',
          compRatio: 326.67,
          pointsMin: 72,
          pointsAvg: 75.1,
        },
      },
      {
        projectName: '촉진3구역',
        typeCode: '84C',
        exclusiveArea: 84.9,
        quota: 275,
        benchmarkRef: {
          benchmarkProjectName: '르엘 리버파크 센텀',
          benchmarkTypeCode: '84',
          compRatio: 116.4,
          pointsMin: 65,
          pointsAvg: null,
        },
      },
      {
        projectName: '촉진3구역',
        typeCode: '98C',
        exclusiveArea: 98.4,
        quota: 311,
        benchmarkRef: {
          benchmarkProjectName: '베뉴브 해운대',
          benchmarkTypeCode: '99',
          compRatio: 18.3,
          pointsMin: null,
          pointsAvg: null,
        },
      },
      {
        projectName: '촉진3구역',
        typeCode: '114A',
        exclusiveArea: 114.2,
        quota: 103,
        benchmarkRef: {
          benchmarkProjectName: '써밋 리미티드 남천',
          benchmarkTypeCode: '112A',
          compRatio: 12.0,
          pointsMin: null,
          pointsAvg: null,
        },
      },
      {
        projectName: '촉진3구역',
        typeCode: '124A',
        exclusiveArea: 124.5,
        quota: 43,
        benchmarkRef: {
          benchmarkProjectName: '써밋 리미티드 남천',
          benchmarkTypeCode: '122',
          compRatio: 14.0,
          pointsMin: null,
          pointsAvg: null,
        },
      },
    ];
  } else if (projectId === 'udong-3') {
    rawTypes = [
      {
        projectName: '우동3구역',
        typeCode: '59A',
        exclusiveArea: 59.9,
        quota: 180,
        benchmarkRef: {
          benchmarkProjectName: '베뉴브 해운대',
          benchmarkTypeCode: '59A',
          compRatio: 177.5,
          pointsMin: 67,
          pointsAvg: 67,
        },
      },
      {
        projectName: '우동3구역',
        typeCode: '84A',
        exclusiveArea: 84.9,
        quota: 650,
        benchmarkRef: {
          benchmarkProjectName: '써밋 리미티드 남천',
          benchmarkTypeCode: '84A',
          compRatio: 125.8,
          pointsMin: null,
          pointsAvg: 67.79,
        },
      },
      {
        projectName: '우동3구역',
        typeCode: '84B',
        exclusiveArea: 84.9,
        quota: 420,
        benchmarkRef: {
          benchmarkProjectName: '베뉴브 해운대',
          benchmarkTypeCode: '84B',
          compRatio: 32.90,
          pointsMin: 65,
          pointsAvg: 65,
        },
      },
      {
        projectName: '우동3구역',
        typeCode: '104',
        exclusiveArea: 104.5,
        quota: 310,
        benchmarkRef: {
          benchmarkProjectName: '르엘 리버파크 센텀',
          benchmarkTypeCode: '104C',
          compRatio: 13.2,
          pointsMin: 12,
          pointsAvg: null,
        },
      },
      {
        projectName: '우동3구역',
        typeCode: '120',
        exclusiveArea: 120.2,
        quota: 150,
        benchmarkRef: {
          benchmarkProjectName: '써밋 리미티드 남천',
          benchmarkTypeCode: '122',
          compRatio: 14.0,
          pointsMin: null,
          pointsAvg: null,
        },
      },
    ];
  } else {
    // samik-beach
    rawTypes = [
      {
        projectName: '삼익비치(남천2구역)',
        typeCode: '59',
        exclusiveArea: 59.9,
        quota: 220,
        benchmarkRef: {
          benchmarkProjectName: '베뉴브 해운대',
          benchmarkTypeCode: '59A',
          compRatio: 177.5,
          pointsMin: 67,
          pointsAvg: 67,
        },
      },
      {
        projectName: '삼익비치(남천2구역)',
        typeCode: '84A',
        exclusiveArea: 84.9,
        quota: 780,
        benchmarkRef: {
          benchmarkProjectName: '써밋 리미티드 남천',
          benchmarkTypeCode: '84B',
          compRatio: 326.67,
          pointsMin: 72,
          pointsAvg: 75.1,
        },
      },
      {
        projectName: '삼익비치(남천2구역)',
        typeCode: '110',
        exclusiveArea: 110.5,
        quota: 450,
        benchmarkRef: {
          benchmarkProjectName: '써밋 리미티드 남천',
          benchmarkTypeCode: '112A',
          compRatio: 12.0,
          pointsMin: null,
          pointsAvg: null,
        },
      },
      {
        projectName: '삼익비치(남천2구역)',
        typeCode: '135',
        exclusiveArea: 135.2,
        quota: 190,
        benchmarkRef: {
          benchmarkProjectName: '르엘 리버파크 센텀',
          benchmarkTypeCode: '104C',
          compRatio: 13.2,
          pointsMin: 12,
          pointsAvg: null,
        },
      },
    ];
  }

  // 사용자 가점
  let userScore = 0;
  if (userProfile.isHomeless) {
    if (userProfile.homelessYears < 1) userScore += 2;
    else if (userProfile.homelessYears >= 15) userScore += 32;
    else userScore += (userProfile.homelessYears + 1) * 2;
  }
  userScore += Math.min(35, Math.min(6, userProfile.dependentCount) * 5 + 5);
  if (userProfile.bankbookMonths < 6) userScore += 1;
  else if (userProfile.bankbookMonths >= 180) userScore += 17;
  else userScore += Math.floor(userProfile.bankbookMonths / 12) + 2;

  return rawTypes.map((item) => {
    const isUnder85 = item.exclusiveArea <= 85;
    const ruleRatio = isUnder85
      ? rule.generalAllocationRatio.under85
      : rule.generalAllocationRatio.over85;

    const supplyMethod =
      ruleRatio.pointsRatio > 0
        ? `가점 ${ruleRatio.pointsRatio}% + 추첨 ${ruleRatio.lotteryRatio}%`
        : `추첨 100%`;

    // 특별공급 신청 가능 여부 (모집공고일 기준 Rule Versioning 적용)
    const specialTypes: string[] = [];
    if (
      userProfile.isHomeless &&
      userProfile.bankbookMonths >= 6 &&
      userProfile.assetSatisfied &&
      userProfile.incomeTier !== 'over_limit'
    ) {
      if (userProfile.marriageStatus === 'married' && userProfile.marriageYears <= 7 && isUnder85) {
        specialTypes.push('신혼부부');
      }
      if (userProfile.isFirstLifeEver && userProfile.taxPaid5Years && isUnder85) {
        specialTypes.push('생애최초');
      }
      // 2026-06-15 이후 공고에서만 현행 독립 신생아특공 적용
      if (userProfile.hasNewborn && rule.announcementDate >= '2026-06-15') {
        specialTypes.push('신생아');
      }
      // 2024-03-25 이후 공고는 2자녀 완화, 이전은 3자녀
      const minChildren = rule.announcementDate >= '2024-03-25' ? 2 : 3;
      if (userProfile.minorChildrenCount >= minChildren) {
        specialTypes.push('다자녀');
      }
      if (
        userProfile.isHouseholder &&
        userProfile.supportsElderlyOver65 &&
        userProfile.elderlySupportYears >= 3
      ) {
        specialTypes.push('노부모');
      }
    }

    const canApplySpecial = specialTypes.length > 0;
    const canApplyGeneral = userProfile.bankbookMonths >= 6 && userProfile.depositAmount >= 300;

    return {
      projectName: item.projectName,
      typeCode: item.typeCode,
      exclusiveArea: item.exclusiveArea,
      supplyMethod,
      quota: item.quota,
      eligibilityStatus: {
        canApplySpecial,
        specialTypes,
        canApplyGeneral,
        generalMethod: isUnder85 ? '가점 40% + 추첨 60%' : '추첨 100%',
        userScore: isUnder85 ? userScore : undefined,
      },
      historicalBenchmark: item.benchmarkRef,
    };
  });
}
