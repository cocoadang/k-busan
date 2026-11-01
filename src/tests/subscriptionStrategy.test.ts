/**
 * Phase 5A-1: 청약전략 Rule/Data Audit 검증 테스트 스위트
 * 
 * 감사/검증 항목:
 * 1. PDF benchmark 전수 일치 (남천 써밋, 르엘 센텀, 베뉴브 해운대)
 * 2. 원자료 불일치 원인 수정 검증:
 *    - 남천 84B: 공급 24, 해당 7,840, 기타 540, 해당경쟁률 326.67:1 (기타 단순합산치 349.17:1 구분)
 *    - 베뉴브 84B: 공급 41 (기존 오류 42 수정), 경쟁률 33.0:1 (기존 오류 20.95:1 원인 수정)
 * 3. 2025 신생아 not_applicable 구분 (경쟁률 0 처리 금지)
 * 4. 2026-06-15 전후 Rule Version 분리 검증:
 *    - 2026-06-15 이전 공고: 독립 신생아특공 not_applicable
 *    - 2026-06-15 이후 공고: 현행 신생아특공 정식 적용
 * 5. 부산 전입기간 경계값 테스트:
 *    - 공고일 당일 전입: 0개월 (미달)
 *    - 1년 전 당일 (2024-07-31 -> 2025-07-31): 12개월 (충족)
 *    - 1년 1일 전 (2024-08-01 -> 2025-07-31): 11개월 (미달)
 *    - 공고일 이후 전입 (2025-08-01 -> 2025-07-31): 0개월 (미달)
 * 6. 가점 84점 경계값 테스트 (무주택 0~15년, 부양가족 0~6명, 통장 0~15년)
 * 7. 미확인 값 null 보존 (추정·보간 금지)
 */

import {
  calculateResidencePeriod,
  calculateGeneralSupplyScore,
  evaluateSubscriptionEligibility,
} from '../utils/subscriptionCalculator.ts';
import {
  ANNOUNCEMENT_RULES,
  BENCHMARK_PROJECTS,
  SUBSCRIPTION_PRESETS,
  generateFuturePlanComparisonRows,
  SUMMIT_NAMCHEON_BENCHMARK,
  LUEL_CENTUM_BENCHMARK,
  VENUEVE_HAEUNDAE_BENCHMARK,
} from '../data/subscriptionBenchmarkData.ts';
import { UserSubscriptionProfile } from '../types/subscription.ts';

export interface TestResultItem {
  name: string;
  passed: boolean;
  message: string;
}

