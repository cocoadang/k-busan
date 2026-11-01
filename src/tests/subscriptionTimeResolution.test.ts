/**
 * Phase 5B-1: 청약 프로필 시점기준 자동판정 테스트 스위트
 * 
 * 검증 항목:
 * 1. 공고일 변경에 따른 신생아 자격 만료 (2025 공고 유효 -> 2027 공고 만료)
 * 2. 출생 전 태아 / 출생 후 신생아 및 자녀수 판정
 * 3. 자녀가 성년(만 19세)이 되는 경계 판정
 * 4. 혼인 7년 경계 판정 (당일 7년 이내 충족 vs 7년 1일 전 초과)
 * 5. 무주택 15년 초과 실제기간 보존 + 가점 상한(32점)
 * 6. 부산 전입 1년(12개월) 경계값 판정
 * 7. 미래 사업지(촉진3/우동3) 공고 미등록 모델 자격 확정 금지
 */

import {
  calculateHomelessDuration,
  calculateMarriageDuration,
  calculateMinorChildren,
  checkNewbornRequirement,
  calculateGeneralSupplyScore,
  calculateResidencePeriod,
  resolveUserProfileForAnnouncement,
  evaluateSubscriptionEligibility,
} from '../utils/subscriptionCalculator.ts';
import { ANNOUNCEMENT_RULES } from '../data/subscriptionBenchmarkData.ts';
import { isDraftAnnouncementRule } from '../utils/multiProfileHelper.ts';
import { UserSubscriptionProfile } from '../types/subscription.ts';

export interface TestResultItem {
  name: string;
  passed: boolean;
  message: string;
}

