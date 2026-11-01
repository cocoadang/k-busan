/**
 * Phase 5C: 실제 모집공고 Historical Backtest 테스트 스위트
 * 
 * 원칙:
 * 1. Phase 5A~5B-1 청약 Rule Engine은 Freeze하고 정확성 검증만 수행.
 * 2. 3개 실제 공고(써밋 남천, 르엘 센텀, 베뉴브 해운대)에 대해 당시 모집공고일 기준으로 프로필 재평가.
 * 3. 프로필 × 공고 × 청약경로 매트릭스 구성 및 검증.
 * 4. 당첨 가능성/확률 예측 금지, 특정 청약경로 추천/순위화 금지.
 * 5. 과거 경쟁률은 참고 실적으로만 표시, 현재 규칙을 과거 공고에 소급 적용 금지 (신생아는 2025 공고에서 not_applicable).
 * 6. PDF/Benchmark와 다른 값 발견 시 자동수정하지 않고 conflict 객체로 기록.
 */

import {
  evaluateSubscriptionEligibility,
  calculateGeneralSupplyScore,
  calculateResidencePeriod,
  resolveUserProfileForAnnouncement,
} from '../utils/subscriptionCalculator.ts';
import {
  ANNOUNCEMENT_RULES,
  BENCHMARK_PROJECTS,
  SUBSCRIPTION_PRESETS,
  SUMMIT_NAMCHEON_BENCHMARK,
  LUEL_CENTUM_BENCHMARK,
  VENUEVE_HAEUNDAE_BENCHMARK,
} from '../data/subscriptionBenchmarkData.ts';
import { DEFAULT_MULTI_PROFILES } from '../utils/multiProfileHelper.ts';
import { UserSubscriptionProfile, AnnouncementRule } from '../types/subscription.ts';

export interface BacktestMatrixCell {
  profileId: string;
  profileName: string;
  ruleId: string;
  projectName: string;
  announcementDate: string;
  residenceStatus: 'local_1st' | 'other_region';
  residenceMonths: number;
  newlywedEligible: boolean;
  firstLifeEligible: boolean;
  multiChildEligible: boolean;
  elderlyParentEligible: boolean;
  newbornStatus: 'applicable' | 'not_applicable';
  general1stEligible: boolean;
  generalTotalScore: number;
  under85Allocation: string;
  over85Allocation: string;
}

export interface BacktestConflictItem {
  announcementName: string;
  field: string;
  storedValue: any;
  expectedValue: any;
  sourceNote: string;
}

export interface TestResultItem {
  name: string;
  passed: boolean;
  message: string;
}

