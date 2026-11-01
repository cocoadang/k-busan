/**
 * Phase 5A: 청약 자격 및 점수 계산 유틸리티
 *
 * 엄격한 준수 원칙:
 * 1. 특정 청약 추천 / 당첨 확률 예측 금지 (병렬 비교 원칙)
 * 2. 모집공고별 거주요건 및 공급비율 versioning 적용
 * 3. 공고 기준일 대비 거주기간 자동 계산
 */

import {
  UserSubscriptionProfile,
  AnnouncementRule,
  GeneralSupplyScoreBreakdown,
  GeneralSupplyEligibilityResult,
  PathEligibilityResult,
  ComprehensiveEligibilityAnalysis,
} from '../types/subscription.ts';

/**
 * 부산 전입일과 모집공고일 기준 거주기간 자동 계산
 * 
 * @param transferDateStr 전입일 (YYYY-MM-DD)
 * @param announcementDateStr 모집공고일 (YYYY-MM-DD)
 */
export function calculateResidencePeriod(
  transferDateStr: string,
  announcementDateStr: string
): {
  residenceMonths: number;
  years: number;
  remainingMonths: number;
  residenceText: string;
} {
  if (!transferDateStr || !announcementDateStr) {
    return {
      residenceMonths: 0,
      years: 0,
      remainingMonths: 0,
      residenceText: '전입일 미입력',
    };
  }

  const transferDate = new Date(transferDateStr);
  const announcementDate = new Date(announcementDateStr);

  if (isNaN(transferDate.getTime()) || isNaN(announcementDate.getTime())) {
    return {
      residenceMonths: 0,
      years: 0,
      remainingMonths: 0,
      residenceText: '유효하지 않은 날짜',
    };
  }

  if (announcementDate < transferDate) {
    return {
      residenceMonths: 0,
      years: 0,
      remainingMonths: 0,
      residenceText: '0개월 (공고일 이후 전입)',
    };
  }

  // Calculate year and month difference
  let years = announcementDate.getFullYear() - transferDate.getFullYear();
  let months = announcementDate.getMonth() - transferDate.getMonth();
  const dayDiff = announcementDate.getDate() - transferDate.getDate();

  if (dayDiff < 0) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = Math.max(0, years * 12 + months);

  let text = '';
  if (years > 0 && months > 0) {
    text = `${years}년 ${months}개월`;
  } else if (years > 0) {
    text = `${years}년`;
  } else {
    text = `${totalMonths}개월`;
  }

  return {
    residenceMonths: totalMonths,
    years,
    remainingMonths: months,
    residenceText: text,
  };
}

/**
 * 일반공급 가점 계산 (최대 84점 만점)
 *
 * 1. 무주택 기간: 최대 32점 (15년 이상 32점, 1년 미만 2점, 유주택 0점)
 * 2. 부양가족 수: 최대 35점 (0명 5점, 1명 10점, ..., 6명 이상 35점)
 * 3. 청약통장 가입기간: 최대 17점 (15년 이상 17점, 6개월 미만 1점, 6개월~1년 2점, 1년~2년 3점, ...)
 */
export function calculateGeneralSupplyScore(
  profile: UserSubscriptionProfile
): GeneralSupplyScoreBreakdown {
  // 1. 무주택 기간 (0~32점)
  let homelessScore = 0;
  if (profile.isHomeless) {
    const years = profile.homelessYears;
    if (years < 1) {
      homelessScore = 2;
    } else if (years >= 15) {
      homelessScore = 32;
    } else {
      homelessScore = (years + 1) * 2;
    }
  } else {
    homelessScore = 0;
  }

  // 2. 부양가족 수 (5~35점, 본인 제외)
  const clampedDependents = Math.max(0, Math.min(6, profile.dependentCount));
  const dependentScore = (clampedDependents * 5) + 5;

  // 3. 청약통장 가입기간 (1~17점)
  let bankbookScore = 0;
  const months = Math.max(0, profile.bankbookMonths);
  if (months < 6) {
    bankbookScore = 1;
  } else if (months >= 180) { // 15년 이상
    bankbookScore = 17;
  } else {
    // 6개월 이상 ~ 1년 미만: 2점, 1년 이상 ~ 2년 미만: 3점 ...
    bankbookScore = Math.floor(months / 12) + 2;
  }

  const totalScore = homelessScore + dependentScore + bankbookScore;

  return {
    homelessScore,
    dependentScore,
    bankbookScore,
    totalScore,
  };
}

