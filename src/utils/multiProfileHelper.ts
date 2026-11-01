/**
 * Phase 5B: 다중 청약 프로필 관리 및 병렬 비교 헬퍼
 * 
 * 원칙:
 * 1. 이름은 프로필 A/B/C 등 별칭만 사용 (실명/개인정보 엄격 금지)
 * 2. 특정 프로필/청약경로 추천 및 순위화 금지 (병렬 비교 원칙)
 * 3. 모집공고일 기준 거주기간 및 자격 자동 계산
 * 4. 미래 공고(촉진3/우동3/삼익비치)는 모집공고 등록 전 '공고 확인 필요' 명시
 */

import {
  AnnouncementRule,
  MultiSubscriptionProfile,
  ProfileComparisonItem,
  UserSubscriptionProfile,
} from '../types/subscription.ts';
import {
  calculateGeneralSupplyScore,
  calculateResidencePeriod,
  evaluateSubscriptionEligibility,
} from './subscriptionCalculator.ts';

const ALIAS_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

/** 사용 가능한 다음 프로필 별칭 생성 ('프로필 A', '프로필 B'...) */
export function getNextProfileAlias(existingAliases: string[]): string {
  const existingLetters = new Set(
    existingAliases
      .map((a) => {
        const match = a.match(/프로필\s*([A-Z])/i);
        return match ? match[1].toUpperCase() : '';
      })
      .filter(Boolean)
  );

  for (const letter of ALIAS_LETTERS) {
    if (!existingLetters.has(letter)) {
      return `프로필 ${letter}`;
    }
  }
  return `프로필 ${existingAliases.length + 1}`;
}

/** 기본 3대 초기 프로필 (신혼부부, 다자녀+신생아, 노부모부양 세대주) */
export const DEFAULT_MULTI_PROFILES: MultiSubscriptionProfile[] = [
  {
    id: 'profile-a',
    alias: '프로필 A',
    createdAt: 1,
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2023-01-10',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 3,
      homelessSince: '2022-01-10',
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 3,
      marriageDate: '2022-05-15',
      minorChildrenCount: 1,
      childrenBirthDates: ['2023-05-15'],
      hasNewborn: false,
      isFirstLifeEver: false,
      taxPaid5Years: true,
      bankbookMonths: 48,
      depositAmount: 300,
      dependentCount: 2,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_140',
      assetSatisfied: true,
    },
  },
  {
    id: 'profile-b',
    alias: '프로필 B',
    createdAt: 2,
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2020-03-01',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 7,
      homelessSince: '2018-03-01',
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 6,
      marriageDate: '2019-06-10',
      minorChildrenCount: 3,
      childrenBirthDates: ['2020-04-10', '2022-08-15', '2025-01-20'],
      hasNewborn: true,
      newbornBirthDate: '2025-01-20',
      isFirstLifeEver: false,
      taxPaid5Years: true,
      bankbookMonths: 84,
      depositAmount: 600,
      dependentCount: 4,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_160',
      assetSatisfied: true,
    },
  },
  {
    id: 'profile-c',
    alias: '프로필 C',
    createdAt: 3,
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2015-05-20',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 12,
      homelessSince: '2013-05-20',
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 15,
      marriageDate: '2010-06-10',
      minorChildrenCount: 2,
      childrenBirthDates: ['2012-03-10', '2014-07-22'],
      hasNewborn: false,
      isFirstLifeEver: false,
      taxPaid5Years: true,
      bankbookMonths: 144,
      depositAmount: 1000,
      dependentCount: 4,
      supportsElderlyOver65: true,
      elderlySupportYears: 4,
      incomeTier: 'under_140',
      assetSatisfied: true,
    },
  },
];

/** 새 빈 프로필 템플릿 생성 */
export function createNewSubscriptionProfile(alias: string): MultiSubscriptionProfile {
  return {
    id: `profile-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    alias,
    createdAt: Date.now(),
    profile: {
      residenceRegion: 'busan',
      busanTransferDate: '2024-01-01',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 2,
      ownedHouseCount: 0,
      marriageStatus: 'single',
      marriageYears: 0,
      minorChildrenCount: 0,
      childrenBirthDates: [],
      hasNewborn: false,
      isFirstLifeEver: true,
      taxPaid5Years: true,
      bankbookMonths: 24,
      depositAmount: 300,
      dependentCount: 0,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_100',
      assetSatisfied: true,
    },
  };
}

/** 모집공고가 아직 실제 등록되지 않은 예정 모델(초안)인지 확인 */
export function isDraftAnnouncementRule(rule: AnnouncementRule): boolean {
  if ((rule as any).isOfficialRegistered === true) {
    return false;
  }
  return (
    rule.ruleId.includes('draft') ||
    rule.ruleId.includes('expected') ||
    rule.projectName.includes('예정') ||
    rule.announcementDate > '2026-06-01'
  );
}

/** 다중 프로필 대상 병렬 비교 데이터 분석 실행 */
export function evaluateMultiProfiles(
  profiles: MultiSubscriptionProfile[],
  rule: AnnouncementRule
): ProfileComparisonItem[] {
  const isDraftNotice = isDraftAnnouncementRule(rule);

  return profiles.map((p) => {
    const residenceInfo = calculateResidencePeriod(
      p.profile.busanTransferDate,
      rule.announcementDate
    );
    const meetsLocal =
      p.profile.residenceRegion === 'busan' &&
      residenceInfo.residenceMonths >= rule.busanResidenceRequirementMonths;
    const analysis = evaluateSubscriptionEligibility(p.profile, rule);
    const resolvedProfile = analysis.resolvedProfile || p.profile;
    const scoreBreakdown = analysis.generalSupply.scoreBreakdown;

    return {
      id: p.id,
      alias: p.alias,
      profile: resolvedProfile,
      resolvedProfile,
      residenceMonths: residenceInfo.residenceMonths,
      residenceText: residenceInfo.residenceText,
      meetsLocalRequirement: meetsLocal,
      scoreBreakdown,
      analysis,
      isDraftNotice,
    };
  });
}