export function runSubscriptionStrategyTestSuite(): {
  total: number;
  passed: number;
  results: TestResultItem[];
} {
  const results: TestResultItem[] = [];

  const addResult = (name: string, passed: boolean, message: string) => {
    results.push({ name, passed, message });
  };

  const summitRule = ANNOUNCEMENT_RULES['rule-summit-namcheon-2025']; // 2025-07-31
  const chokjinDraftRule = ANNOUNCEMENT_RULES['rule-chokjin-3-draft']; // 2026-06-30

  // 1. PDF benchmark 전수 일치: 써밋 리미티드 남천
  {
    const s84b = SUMMIT_NAMCHEON_BENCHMARK.types.find((t) => t.typeCode === '84B')!;
    const s84a = SUMMIT_NAMCHEON_BENCHMARK.types.find((t) => t.typeCode === '84A')!;
    const s112a = SUMMIT_NAMCHEON_BENCHMARK.types.find((t) => t.typeCode === '112A')!;

    const passed =
      s84b.generalSupply.quota === 24 &&
      s84b.generalSupply.localApps === 7840 &&
      s84b.generalSupply.otherApps === 540 &&
      s84b.generalSupply.compRatio === 326.67 &&
      s84b.generalSupply.pointsMin === 72 &&
      s84b.generalSupply.pointsMax === 80 &&
      s84b.generalSupply.pointsAvg === 75.1 &&
      s84a.generalSupply.quota === 33 &&
      s84a.generalSupply.localApps === 4150 &&
      s84a.generalSupply.compRatio === 125.8 &&
      s84a.generalSupply.pointsAvg === 67.79 &&
      s112a.generalSupply.quota === null && // 미확인 추정치 제거 확인
      s112a.generalSupply.pointsMin === null; // 추첨 100%

    addResult(
      'Audit 1: 남천 써밋 PDF 원자료 전수 일치 및 84B 해당경쟁률 326.67 수정',
      passed,
      `84B: 공급 24세대, 해당 7,840건, 기타 540건, 해당경쟁률 326.67:1, 가점 72~80(평균 75.1)`
    );
  }

  // 2. PDF benchmark 전수 일치: 베뉴브 해운대
  {
    const v59a = VENUEVE_HAEUNDAE_BENCHMARK.types.find((t) => t.typeCode === '59A')!;
    const v59b = VENUEVE_HAEUNDAE_BENCHMARK.types.find((t) => t.typeCode === '59B')!;
    const v84a = VENUEVE_HAEUNDAE_BENCHMARK.types.find((t) => t.typeCode === '84A')!;
    const v84b = VENUEVE_HAEUNDAE_BENCHMARK.types.find((t) => t.typeCode === '84B')!;
    const v99 = VENUEVE_HAEUNDAE_BENCHMARK.types.find((t) => t.typeCode === '99')!;

    const passed =
      VENUEVE_HAEUNDAE_BENCHMARK.generalSupplyTotalUnits === 331 && // 415 공고번호 오류 수정
      VENUEVE_HAEUNDAE_BENCHMARK.specialSupplyTotalUnits === 298 &&
      v59a.generalSupply.quota === 11 &&
      v59a.generalSupply.compRatio === 177.5 &&
      v59a.specialSupply.totalQuota === 13 &&
      v59b.generalSupply.quota === 1 && // 15 오류 수정
      v59b.generalSupply.compRatio === 132.0 && // 21.33 오류 수정
      v84a.generalSupply.quota === 42 && // 18 오류 수정
      v84b.generalSupply.quota === 41 && // 42 오류 수정
      v84b.generalSupply.compRatio === 32.90 && // 32.90 canonical 경쟁률 (원자료 1,349 / 41 = 32.90:1)
      v84b.generalSupply.pointsMin === 65 &&
      v84b.specialSupply.totalQuota === 50 &&
      v99.generalSupply.quota === 94 &&
      v99.generalSupply.compRatio === 18.3 &&
      v99.generalSupply.pointsMin === null; // 추첨 100%

    addResult(
      'Audit 2: 베뉴브 해운대 PDF 원자료 전수 일치 및 84B 공급 41 / canonical 경쟁률 32.90 수정',
      passed,
      `84B: 일반공급 41세대(총 91세대 중 일반 41 / 특공 50), canonical 경쟁률 32.90:1, 가점 65점`
    );
  }

  // 3. PDF benchmark 전수 일치: 르엘 센텀
  {
    const l84 = LUEL_CENTUM_BENCHMARK.types.find((t) => t.typeCode === '84')!;
    const l104c = LUEL_CENTUM_BENCHMARK.types.find((t) => t.typeCode === '104C')!;
    const l104a = LUEL_CENTUM_BENCHMARK.types.find((t) => t.typeCode === '104A')!;

    const passed =
      l84.generalSupply.quota === 56 &&
      l84.generalSupply.localApps === 6517 &&
      l84.generalSupply.compRatio === 116.4 &&
      l84.generalSupply.pointsMin === 65 &&
      l84.generalSupply.pointsMax === null && // 미공개 null 보존
      l104c.generalSupply.quota === 105 &&
      l104c.generalSupply.compRatio === 13.2 &&
      l104c.generalSupply.pointsMin === 12 &&
      l104a.generalSupply.quota === null; // 미공개 null 보존

    addResult(
      'Audit 3: 르엘 센텀 PDF 원자료 전수 일치 및 미공개 가점/공급수 null 보존',
      passed,
      `84: 56세대 116.4:1(최저 65점, 최고 null), 104C: 105세대 13.2:1(최저 12점)`
    );
  }

  // 4. 2025 신생아 not_applicable 구분 (0:1 경쟁률 처리 금지)
  {
    let allNotApplicable = true;
    for (const project of BENCHMARK_PROJECTS) {
      if (project.rule.announcementDate < '2026-06-15') {
        for (const t of project.types) {
          if (t.specialSupply.newborn !== 'not_applicable') {
            allNotApplicable = false;
          }
        }
      }
    }

    addResult(
      'Audit 4: 2025년 3대 실적 복합단지 신생아 not_applicable 전수 적용',
      allNotApplicable,
      `2025년 모집공고는 신생아 특별공급 별도 배정이 없으므로 0:1 대신 not_applicable로 엄격 구분`
    );
  }

  // 5. 2026-06-15 전후 Rule Version 분리 검증
  {
    const newbornProfile = SUBSCRIPTION_PRESETS.find((p) => p.id === 'preset-newlywed-newborn')!.profile;

    // 1) 2025 공고(써밋 2025-07-31) 적용 시: not_applicable & eligible = false
    const eval2025 = evaluateSubscriptionEligibility(newbornProfile, summitRule);
    const passed2025 =
      eval2025.newborn.status === 'not_applicable' &&
      eval2025.newborn.eligible === false &&
      eval2025.newborn.reason.includes('2026-06-15 이전');

    // 2) 2026-06-15 이후 공고(촉진3 2026-06-30) 적용 시: applicable & eligible = true
    const eval2026 = evaluateSubscriptionEligibility(newbornProfile, chokjinDraftRule);
    const passed2026 =
      eval2026.newborn.status === 'applicable' &&
      eval2026.newborn.eligible === true &&
      eval2026.newborn.reason.includes('신생아 특별공급 요건 충족');

    const passed = passed2025 && passed2026;
    addResult(
      'Audit 5: 2026-06-15 전후 신생아특공 Rule Version 동적 분리',
      passed,
      `2025 공고: not_applicable (신혼/생초 20% 우선배정 연계) / 2026-06-15 이후 공고: 독립 신생아특공 적용`
    );
  }

  // 6. 부산 전입기간 경계값 테스트
  {
    const annDate = '2025-07-31';

    // 1) 공고일 당일 전입: 0개월
    const p1 = calculateResidencePeriod('2025-07-31', annDate);
    // 2) 정확히 1년 전 당일 (2024-07-31): 정확히 12개월 (1년) -> 12개월 요건 충족!
    const p2 = calculateResidencePeriod('2024-07-31', annDate);
    // 3) 1년 1일 전 (2024-08-01): 11개월 -> 12개월 요건 미달!
    const p3 = calculateResidencePeriod('2024-08-01', annDate);
    // 4) 공고일 이후 전입 (2025-08-01): 0개월 -> 미달!
    const p4 = calculateResidencePeriod('2025-08-01', annDate);

    const passed =
      p1.residenceMonths === 0 &&
      p2.residenceMonths === 12 &&
      p3.residenceMonths === 11 &&
      p4.residenceMonths === 0;

    addResult(
      'Audit 6: 부산 전입기간 경계값 정밀도 (공고일 당일, 12개월 정확일, 11개월, 공고일 이후)',
      passed,
      `당일전입: ${p1.residenceMonths}개월, 1년전: ${p2.residenceMonths}개월(충족), 1년-1일: ${p3.residenceMonths}개월(미달)`
    );
  }

  // 7. 가점 84점 경계값 테스트
  {
    // 무주택기간 경계값
    const scoreHomeless0 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, isHomeless: true, homelessYears: 0 }).homelessScore;
    const scoreHomeless1 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, isHomeless: true, homelessYears: 1 }).homelessScore;
    const scoreHomeless14 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, isHomeless: true, homelessYears: 14 }).homelessScore;
    const scoreHomeless15 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, isHomeless: true, homelessYears: 15 }).homelessScore;
    const scoreHomelessOwned = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, isHomeless: false, ownedHouseCount: 1 }).homelessScore;

    // 부양가족 경계값
    const scoreDep0 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, dependentCount: 0 }).dependentScore;
    const scoreDep1 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, dependentCount: 1 }).dependentScore;
    const scoreDep5 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, dependentCount: 5 }).dependentScore;
    const scoreDep6 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, dependentCount: 6 }).dependentScore;

    // 청약통장 경계값
    const scoreBank5 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, bankbookMonths: 5 }).bankbookScore;
    const scoreBank6 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, bankbookMonths: 6 }).bankbookScore;
    const scoreBank12 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, bankbookMonths: 12 }).bankbookScore;
    const scoreBank179 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, bankbookMonths: 179 }).bankbookScore;
    const scoreBank180 = calculateGeneralSupplyScore({ ...SUBSCRIPTION_PRESETS[0].profile, bankbookMonths: 180 }).bankbookScore;

    const passed =
      scoreHomelessOwned === 0 &&
      scoreHomeless0 === 2 &&
      scoreHomeless1 === 4 &&
      scoreHomeless14 === 30 &&
      scoreHomeless15 === 32 &&
      scoreDep0 === 5 &&
      scoreDep1 === 10 &&
      scoreDep5 === 30 &&
      scoreDep6 === 35 &&
      scoreBank5 === 1 &&
      scoreBank6 === 2 &&
      scoreBank12 === 3 &&
      scoreBank179 === 16 &&
      scoreBank180 === 17;

    addResult(
      'Audit 7: 청약가점 84점 만점 경계값 전수 검증 (무주택 0~32, 부양 5~35, 통장 1~17)',
      passed,
      `무주택: [${scoreHomeless0}, ${scoreHomeless1}, ${scoreHomeless14}, ${scoreHomeless15}], 부양: [${scoreDep0}, ${scoreDep1}, ${scoreDep6}], 통장: [${scoreBank5}, ${scoreBank6}, ${scoreBank180}]`
    );
  }

  // 8. 9대 사용자 프로필 자격 판정 회귀
  {
    const p1 = SUBSCRIPTION_PRESETS.find((p) => p.id === 'preset-newlywed')!;
    const a1 = evaluateSubscriptionEligibility(p1.profile, summitRule);
    const pElderly = SUBSCRIPTION_PRESETS.find((p) => p.id === 'preset-elderly-parent')!;
    const aElderly = evaluateSubscriptionEligibility(pElderly.profile, summitRule);

    const passed =
      a1.newlywed.eligible === true &&
      a1.generalSupply.isFirstPriority === true &&
      aElderly.elderlyParent.eligible === true;

    addResult(
      'Audit 8: 신혼부부 및 노부모부양 사용자 조건 판정 안정성 유지',
      passed,
      `신혼특공: ${a1.newlywed.eligible ? '가능' : '불가'}, 노부모특공: ${aElderly.elderlyParent.eligible ? '가능' : '불가'}`
    );
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    results,
  };
}

// Make failures visible to node --test (previously only reported via return value).
import nodeTest from 'node:test';
import nodeAssert from 'node:assert/strict';

nodeTest('청약 전략', () => {
  const report = runSubscriptionStrategyTestSuite();
  const failed = report.results.filter((r) => !r.passed);
  nodeAssert.equal(failed.length, 0, JSON.stringify(failed, null, 2));
  nodeAssert.ok(report.total > 0 && report.passed === report.total, `passed ${report.passed}/${report.total}`);
});