/**
 * YYYY-MM-DD 날짜 파싱 (타임존/DST 왜곡 방지)
 */
export function parseYMD(dateStr: string | undefined): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('-');
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

/**
 * 두 YMD 날짜 비교 (-1: a < b, 0: a == b, 1: a > b)
 */
export function compareYMD(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number }
): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * 1. 무주택 기간 자동 계산 (homelessSince → 모집공고일 기준)
 * - 15년 이상은 실제 년수를 그대로 보존하여 반환 (가점 계산 시에만 32점 상한 처리)
 */
export function calculateHomelessDuration(
  homelessSince: string | undefined,
  announcementDateStr: string,
  fallbackYears: number
): {
  homelessYears: number;
  actualMonths: number;
  displayText: string;
} {
  const start = parseYMD(homelessSince);
  const ann = parseYMD(announcementDateStr);

  if (!start || !ann) {
    return {
      homelessYears: fallbackYears,
      actualMonths: fallbackYears * 12,
      displayText: `${fallbackYears}년`,
    };
  }

  if (compareYMD(ann, start) < 0) {
    return {
      homelessYears: 0,
      actualMonths: 0,
      displayText: '0년 (공고일 이후 무주택 전환)',
    };
  }

  let years = ann.year - start.year;
  let months = ann.month - start.month;
  const dayDiff = ann.day - start.day;

  if (dayDiff < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = Math.max(0, years * 12 + months);
  const actualYears = years; // 완료된 만 년수
  const displayText = months > 0 ? `${years}년 ${months}개월` : `${years}년`;

  return {
    homelessYears: actualYears,
    actualMonths: totalMonths,
    displayText,
  };
}

/**
 * 2. 혼인 기간 자동 계산 (marriageDate → 모집공고일 기준)
 * - 혼인신고일로부터 공고일까지의 기간 계산
 * - 7년 경계: 정확히 7년 전 당일까지 7년 이내 충족, 7년 1일 전부터 7년 초과
 */
export function calculateMarriageDuration(
  marriageDate: string | undefined,
  announcementDateStr: string,
  fallbackYears: number
): {
  marriageYears: number;
  isWithin7Years: boolean;
  displayText: string;
} {
  const mar = parseYMD(marriageDate);
  const ann = parseYMD(announcementDateStr);

  if (!mar || !ann) {
    return {
      marriageYears: fallbackYears,
      isWithin7Years: fallbackYears <= 7,
      displayText: `${fallbackYears}년차`,
    };
  }

  if (compareYMD(ann, mar) < 0) {
    return {
      marriageYears: 0,
      isWithin7Years: false,
      displayText: '0년차 (혼인신고일 미도래)',
    };
  }

  let years = ann.year - mar.year;
  let months = ann.month - mar.month;
  const dayDiff = ann.day - mar.day;

  if (dayDiff < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // 7년 경계:
  // years < 7: 7년 미만 완료 (예: 6년 11개월 -> 7년차 -> 충족)
  // years === 7 && months === 0 && dayDiff === 0: 정확히 7년 당일 -> 충족 (7년 이내)
  // years > 7 또는 (years === 7 && (months > 0 || (months === 0 && dayDiff > 0))): 7년 초과 -> 불충족
  const isExact7OrLess = years < 7 || (years === 7 && months === 0 && dayDiff === 0);

  // 연차 표기:
  // 완료 연수가 0년이면 1년차, 6년이면 7년차.
  // 정확히 7년 당일이면 7년차 (7년 이내).
  // 7년을 1일이라도 초과하면 8년차 이상(7년 초과).
  let ordinalYear: number;
  if (isExact7OrLess) {
    ordinalYear = years === 7 ? 7 : years + 1;
  } else {
    ordinalYear = years + 1;
  }

  return {
    marriageYears: ordinalYear,
    isWithin7Years: isExact7OrLess,
    displayText: `혼인 ${ordinalYear}년차 (${years}년 ${months}개월)`,
  };
}

/**
 * 3. 미성년 자녀수 자동 계산 (childrenBirthDates[] 및 expectedBirthDate → 모집공고일 기준)
 * - 만 19세 미만 판정 (19세 생일 당일부터 성년으로 미성년 자녀 제외)
 * - 임신 중인 태아(expectedBirthDate)는 자녀 수에 산입
 */
export function calculateMinorChildren(
  childrenBirthDates: string[] | undefined,
  expectedBirthDate: string | undefined,
  announcementDateStr: string,
  fallbackCount: number
): {
  minorCount: number;
  adultCount: number;
  hasFetus: boolean;
  details: string[];
} {
  const ann = parseYMD(announcementDateStr);
  if (!ann) {
    return {
      minorCount: fallbackCount,
      adultCount: 0,
      hasFetus: false,
      details: [],
    };
  }

  // 태아 검사
  let hasFetus = false;
  if (expectedBirthDate) {
    const exp = parseYMD(expectedBirthDate);
    if (exp) {
      const annTime = new Date(ann.year, ann.month - 1, ann.day).getTime();
      const expTime = new Date(exp.year, exp.month - 1, exp.day).getTime();
      const diffDays = (expTime - annTime) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 300) {
        hasFetus = true;
      }
    }
  }

  if (!childrenBirthDates || childrenBirthDates.length === 0) {
    const count = fallbackCount + (hasFetus && fallbackCount === 0 ? 1 : 0);
    return {
      minorCount: count,
      adultCount: 0,
      hasFetus,
      details: hasFetus ? ['임신 중 태아 1명 자녀수 산입'] : [],
    };
  }

  let minorCount = 0;
  let adultCount = 0;
  const details: string[] = [];

  for (const bStr of childrenBirthDates) {
    const b = parseYMD(bStr);
    if (!b) continue;

    if (compareYMD(b, ann) > 0) {
      continue;
    }

    const nineteenthBirthday = { year: b.year + 19, month: b.month, day: b.day };

    if (compareYMD(ann, nineteenthBirthday) < 0) {
      minorCount += 1;
      const age = ann.year - b.year - (ann.month < b.month || (ann.month === b.month && ann.day < b.day) ? 1 : 0);
      details.push(`자녀 출생일 ${bStr} (만 ${age}세, 미성년자)`);
    } else {
      adultCount += 1;
      const age = ann.year - b.year - (ann.month < b.month || (ann.month === b.month && ann.day < b.day) ? 1 : 0);
      details.push(`자녀 출생일 ${bStr} (만 ${age}세 성년 도달, 미성년 제외)`);
    }
  }

  if (hasFetus) {
    minorCount += 1;
    details.push(`출산예정일 ${expectedBirthDate} (임신 중 태아 자녀수 산입)`);
  }

  return {
    minorCount,
    adultCount,
    hasFetus,
    details,
  };
}

/**
 * 4. 신생아 요건 자동 판정 (childrenBirthDates[], expectedBirthDate, newbornBirthDate → 모집공고일 기준)
 * - 공고일 기준 2년 이내 출생 자녀 또는 임신 중 태아
 * - 2년 전 당일 출생: 충족 / 2년 1일 전 출생: 만료 불충족
 */
export function checkNewbornRequirement(
  childrenBirthDates: string[] | undefined,
  expectedBirthDate: string | undefined,
  newbornBirthDate: string | undefined,
  announcementDateStr: string,
  fallbackHasNewborn: boolean
): {
  hasNewborn: boolean;
  reason: string;
} {
  const ann = parseYMD(announcementDateStr);
  if (!ann) {
    return {
      hasNewborn: fallbackHasNewborn,
      reason: fallbackHasNewborn ? '신생아 요건 수동 설정' : '신생아 요건 미충족',
    };
  }

  // 1. 임신 중 태아 판정
  if (expectedBirthDate) {
    const exp = parseYMD(expectedBirthDate);
    if (exp) {
      const annTime = new Date(ann.year, ann.month - 1, ann.day).getTime();
      const expTime = new Date(exp.year, exp.month - 1, exp.day).getTime();
      const diffDays = (expTime - annTime) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 300) {
        return {
          hasNewborn: true,
          reason: `임신 중인 태아(출산예정일 ${expectedBirthDate})로 신생아 요건 충족`,
        };
      }
    }
  }

  // 2. 공고일 기준 2년 전 당일 계산
  const twoYearsPrior = { year: ann.year - 2, month: ann.month, day: ann.day };

  const datesToCheck: string[] = [];
  if (newbornBirthDate) datesToCheck.push(newbornBirthDate);
  if (childrenBirthDates) {
    for (const d of childrenBirthDates) {
      if (!datesToCheck.includes(d)) datesToCheck.push(d);
    }
  }

  if (datesToCheck.length === 0) {
    return {
      hasNewborn: fallbackHasNewborn,
      reason: fallbackHasNewborn ? '신생아 요건 충족' : '공고일 기준 2년 이내 출생 자녀 없음',
    };
  }

  for (const dStr of datesToCheck) {
    const b = parseYMD(dStr);
    if (!b) continue;

    // 공고일 당일 또는 이전 출생 + 2년 전 당일 또는 이후 출생
    if (compareYMD(b, ann) <= 0 && compareYMD(b, twoYearsPrior) >= 0) {
      return {
        hasNewborn: true,
        reason: `자녀 출생일 ${dStr} (공고일 ${announcementDateStr} 기준 2년 이내 신생아 충족)`,
      };
    }
  }

  return {
    hasNewborn: false,
    reason: `공고일 ${announcementDateStr} 기준 2년 이내 출생 자녀 없음 (자격 만료 또는 미해당)`,
  };
}