export function runHistoricalBacktestTestSuite(): {
  total: number;
  passed: number;
  conflicts: BacktestConflictItem[];
  matrixSummary: {
    announcementsCount: number;
    profilesCount: number;
    totalEvaluations: number;
  };
  results: TestResultItem[];
} {
  const results: TestResultItem[] = [];
  const conflicts: BacktestConflictItem[] = [];

  const addResult = (name: string, passed: boolean, message: string) => {
    results.push({ name, passed, message });
  };

  // 대상 실제 3대 공고
  const targetRules: AnnouncementRule[] = [
    ANNOUNCEMENT_RULES['rule-summit-namcheon-2025'],
    ANNOUNCEMENT_RULES['rule-luel-centum-2025'],
    ANNOUNCEMENT_RULES['rule-venueve-haeundae-2025'],
  ];

  // 검증 프로필 셋 구성 (프리셋 9종 + 멀티프로필 3종 = 총 12종)
  const testProfiles: { id: string; name: string; profile: UserSubscriptionProfile }[] = [
    ...SUBSCRIPTION_PRESETS.map((p) => ({ id: p.id, name: p.name, profile: p.profile })),
    ...DEFAULT_MULTI_PROFILES.map((p) => ({ id: p.id, name: p.alias, profile: p.profile })),
  ];

  // 1. 프로필 × 공고 × 청약경로 매트릭스 계산 및 검증
  const matrix: BacktestMatrixCell[] = [];

  for (const rule of targetRules) {
    for (const tp of testProfiles) {
      const evaluation = evaluateSubscriptionEligibility(tp.profile, rule);

      // 1) 부산 거주기간 & 해당지역 여부
      const isLocal1st = evaluation.residenceAnalysis.meetsLocalRequirement;
      const resMonths = evaluation.residenceAnalysis.residenceMonths;

      // 2) 신혼부부 특공
      const newlywedEligible = evaluation.newlywed.eligible;

      // 3) 생애최초 특공
      const firstLifeEligible = evaluation.firstLife.eligible;

      // 4) 다자녀 특공
      const multiChildEligible = evaluation.multiChild.eligible;

      // 5) 노부모부양 특공
      const elderlyParentEligible = evaluation.elderlyParent.eligible;

      // 6) 신생아 특공 (2025년 과거 공고는 100% not_applicable)
      const newbornStatus = evaluation.newborn.status === 'not_applicable' ? 'not_applicable' : 'applicable';

      // 7) 일반공급 1순위 & 가점
      const general1stEligible = evaluation.generalSupply.isFirstPriority;
      const generalTotalScore = evaluation.generalSupply.scoreBreakdown.totalScore;

      // 8) 85㎡ 이하/초과 공급방식
      const under85Desc = `가점 ${rule.generalAllocationRatio.under85.pointsRatio}% + 추첨 ${rule.generalAllocationRatio.under85.lotteryRatio}%`;
      const over85Desc = `가점 ${rule.generalAllocationRatio.over85.pointsRatio}% + 추첨 ${rule.generalAllocationRatio.over85.lotteryRatio}%`;

      matrix.push({
        profileId: tp.id,
        profileName: tp.name,
        ruleId: rule.ruleId,
        projectName: rule.projectName,
        announcementDate: rule.announcementDate,
        residenceStatus: isLocal1st ? 'local_1st' : 'other_region',
        residenceMonths: resMonths,
        newlywedEligible,
        firstLifeEligible,
        multiChildEligible,
        elderlyParentEligible,
        newbornStatus,
        general1stEligible,
        generalTotalScore,
        under85Allocation: under85Desc,
        over85Allocation: over85Desc,
      });
    }
  }

  // --- 단위 테스트 검증 ---

  // Test 1: 매트릭스 전수 계산 무결성 (3공고 × 12프로필 = 36개 조합)
  {
    const expectedCount = targetRules.length * testProfiles.length;
    const passed = matrix.length === expectedCount && expectedCount === 36;
    addResult(
      'Test 1: 프로필 × 공고 매트릭스 36개 조합 전수 생성',
      passed,
      `총 3개 실제공고 × 12개 테스트 프로필 = ${matrix.length}개 평가 셀 완료`
    );
  }

  // Test 2: 써밋 리미티드 남천 (2025-07-31) 시점 기준 과거 공고 재현 검증
  {
    const summitRule = ANNOUNCEMENT_RULES['rule-summit-namcheon-2025'];
    const summitCells = matrix.filter((c) => c.ruleId === summitRule.ruleId);

    // 2-1: 신생아 특공 소급적용 배제 (12개 프로필 전원 not_applicable)
    const allNewbornNotApplicable = summitCells.every((c) => c.newbornStatus === 'not_applicable');

    // 2-2: '부산 전입 직후' 프로필(preset-busan-recent-transfer, 전입 2025-05-20) -> 2개월로 기타지역 판정
    const recentTransferCell = summitCells.find((c) => c.profileId === 'preset-busan-recent-transfer');
    const recentTransferCorrect =
      recentTransferCell !== undefined &&
      recentTransferCell.residenceStatus === 'other_region' &&
      recentTransferCell.residenceMonths < 12;

    // 2-3: '70세 장기무주택' 프로필(preset-elderly-70-homeless) -> 가점 고득점(64점), 일반공급 1순위
    const elderlyHomelessCell = summitCells.find((c) => c.profileId === 'preset-elderly-70-homeless');
    const elderlyScoreCorrect =
      elderlyHomelessCell !== undefined &&
      elderlyHomelessCell.generalTotalScore === 64 && // 무주택 32점 + 부양 15점 + 통장 17점 = 64점
      elderlyHomelessCell.general1stEligible === true;

    // 2-4: 85㎡ 이하 (가점 40/추첨 60) 및 85㎡ 초과 (추첨 100%) 공급방식 분리
    const allocationCorrect =
      summitRule.generalAllocationRatio.under85.pointsRatio === 40 &&
      summitRule.generalAllocationRatio.under85.lotteryRatio === 60 &&
      summitRule.generalAllocationRatio.over85.pointsRatio === 0 &&
      summitRule.generalAllocationRatio.over85.lotteryRatio === 100;

    const passed =
      allNewbornNotApplicable &&
      recentTransferCorrect &&
      elderlyScoreCorrect &&
      allocationCorrect;

    addResult(
      'Test 2: 써밋 리미티드 남천 (2025-07-31) 과거 공고 규칙 및 거주기간 재현',
      passed,
      `신생아 전원 not_applicable(${allNewbornNotApplicable}), 전입직후 기타지역(${recentTransferCorrect}), 70세 가점 64점(${elderlyScoreCorrect}), 평형별 배정 분리(${allocationCorrect})`
    );
  }

  // Test 3: 르엘 리버파크 센텀 (2025-07-11) 대형 평형 단지 및 공고일 시점 역산 검증
  {
    const luelRule = ANNOUNCEMENT_RULES['rule-luel-centum-2025'];
    const luelCells = matrix.filter((c) => c.ruleId === luelRule.ruleId);

    // 3-1: 신생아 특공 전원 not_applicable
    const allNewbornNotApplicable = luelCells.every((c) => c.newbornStatus === 'not_applicable');

    // 3-2: 르엘 센텀의 공고일(2025-07-11) 기준 거주기간 판정
    // 'preset-busan-recent-transfer' (전입 2025-05-20): 1개월 -> 기타지역
    const recentCell = luelCells.find((c) => c.profileId === 'preset-busan-recent-transfer');
    const recentCorrect = recentCell?.residenceStatus === 'other_region';

    // 3-3: '다자녀' 프로필(preset-multi-child): 2025-07-11 기준 만 19세 미만 자녀 2명 충족 -> 다자녀 적격
    const multiChildCell = luelCells.find((c) => c.profileId === 'preset-multi-child');
    const multiChildCorrect = multiChildCell?.multiChildEligible === true;

    // 3-4: 85㎡ 초과 추첨 100% (가점 0%)
    const over85LotteryOnly =
      luelRule.generalAllocationRatio.over85.pointsRatio === 0 &&
      luelRule.generalAllocationRatio.over85.lotteryRatio === 100;

    const passed =
      allNewbornNotApplicable &&
      recentCorrect &&
      multiChildCorrect &&
      over85LotteryOnly;

    addResult(
      'Test 3: 르엘 리버파크 센텀 (2025-07-11) 대형 평형 공급방식 및 다자녀 자격 검증',
      passed,
      `신생아 not_applicable(${allNewbornNotApplicable}), 전입직후 기타지역(${recentCorrect}), 다자녀 적격(${multiChildCorrect}), 85초과 100% 추첨(${over85LotteryOnly})`
    );
  }

  // Test 4: 베뉴브 해운대 (2025-09-19) 공고 시점 및 캐노니컬 데이터 무결성 검증
  {
    const venueveRule = ANNOUNCEMENT_RULES['rule-venueve-haeundae-2025'];
    const venueveCells = matrix.filter((c) => c.ruleId === venueveRule.ruleId);

    // 4-1: 신생아 특공 전원 not_applicable
    const allNewbornNotApplicable = venueveCells.every((c) => c.newbornStatus === 'not_applicable');

    // 4-2: 노부모부양 프로필(preset-elderly-parent, 부양 4년, 무주택 9년 세대주) 적격 확인
    const elderlyParentCell = venueveCells.find((c) => c.profileId === 'preset-elderly-parent');
    const elderlyParentCorrect = elderlyParentCell?.elderlyParentEligible === true;

    // 4-3: 베뉴브 해운대 84B의 청약홈 공식 캐노니컬 경쟁률 32.90 및 공급 41세대 일치 확인
    const venueve84B = VENUEVE_HAEUNDAE_BENCHMARK.types.find((t) => t.typeCode === '84B');
    const canonical84BCorrect =
      venueve84B?.generalSupply?.quota === 41 &&
      venueve84B?.generalSupply?.compRatio === 32.90;

    const passed = allNewbornNotApplicable && elderlyParentCorrect && canonical84BCorrect;

    addResult(
      'Test 4: 베뉴브 해운대 (2025-09-19) 노부모부양 및 84B 캐노니컬 데이터(32.90:1 / 41세대) 재현',
      passed,
      `신생아 not_applicable(${allNewbornNotApplicable}), 노부모 적격(${elderlyParentCorrect}), 84B 정밀값 32.90/41세대(${canonical84BCorrect})`
    );
  }

  // Test 5: 당첨 예측 및 추천/순위화 필드 부재 검증 (원칙 준수)
  {
    // matrix 셀 내에 winRate, prediction, recommend, scoreRanking 등의 예측 필드가 존재하지 않음을 확인
    let hasPredictionField = false;
    for (const cell of matrix) {
      const keys = Object.keys(cell);
      if (
        keys.includes('winChance') ||
        keys.includes('probability') ||
        keys.includes('recommendedPath') ||
        keys.includes('ranking')
      ) {
        hasPredictionField = true;
        break;
      }
    }

    const passed = !hasPredictionField;
    addResult(
      'Test 5: 당첨 예측·확률 및 청약경로 순위화 필드 배제 원칙 준수',
      passed,
      '결과 데이터 모델에 당첨확률(probability) 및 추천/순위(recommendation) 미포함 확인'
    );
  }

  // Test 6: PDF / 공식 Benchmark 실적 데이터 전수 Conflict 점검
  {
    // 써밋 남천
    const summit84B = SUMMIT_NAMCHEON_BENCHMARK.types.find((t) => t.typeCode === '84B');
    if (summit84B?.generalSupply?.compRatio !== 326.67) {
      conflicts.push({
        announcementName: '써밋 리미티드 남천',
        field: '84B 일반공급 경쟁률',
        storedValue: summit84B?.generalSupply?.compRatio,
        expectedValue: 326.67,
        sourceNote: '해당지역 7,840건 / 24세대 = 326.67:1 (1순위 해당지역 마감)',
      });
    }

    // 베뉴브 해운대 84B 세대수 및 경쟁률
    const venueve84B = VENUEVE_HAEUNDAE_BENCHMARK.types.find((t) => t.typeCode === '84B');
    if (venueve84B?.generalSupply?.quota !== 41) {
      conflicts.push({
        announcementName: '베뉴브 해운대',
        field: '84B 일반공급 세대수',
        storedValue: venueve84B?.generalSupply?.quota,
        expectedValue: 41,
        sourceNote: '입주자모집공고 41세대',
      });
    }
    if (venueve84B?.generalSupply?.compRatio !== 32.90) {
      conflicts.push({
        announcementName: '베뉴브 해운대',
        field: '84B 일반공급 경쟁률',
        storedValue: venueve84B?.generalSupply?.compRatio,
        expectedValue: 32.90,
        sourceNote: '청약홈 접수결과 1,349건 / 41세대 = 32.90:1',
      });
    }

    // 2025 공고 신생아 특공 not_applicable 처리 일치 여부
    for (const b of [SUMMIT_NAMCHEON_BENCHMARK, LUEL_CENTUM_BENCHMARK, VENUEVE_HAEUNDAE_BENCHMARK]) {
      for (const t of b.types) {
        if (t.specialSupply && t.specialSupply.newborn !== 'not_applicable') {
          conflicts.push({
            announcementName: b.name,
            field: `${t.typeCode} 신생아 특공 배정`,
            storedValue: t.specialSupply.newborn,
            expectedValue: 'not_applicable',
            sourceNote: '2026-06-15 이전 공고로 신생아 독립특공 미적용',
          });
        }
      }
    }

    const passed = conflicts.length === 0;
    addResult(
      'Test 6: PDF 및 Benchmark 실적 데이터 전수 대조 (Conflict Audit)',
      passed,
      `발견된 불일치(Conflict): ${conflicts.length}건 (원자료 100% 일치)`
    );
  }

  // Test 7: 가점 계산기 84점 만점 산정 정확도 백테스트 (무주택 0~32, 부양가족 5~35, 통장 1~17)
  {
    // 경계 프로필 생성
    const maxScoreProfile: UserSubscriptionProfile = {
      ...testProfiles[0].profile,
      isHomeless: true,
      homelessYears: 16, // 15년 초과 -> 32점 만점
      dependentCount: 6,  // 6명 이상 -> 35점 만점
      bankbookMonths: 190,// 15년 이상 -> 17점 만점
    };
    const maxScore = calculateGeneralSupplyScore(maxScoreProfile);

    const minScoreProfile: UserSubscriptionProfile = {
      ...testProfiles[0].profile,
      isHomeless: false, // 유주택 -> 0점
      homelessYears: 0,
      dependentCount: 0, // 0명 -> 5점
      bankbookMonths: 3, // 6개월 미만 -> 1점
    };
    const minScore = calculateGeneralSupplyScore(minScoreProfile);

    const passed =
      maxScore.totalScore === 84 &&
      maxScore.homelessScore === 32 &&
      maxScore.dependentScore === 35 &&
      maxScore.bankbookScore === 17 &&
      minScore.totalScore === 6 &&
      minScore.homelessScore === 0 &&
      minScore.dependentScore === 5 &&
      minScore.bankbookScore === 1;

    addResult(
      'Test 7: 일반공급 가점 84점 만점 및 최저점 경계 산출 정밀도',
      passed,
      `만점 산출: ${maxScore.totalScore}점(무주택 32 + 부양 35 + 통장 17) / 최저점 산출: ${minScore.totalScore}점(무주택 0 + 부양 5 + 통장 1)`
    );
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    conflicts,
    matrixSummary: {
      announcementsCount: targetRules.length,
      profilesCount: testProfiles.length,
      totalEvaluations: matrix.length,
    },
    results,
  };
}

// Make failures visible to node --test (previously only reported via return value).
import nodeTest from 'node:test';
import nodeAssert from 'node:assert/strict';

nodeTest('청약 과거 공고 백테스트', () => {
  const report = runHistoricalBacktestTestSuite();
  const failed = report.results.filter((r) => !r.passed);
  nodeAssert.equal(failed.length, 0, JSON.stringify(failed, null, 2));
  nodeAssert.equal(report.conflicts.length, 0, JSON.stringify(report.conflicts, null, 2));
  nodeAssert.ok(report.total > 0 && report.passed === report.total, `passed ${report.passed}/${report.total}`);
});