export function runTimeResolutionTestSuite(): {
  total: number;
  passed: number;
  results: TestResultItem[];
} {
  const results: TestResultItem[] = [];

  const addResult = (name: string, passed: boolean, message: string) => {
    results.push({ name, passed, message });
  };

  const baseProfile: UserSubscriptionProfile = {
    residenceRegion: 'busan',
    busanTransferDate: '2023-01-10',
    isHouseholder: true,
    isHomeless: true,
    homelessYears: 3,
    ownedHouseCount: 0,
    marriageStatus: 'married',
    marriageYears: 3,
    minorChildrenCount: 1,
    childrenBirthDates: [],
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
  };

  // 1. 공고일 변경에 따른 신생아 자격 만료 및 2년 경계값
  {
    const childBirthDate = '2024-02-15';
    // 써밋 남천 (2025-07-31): 출생 후 1년 5개월 -> 2년 이내 충족 (true)
    const res2025 = checkNewbornRequirement([childBirthDate], undefined, undefined, '2025-07-31', false);
    // 삼익비치 예정 (2027-03-31): 출생 후 3년 1개월 -> 2년 초과 만료 (false)
    const res2027 = checkNewbornRequirement([childBirthDate], undefined, undefined, '2027-03-31', false);

    // 2년 경계값: 공고일 2025-07-31 기준
    // 정확히 2년 전 당일 (2023-07-31) -> 충족 (true)
    const resExactBoundary = checkNewbornRequirement(['2023-07-31'], undefined, undefined, '2025-07-31', false);
    // 2년 1일 전 (2023-07-30) -> 만료 (false)
    const resExpiredBoundary = checkNewbornRequirement(['2023-07-30'], undefined, undefined, '2025-07-31', false);

    const passed =
      res2025.hasNewborn === true &&
      res2027.hasNewborn === false &&
      resExactBoundary.hasNewborn === true &&
      resExpiredBoundary.hasNewborn === false;

    addResult(
      'Test 1: 공고일 변경에 따른 신생아 자격 만료 및 2년 정확 경계값',
      passed,
      `2024-02-15 출생아: 2025 공고(충족: ${res2025.hasNewborn}) -> 2027 공고(만료: ${!res2027.hasNewborn}), 2년당일(2023-07-31: ${resExactBoundary.hasNewborn}), 2년1일전(2023-07-30: ${!resExpiredBoundary.hasNewborn})`
    );
  }

  // 2. 출생 전 태아 / 출생 후 판정
  {
    const annDate = '2025-07-31';
    // 태아 케이스: 출생 자녀 없음, 출산예정일 2025-11-20 (임신 중)
    const fetusCalc = calculateMinorChildren([], '2025-11-20', annDate, 0);
    const fetusNewborn = checkNewbornRequirement([], '2025-11-20', undefined, annDate, false);

    // 출생 후 케이스: 2025-03-10 출생
    const bornCalc = calculateMinorChildren(['2025-03-10'], undefined, annDate, 0);
    const bornNewborn = checkNewbornRequirement(['2025-03-10'], undefined, undefined, annDate, false);

    const passed =
      fetusCalc.minorCount === 1 &&
      fetusCalc.hasFetus === true &&
      fetusNewborn.hasNewborn === true &&
      bornCalc.minorCount === 1 &&
      bornCalc.hasFetus === false &&
      bornNewborn.hasNewborn === true;

    addResult(
      'Test 2: 출생 전 태아(자녀수 산입+신생아) 및 출생 후 판정 자동화',
      passed,
      `태아: 자녀수=${fetusCalc.minorCount}, 신생아=${fetusNewborn.hasNewborn} / 출생아: 자녀수=${bornCalc.minorCount}, 신생아=${bornNewborn.hasNewborn}`
    );
  }

  // 3. 자녀가 성년이 되는 경계 (만 19세)
  {
    const annDate = '2025-07-31';

    // 자녀 1: 2006-08-01 출생 -> 19세 생일은 2025-08-01 -> 공고일 기준 만 18세 (미성년자!)
    const childMinor = calculateMinorChildren(['2006-08-01'], undefined, annDate, 0);

    // 자녀 2: 2006-07-31 출생 -> 19세 생일 당일 -> 공고일 기준 만 19세 성년 도달 (미성년 제외!)
    const childAdultExact = calculateMinorChildren(['2006-07-31'], undefined, annDate, 0);

    // 자녀 3: 2006-07-30 출생 -> 19세 생일 1일 경과 -> 성년 (제외!)
    const childAdultPast = calculateMinorChildren(['2006-07-30'], undefined, annDate, 0);

    // 3명 모두 있는 경우: 미성년자는 2006-08-01생 1명만 카운트
    const allThree = calculateMinorChildren(
      ['2006-08-01', '2006-07-31', '2006-07-30'],
      undefined,
      annDate,
      0
    );

    const passed =
      childMinor.minorCount === 1 &&
      childAdultExact.minorCount === 0 &&
      childAdultPast.minorCount === 0 &&
      allThree.minorCount === 1 &&
      allThree.adultCount === 2;

    addResult(
      'Test 3: 자녀 성년(만 19세) 도달 경계값 자동 계산 (생일 전일 vs 당일 vs 경과)',
      passed,
      `2006-08-01생(만18세 미성년: ${childMinor.minorCount}명), 2006-07-31생(만19세 성년: ${childAdultExact.minorCount}명), 3명 통합 중 미성년: ${allThree.minorCount}명(성년 ${allThree.adultCount}명)`
    );
  }

  // 4. 혼인 7년 경계 판정
  {
    const annDate = '2025-07-31';

    // 혼인 A: 2018-08-01 (6년 11개월 30일 -> 7년 이내 충족, 7년차)
    const marA = calculateMarriageDuration('2018-08-01', annDate, 0);

    // 혼인 B: 2018-07-31 (정확히 7년 전 당일 -> 7년 이내 충족, 7년차)
    const marB = calculateMarriageDuration('2018-07-31', annDate, 0);

    // 혼인 C: 2018-07-30 (7년 1일 전 -> 7년 초과 불충족, 8년차)
    const marC = calculateMarriageDuration('2018-07-30', annDate, 0);

    const passed =
      marA.isWithin7Years === true &&
      marA.marriageYears === 7 &&
      marB.isWithin7Years === true &&
      marB.marriageYears === 7 &&
      marC.isWithin7Years === false &&
      marC.marriageYears === 8;

    addResult(
      'Test 4: 혼인 7년 경계 판정 (7년 미만, 정확히 7년 당일, 7년 1일 초과)',
      passed,
      `2018-08-01(충족: ${marA.isWithin7Years}, ${marA.marriageYears}년차), 2018-07-31(충족: ${marB.isWithin7Years}, ${marB.marriageYears}년차), 2018-07-30(초과: ${!marC.isWithin7Years}, ${marC.marriageYears}년차)`
    );
  }

  // 5. 무주택 15년 초과 실제기간 보존 + 가점 상한 (32점)
  {
    const annDate = '2025-07-31';

    // 18년 무주택: 2007-07-31부터 무주택
    const d18 = calculateHomelessDuration('2007-07-31', annDate, 0);
    const score18 = calculateGeneralSupplyScore({ ...baseProfile, isHomeless: true, homelessYears: d18.homelessYears });

    // 정확히 15년 무주택: 2010-07-31
    const d15 = calculateHomelessDuration('2010-07-31', annDate, 0);
    const score15 = calculateGeneralSupplyScore({ ...baseProfile, isHomeless: true, homelessYears: d15.homelessYears });

    // 14년 무주택: 2010-08-01 (14년 11개월)
    const d14 = calculateHomelessDuration('2010-08-01', annDate, 0);
    const score14 = calculateGeneralSupplyScore({ ...baseProfile, isHomeless: true, homelessYears: d14.homelessYears });

    const passed =
      d18.homelessYears === 18 && // 실제 18년 보존!
      score18.homelessScore === 32 && // 32점 상한!
      d15.homelessYears === 15 &&
      score15.homelessScore === 32 &&
      d14.homelessYears === 14 &&
      score14.homelessScore === 30;

    addResult(
      'Test 5: 무주택 15년 초과 실제기간(18년) 보존 및 가점 만점(32점) 상한 처리',
      passed,
      `18년: 실제기간=${d18.homelessYears}년, 가점=${score18.homelessScore}점 / 15년: ${d15.homelessYears}년, ${score15.homelessScore}점 / 14년: ${d14.homelessYears}년, ${score14.homelessScore}점`
    );
  }

  // 6. 부산 전입 1년(12개월) 경계값
  {
    const annDate = '2025-07-31';

    // 정확히 1년 전 당일: 2024-07-31 -> 12개월 (충족)
    const p12 = calculateResidencePeriod('2024-07-31', annDate);
    // 1년 1일 전: 2024-08-01 -> 11개월 (미달)
    const p11 = calculateResidencePeriod('2024-08-01', annDate);
    // 공고일 당일: 2025-07-31 -> 0개월 (미달)
    const p0 = calculateResidencePeriod('2025-07-31', annDate);

    const passed =
      p12.residenceMonths === 12 &&
      p11.residenceMonths === 11 &&
      p0.residenceMonths === 0;

    addResult(
      'Test 6: 부산 전입 1년(12개월) 계속 거주 요건 정밀 경계값',
      passed,
      `1년전 당일(2024-07-31: ${p12.residenceMonths}개월 충족), 1년-1일(2024-08-01: ${p11.residenceMonths}개월 미달), 당일전입(${p0.residenceMonths}개월)`
    );
  }

  // 7. 통합 프로필 시점 자동 해석 및 촉진3/우동3 예정 모델 미확정 안내
  {
    const dynamicProfile: UserSubscriptionProfile = {
      ...baseProfile,
      homelessSince: '2005-01-01', // 20년 무주택
      marriageDate: '2022-03-10',  // 혼인
      childrenBirthDates: ['2024-08-10'], // 2024년 8월 출생 (2025년 7월 및 2026년 6월 모두 2년 이내 신생아 충족)
      expectedBirthDate: undefined,
    };

    const summitRule = ANNOUNCEMENT_RULES['rule-summit-namcheon-2025']; // 2025-07-31
    const chokjinDraftRule = ANNOUNCEMENT_RULES['rule-chokjin-3-draft']; // 2026-06-30

    // 2025 공고 기준 해석
    const resolved2025 = resolveUserProfileForAnnouncement(dynamicProfile, summitRule.announcementDate);
    // 2026 공고 기준 해석
    const resolved2026 = resolveUserProfileForAnnouncement(dynamicProfile, chokjinDraftRule.announcementDate);

    const isChokjinDraft = isDraftAnnouncementRule(chokjinDraftRule);

    const passed =
      resolved2025.homelessYears === 20 &&
      resolved2025.hasNewborn === true &&
      resolved2026.homelessYears === 21 &&
      resolved2026.hasNewborn === true &&
      isChokjinDraft === true;

    addResult(
      'Test 7: 프로필 통합 시점 해석(무주택 20년->21년 연동) 및 예정 공고 미확정 안내',
      passed,
      `2025공고 무주택=${resolved2025.homelessYears}년 / 2026공고 무주택=${resolved2026.homelessYears}년 / 촉진3 예정모델 초안플래그=${isChokjinDraft}`
    );
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    results,
  };
}