/**
 * 5. 프로필 시점기준 자동판정 통합 해석기
 * - 주어진 모집공고일에 맞춰 무주택기간, 혼인기간, 미성년자녀수, 신생아요건을 자동 계산하여 주입
 */
export function resolveUserProfileForAnnouncement(
  profile: UserSubscriptionProfile,
  announcementDateStr: string
): UserSubscriptionProfile {
  // 1) 무주택 기간 자동 계산
  let resolvedHomelessYears = profile.homelessYears;
  if (profile.isHomeless && profile.homelessSince) {
    const calc = calculateHomelessDuration(
      profile.homelessSince,
      announcementDateStr,
      profile.homelessYears
    );
    resolvedHomelessYears = calc.homelessYears;
  }

  // 2) 혼인 기간 자동 계산
  let resolvedMarriageYears = profile.marriageYears;
  if (profile.marriageStatus === 'married' && profile.marriageDate) {
    const calc = calculateMarriageDuration(
      profile.marriageDate,
      announcementDateStr,
      profile.marriageYears
    );
    resolvedMarriageYears = calc.marriageYears;
  }

  // 3) 미성년 자녀수 자동 계산
  let resolvedMinorChildrenCount = profile.minorChildrenCount;
  if (
    (profile.childrenBirthDates && profile.childrenBirthDates.length > 0) ||
    profile.expectedBirthDate
  ) {
    const calc = calculateMinorChildren(
      profile.childrenBirthDates,
      profile.expectedBirthDate,
      announcementDateStr,
      profile.minorChildrenCount
    );
    resolvedMinorChildrenCount = calc.minorCount;
  }

  // 4) 신생아 요건 자동 판정
  let resolvedHasNewborn = profile.hasNewborn;
  if (
    (profile.childrenBirthDates && profile.childrenBirthDates.length > 0) ||
    profile.expectedBirthDate ||
    profile.newbornBirthDate
  ) {
    const calc = checkNewbornRequirement(
      profile.childrenBirthDates,
      profile.expectedBirthDate,
      profile.newbornBirthDate,
      announcementDateStr,
      profile.hasNewborn
    );
    resolvedHasNewborn = calc.hasNewborn;
  }

  return {
    ...profile,
    homelessYears: resolvedHomelessYears,
    marriageYears: resolvedMarriageYears,
    minorChildrenCount: resolvedMinorChildrenCount,
    hasNewborn: resolvedHasNewborn,
  };
}

/**
 * 모집공고 규칙 및 사용자 프로필 기반 종합 자격 판정
 */
export function evaluateSubscriptionEligibility(
  profile: UserSubscriptionProfile,
  rule: AnnouncementRule
): ComprehensiveEligibilityAnalysis {
  // Phase 5B-1: 모집공고일 기준 시간 의존 조건(무주택기간, 혼인기간, 미성년자녀수, 신생아) 자동 해석
  const resolvedProfile = resolveUserProfileForAnnouncement(profile, rule.announcementDate);

  // 1. 거주기간 계산
  const isBusan = resolvedProfile.residenceRegion === 'busan';
  const residenceInfo = calculateResidencePeriod(
    resolvedProfile.busanTransferDate,
    rule.announcementDate
  );

  const reqMonths = rule.busanResidenceRequirementMonths;
  const meetsLocalRequirement = isBusan && residenceInfo.residenceMonths >= reqMonths;

  const residenceDescription = isBusan
    ? meetsLocalRequirement
      ? `부산 ${residenceInfo.residenceText} 거주 (공고 기준 ${reqMonths}개월 이상 충족 → 해당지역 1순위 우선공급)`
      : `부산 ${residenceInfo.residenceText} 거주 (공고 기준 ${reqMonths}개월 미달 → 기타지역 접수 대상)`
    : resolvedProfile.residenceRegion === 'ulsan_gyeongnam'
    ? '울산/경남 거주 (기타지역 1순위 대상)'
    : '기타 지역 거주 (해당지역 미달 시 순위 부여)';

  // 2. 신혼부부 특별공급 판정
  const newlywed = evaluateNewlywed(resolvedProfile, rule);

  // 3. 생애최초 특별공급 판정
  const firstLife = evaluateFirstLife(resolvedProfile, rule);

  // 4. 신생아 특별공급 판정
  const newborn = evaluateNewborn(resolvedProfile, rule);

  // 5. 다자녀가구 특별공급 판정
  const multiChild = evaluateMultiChild(resolvedProfile, rule);

  // 6. 노부모부양 특별공급 판정
  const elderlyParent = evaluateElderlyParent(resolvedProfile, rule);

  // 7. 일반공급 판정
  const generalSupply = evaluateGeneralSupply(resolvedProfile, rule, meetsLocalRequirement);

  return {
    targetRule: rule,
    resolvedProfile,
    residenceAnalysis: {
      residenceMonths: residenceInfo.residenceMonths,
      residenceText: residenceInfo.residenceText,
      meetsLocalRequirement,
      description: residenceDescription,
    },
    newlywed,
    firstLife,
    newborn,
    multiChild,
    elderlyParent,
    generalSupply,
  };
}

/** 신혼부부 특별공급 자격 판정 */
function evaluateNewlywed(
  profile: UserSubscriptionProfile,
  rule: AnnouncementRule
): PathEligibilityResult {
  const disqualifications: string[] = [];

  if (profile.marriageStatus !== 'married') {
    disqualifications.push('기혼자만 신청 가능 (혼인신고일 기준 7년 이내)');
  } else if (profile.marriageYears > 7) {
    disqualifications.push(`혼인 기간 7년 초과 (현재 ${profile.marriageYears}년)`);
  }

  if (!profile.isHomeless) {
    disqualifications.push('유주택자 신청 불가 (혼인기간 중 계속 무주택 유지 필요)');
  }

  if (profile.bankbookMonths < 6) {
    disqualifications.push(`청약통장 가입기간 6개월 미달 (현재 ${profile.bankbookMonths}개월)`);
  }

  if (profile.incomeTier === 'over_limit') {
    disqualifications.push('소득 기준 초과 (신혼부부 소득 기준 초과)');
  }

  if (!profile.assetSatisfied) {
    disqualifications.push('부동산 등 자산 기준 초과');
  }

  const eligible = disqualifications.length === 0;
  const reason = eligible
    ? `신혼부부 요건 충족 (혼인 ${profile.marriageYears}년차, 무주택, 통장 ${profile.bankbookMonths}개월)`
    : disqualifications.join(' · ');

  const details: string[] = [];
  if (eligible) {
    if (profile.minorChildrenCount > 0 || profile.hasNewborn) {
      details.push('미성년 자녀 또는 신생아 요건으로 1순위(우선/일반) 경쟁 우위');
    } else {
      details.push('무자녀 신혼부부 (2순위 추첨 경쟁)');
    }
    if (profile.incomeTier === 'under_100') {
      details.push('소득 100% 이하: 우선공급 대상군');
    } else {
      details.push('소득 일반/추첨 공급 대상군');
    }
  }

  return {
    eligible,
    reason,
    details,
    tier: eligible ? (profile.minorChildrenCount > 0 ? 'priority' : 'general') : 'none',
  };
}

/** 생애최초 특별공급 자격 판정 */
function evaluateFirstLife(
  profile: UserSubscriptionProfile,
  rule: AnnouncementRule
): PathEligibilityResult {
  const disqualifications: string[] = [];

  if (!profile.isFirstLifeEver) {
    disqualifications.push('세대원 전원 과거 주택 소유 이력 없음 요건 미충족');
  }

  if (!profile.isHomeless) {
    disqualifications.push('현재 유주택자 신청 불가 (무주택세대구성원 필수)');
  }

  if (!profile.taxPaid5Years) {
    disqualifications.push('과거 5개년 이상 소득세 납부 실적 미충족');
  }

  if (profile.bankbookMonths < 6) {
    disqualifications.push(`청약통장 가입기간 6개월 미달 (현재 ${profile.bankbookMonths}개월)`);
  }

  if (profile.incomeTier === 'over_limit') {
    disqualifications.push('소득 기준 초과 (생애최초 소득 기준 초과)');
  }

  if (!profile.assetSatisfied) {
    disqualifications.push('부동산 등 자산 기준 초과');
  }

  const eligible = disqualifications.length === 0;
  const reason = eligible
    ? '생애최초 요건 충족 (전원 무주택 이력, 5년 소득세 납부 완료)'
    : disqualifications.join(' · ');

  const details: string[] = [];
  if (eligible) {
    details.push('생애최초 특별공급 전량 100% 추첨 방식 배정');
    if (profile.incomeTier === 'under_100' || profile.incomeTier === 'under_140') {
      details.push('우선/일반공급 물량 우선 배정 대상');
    }
  }

  return {
    eligible,
    reason,
    details,
    tier: eligible ? 'general' : 'none',
  };
}

/** 신생아 특별공급 자격 판정 (2026-06-15 이전 공고는 not_applicable, 이후 공고는 현행 규칙 적용) */
function evaluateNewborn(
  profile: UserSubscriptionProfile,
  rule: AnnouncementRule
): PathEligibilityResult {
  // 2026-06-15 이전 공고는 독립 신생아 특별공급 제도 미적용 (신혼/생초 우선공급 연계)
  if (rule.announcementDate < '2026-06-15') {
    return {
      eligible: false,
      status: 'not_applicable',
      reason: '공고일 기준(2026-06-15 이전)은 독립 신생아 특별공급 제도 적용 대상이 아닙니다 (신혼/생애최초 특공 내 신생아 우선공급 연계 대상)',
      details: [
        '2026-06-15 이후 입주자모집공고부터 독립 신생아 특별공급 유형 규칙이 적용됩니다.',
        profile.hasNewborn
          ? '보유 중인 신생아 요건은 신혼부부 또는 생애최초 특공 내 20% 우선배정으로 신청 가능합니다.'
          : '공고일 기준 2년 이내 출생 자녀 없음',
      ],
      tier: 'none',
    };
  }

  const disqualifications: string[] = [];

  if (!profile.hasNewborn) {
    disqualifications.push('모집공고일 기준 2년 이내 출생한 자녀(태아·입양 포함) 요건 미충족');
  }

  if (!profile.isHomeless) {
    disqualifications.push('유주택자 신청 불가 (무주택세대구성원 필수)');
  }

  if (profile.bankbookMonths < 6) {
    disqualifications.push(`청약통장 가입기간 6개월 미달 (현재 ${profile.bankbookMonths}개월)`);
  }

  if (profile.incomeTier === 'over_limit') {
    disqualifications.push('소득 기준 초과 (신생아 특공 소득 요건 초과)');
  }

  if (!profile.assetSatisfied) {
    disqualifications.push('자산 기준 초과');
  }

  const eligible = disqualifications.length === 0;
  const reason = eligible
    ? '신생아 특별공급 요건 충족 (2년 이내 출생 자녀 보유, 무주택, 통장 6개월)'
    : disqualifications.join(' · ');

  const details: string[] = [];
  if (eligible) {
    details.push('2026-06-15 이후 신설 독립 신생아 특별공급 자격 충족');
  }

  return {
    eligible,
    status: 'applicable',
    reason,
    details,
    tier: eligible ? 'priority' : 'none',
  };
}

/** 다자녀가구 특별공급 자격 판정 (2024-03-25 기준 완화 versioning) */
function evaluateMultiChild(
  profile: UserSubscriptionProfile,
  rule: AnnouncementRule
): PathEligibilityResult {
  const disqualifications: string[] = [];

  // 2024-03-25 이후 공고는 2자녀 완화, 이전 과거 공고는 3자녀 필요
  const minChildrenRequired = rule.announcementDate >= '2024-03-25' ? 2 : 3;

  if (profile.minorChildrenCount < minChildrenRequired) {
    disqualifications.push(
      `미성년 자녀 ${minChildrenRequired}명 이상 필수 (현재 ${profile.minorChildrenCount}명, ${
        minChildrenRequired === 2 ? '2024-03-25 이후 2자녀로 완화' : '과거 3자녀 기준'
      })`
    );
  }

  if (!profile.isHomeless) {
    disqualifications.push('유주택자 신청 불가 (무주택세대구성원 필수)');
  }

  if (profile.bankbookMonths < 6) {
    disqualifications.push(`청약통장 가입기간 6개월 미달 (현재 ${profile.bankbookMonths}개월)`);
  }

  const eligible = disqualifications.length === 0;
  const reason = eligible
    ? `다자녀 요건 충족 (미성년 자녀 ${profile.minorChildrenCount}명, 무주택, 통장 ${profile.bankbookMonths}개월)`
    : disqualifications.join(' · ');

  const details: string[] = [];
  if (eligible) {
    details.push('다자녀 특별공급 배점표(자녀수·영유아·무주택기간 등)에 따른 고득점순 선정');
    if (profile.minorChildrenCount >= 3) {
      details.push('자녀 3명 이상 가점 우위 배점 적용');
    }
  }

  return {
    eligible,
    status: 'applicable',
    reason,
    details,
    tier: eligible ? 'priority' : 'none',
  };
}

/** 노부모부양 특별공급 자격 판정 */
function evaluateElderlyParent(
  profile: UserSubscriptionProfile,
  rule: AnnouncementRule
): PathEligibilityResult {
  const disqualifications: string[] = [];

  // 세대주 필수!
  if (!profile.isHouseholder) {
    disqualifications.push('세대주 필수 (노부모부양 특별공급은 세대원 신청 불가)');
  }

  if (!profile.supportsElderlyOver65 || profile.elderlySupportYears < 3) {
    disqualifications.push(
      `만 65세 이상 직계존속 3년 이상 계속 부양(동일등본 등재) 미달 (현재 ${
        profile.supportsElderlyOver65 ? profile.elderlySupportYears + '년' : '해당 없음'
      })`
    );
  }

  if (!profile.isHomeless) {
    disqualifications.push('유주택자 신청 불가 (무주택 세대주 필수, 피부양자 및 배우자 포함 무주택)');
  }

  if (profile.bankbookMonths < 6) {
    disqualifications.push(`청약통장 가입기간 6개월 미달 (현재 ${profile.bankbookMonths}개월)`);
  }

  const eligible = disqualifications.length === 0;
  const reason = eligible
    ? `노부모부양 요건 충족 (무주택 세대주, 65세 이상 직계존속 ${profile.elderlySupportYears}년 부양)`
    : disqualifications.join(' · ');

  const details: string[] = [];
  if (eligible) {
    details.push('일반공급 가점제 산정방식과 동일한 가점 순으로 당첨자 선정');
  }

  return {
    eligible,
    reason,
    details,
    tier: eligible ? 'general' : 'none',
  };
}

/** 일반공급 자격 및 가점/추첨 판정 */
function evaluateGeneralSupply(
  profile: UserSubscriptionProfile,
  rule: AnnouncementRule,
  meetsLocalRequirement: boolean
): GeneralSupplyEligibilityResult {
  const scoreBreakdown = calculateGeneralSupplyScore(profile);
  const disqualifications: string[] = [];

  // 1순위 조건
  const isBankbook1st = profile.bankbookMonths >= 6;
  if (!isBankbook1st) {
    disqualifications.push(`통장 가입 6개월 미달 (현재 ${profile.bankbookMonths}개월)`);
  }

  if (profile.depositAmount < 300) {
    disqualifications.push(`예치금 300만원 미달 (현재 ${profile.depositAmount}만원)`);
  }

  // 주택 소유 여부
  const isHomeless = profile.isHomeless;
  const isOneHouse = !profile.isHomeless && profile.ownedHouseCount === 1;
  const isMultiHouse = !profile.isHomeless && profile.ownedHouseCount >= 2;

  let lotteryCategory = '무주택 우선공급 (75%)';
  if (isOneHouse) {
    lotteryCategory = '1주택 처분서약 추첨 (25%)';
  } else if (isMultiHouse) {
    lotteryCategory = '다주택자 (1순위 추첨 잔여물량 또는 2순위)';
  }

  const isFirstPriority = isBankbook1st && profile.depositAmount >= 300 && !isMultiHouse;
  const lotteryEligible = isBankbook1st && profile.depositAmount >= 300;

  const details: string[] = [];
  details.push(`가점 합계: ${scoreBreakdown.totalScore}점 / 84점 만점`);
  details.push(
    `가점 세부: 무주택 ${scoreBreakdown.homelessScore}점(32만점) + 부양가족 ${scoreBreakdown.dependentScore}점(35만점) + 통장 ${scoreBreakdown.bankbookScore}점(17만점)`
  );

  if (meetsLocalRequirement) {
    details.push('해당지역(부산광역시 거주요건 충족) 1순위 우선배정 대상');
  } else {
    details.push('해당지역 거주기간 미달 또는 타지역 → 기타지역 1순위 접수');
  }

  if (isHomeless) {
    details.push('전용 85㎡ 이하: 가점제 40% 자동 응모 후 탈락 시 추첨제 60% 자동 참여');
    details.push('전용 85㎡ 초과: 100% 추첨제 참여 (무주택 우선배정 75% 군)');
  } else if (isOneHouse) {
    details.push('1주택자: 85㎡ 이하 가점제 대상 제외, 추첨제 60% 참여 가능 (기존주택 처분조건)');
    details.push('1주택자: 85㎡ 초과 100% 추첨제 참여 가능');
  } else {
    details.push('2주택 이상: 가점제 배제, 1순위 제한');
  }

  const reason = isFirstPriority
    ? `일반공급 1순위 대상 (가점 ${scoreBreakdown.totalScore}점 / 추첨 대상)`
    : disqualifications.join(' · ');

  return {
    eligible: isFirstPriority,
    isFirstPriority,
    reason,
    scoreBreakdown,
    lotteryEligible,
    lotteryCategory,
    details,
  };
}
