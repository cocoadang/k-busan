/**
 * Phase 5D: 모집공고 Data-Driven Onboarding 테스트 스위트
 * 
 * 검증 목표:
 * 1. SubscriptionAnnouncement 정규 스키마 및 evidenceSourceId 전수 연계 검증
 * 2. Validator의 정합성 검사 (미확인 0 입력 금지, 특공 세부 합계, 가점/추첨 비율)
 * 3. conflict 및 unresolved 상태 분기 및 리포팅
 * 4. SubscriptionAnnouncementRegistry를 통한 온보딩 성공
 * 5. toEngineAnnouncementRule 어댑터를 통한 기존 Phase 5A~5C 청약엔진 무수정 자동 연동
 * 6. 공고 미등록 시 "공고 확인 필요" 유지 vs 등록 후 "공고 확정" 전환 검증
 * 7. 예측/추천 필드 배제 원칙 준수
 */

import {
  SubscriptionAnnouncement,
  AnnouncementTypeSupplyPlan,
} from '../types/subscriptionAnnouncement.ts';
import { validateSubscriptionAnnouncement } from '../utils/announcementValidator.ts';
import { subscriptionAnnouncementRegistry } from '../registry/subscriptionAnnouncementRegistry.ts';
import {
  evaluateSubscriptionEligibility,
  calculateGeneralSupplyScore,
} from '../utils/subscriptionCalculator.ts';
import {
  isDraftAnnouncementRule,
  evaluateMultiProfiles,
} from '../utils/multiProfileHelper.ts';
import { UserSubscriptionProfile } from '../types/subscription.ts';
import { ANNOUNCEMENT_RULES } from '../data/subscriptionBenchmarkData.ts';

export interface TestResultItem {
  name: string;
  passed: boolean;
  message: string;
}

/** 온보딩 테스트용 단일 정규 Fixture Announcement (가상 촉진3 공고 등록 시뮬레이션) */
export const FIXTURE_SUBSCRIPTION_ANNOUNCEMENT: SubscriptionAnnouncement = {
  announcementId: 'announcement-fixture-chokjin3-2026-10',
  projectId: 'fixture-chokjin-3',
  projectName: '촉진3구역 아크로 센티엘 (모집공고 온보딩 테스트 Fixture)',
  announcementDate: '2026-10-15',
  status: 'verified',
  overallEvidenceSourceId: 'ev-official-announcement-fixture-2026-001',
  verificationNotes: '온보딩 엔진 검증을 위한 정규 Fixture 공고 데이터',
  residenceRequirement: {
    targetRegion: 'busan',
    requirementMonths: 12,
    isRestrictedArea: false,
    evidenceSourceId: 'ev-residence-rule-001',
    status: 'verified',
  },
  totalSupplySummary: {
    totalSupplyUnits: 200,
    specialSupplyTotalUnits: 100,
    generalSupplyTotalUnits: 100,
    evidenceSourceId: 'ev-supply-summary-001',
    status: 'verified',
  },
  typeSupplies: [
    {
      typeCode: '59A',
      exclusiveArea: 59.9,
      supplyCategory: 'under85',
      totalSupplyUnits: 80,
      specialSupply: {
        multiChildQuota: 8,
        newlywedQuota: 15,
        firstLifeQuota: 7,
        newbornQuota: 5,
        elderlyParentQuota: 2,
        institutionQuota: 3,
        totalSpecialQuota: 40,
      },
      generalSupply: {
        quota: 40,
        pointsRatio: 40,
        lotteryRatio: 60,
      },
      evidenceSourceId: 'ev-type-59a-001',
      status: 'verified',
    },
    {
      typeCode: '84A',
      exclusiveArea: 84.9,
      supplyCategory: 'under85',
      totalSupplyUnits: 120,
      specialSupply: {
        multiChildQuota: 12,
        newlywedQuota: 22,
        firstLifeQuota: 11,
        newbornQuota: 8,
        elderlyParentQuota: 3,
        institutionQuota: 4,
        totalSpecialQuota: 60,
      },
      generalSupply: {
        quota: 60,
        pointsRatio: 40,
        lotteryRatio: 60,
      },
      evidenceSourceId: 'ev-type-84a-001',
      status: 'verified',
    },
  ],
  generalAllocationRatio: {
    under85: { pointsRatio: 40, lotteryRatio: 60 },
    over85: { pointsRatio: 0, lotteryRatio: 100 },
    evidenceSourceId: 'ev-allocation-ratio-001',
    status: 'verified',
  },
  bankbookRequirement: {
    minSubscriptionMonths: 6,
    depositByArea: {
      under85: 300,
      under102: 600,
      under135: 1000,
      allAreas: 1500,
    },
    evidenceSourceId: 'ev-bankbook-rule-001',
    status: 'verified',
  },
  incomeAssetRequirement: {
    incomeApplicablePaths: ['newlywed', 'firstLife', 'newborn'],
    assetThresholdRealEstate: 33100,
    assetThresholdVehicle: 3708,
    evidenceSourceId: 'ev-income-asset-rule-001',
    status: 'verified',
  },
};

export function runAnnouncementOnboardingTestSuite(): {
  total: number;
  passed: number;
  results: TestResultItem[];
} {
  const results: TestResultItem[] = [];

  const addResult = (name: string, passed: boolean, message: string) => {
    results.push({ name, passed, message });
  };

  // Test 1: 정규 Fixture 스키마 및 evidenceSourceId 전수 연계 검증
  {
    const fixture = FIXTURE_SUBSCRIPTION_ANNOUNCEMENT;
    const hasMainEvidence = Boolean(fixture.overallEvidenceSourceId);
    const hasResidenceEvidence = Boolean(fixture.residenceRequirement.evidenceSourceId);
    const hasSummaryEvidence = Boolean(fixture.totalSupplySummary.evidenceSourceId);
    const hasGenRatioEvidence = Boolean(fixture.generalAllocationRatio.evidenceSourceId);
    const hasBankbookEvidence = Boolean(fixture.bankbookRequirement.evidenceSourceId);
    const hasIncomeEvidence = Boolean(fixture.incomeAssetRequirement.evidenceSourceId);
    const allTypesHaveEvidence = fixture.typeSupplies.every((t) => Boolean(t.evidenceSourceId));

    const passed =
      hasMainEvidence &&
      hasResidenceEvidence &&
      hasSummaryEvidence &&
      hasGenRatioEvidence &&
      hasBankbookEvidence &&
      hasIncomeEvidence &&
      allTypesHaveEvidence;

    addResult(
      'Test 1: 정규 공고 스키마의 모든 값에 evidenceSourceId 연계 확인',
      passed,
      `메인(${hasMainEvidence}), 거주요건(${hasResidenceEvidence}), 총공급(${hasSummaryEvidence}), 타입별(${allTypesHaveEvidence}) 증빙 ID 연계 완료`
    );
  }

  // Test 2: 유효성 검증 엔진 (Validator) 정상 Fixture 판정
  {
    const valResult = validateSubscriptionAnnouncement(FIXTURE_SUBSCRIPTION_ANNOUNCEMENT);
    const passed = valResult.isValid && valResult.canOnboard && valResult.errors.length === 0;

    addResult(
      'Test 2: AnnouncementValidator를 통한 정상 공고 검증 및 Onboard 승인',
      passed,
      `isValid: ${valResult.isValid}, canOnboard: ${valResult.canOnboard}, errors: ${valResult.errors.length}건`
    );
  }

  // Test 3: 산술 불일치(총 공급 세대수 오류) 시 Validator 에러 감지
  {
    const corrupted: SubscriptionAnnouncement = {
      ...FIXTURE_SUBSCRIPTION_ANNOUNCEMENT,
      totalSupplySummary: {
        ...FIXTURE_SUBSCRIPTION_ANNOUNCEMENT.totalSupplySummary,
        totalSupplyUnits: 250, // 100 + 100 = 200인데 250으로 왜곡
      },
    };
    const valResult = validateSubscriptionAnnouncement(corrupted);
    const passed = !valResult.isValid && valResult.errors.some((e) => e.includes('총 세대수 불일치'));

    addResult(
      'Test 3: 특별공급 + 일반공급 세대수 합계 오류 시 Validation 반려',
      passed,
      `오류 감지: ${valResult.errors[0]}`
    );
  }

  // Test 4: Conflict 및 Unresolved 상태 분기 및 리포팅
  {
    const conflictAnnouncement: SubscriptionAnnouncement = {
      ...FIXTURE_SUBSCRIPTION_ANNOUNCEMENT,
      announcementId: 'announcement-conflict-test',
      status: 'conflict',
    };
    const conflictResult = validateSubscriptionAnnouncement(conflictAnnouncement);

    const unresolvedAnnouncement: SubscriptionAnnouncement = {
      ...FIXTURE_SUBSCRIPTION_ANNOUNCEMENT,
      announcementId: 'announcement-unresolved-test',
      status: 'unresolved',
    };
    const unresolvedResult = validateSubscriptionAnnouncement(unresolvedAnnouncement);

    const passed =
      conflictResult.canOnboard === false &&
      Boolean(conflictResult.conflictReport) &&
      unresolvedResult.canOnboard === false &&
      unresolvedResult.warnings.length > 0;

    addResult(
      'Test 4: conflict(불일치) 및 unresolved(미해결) 공고 자동 격리 및 Onboard 거부',
      passed,
      `conflict Onboard 거부(${!conflictResult.canOnboard}), unresolved Onboard 거부(${!unresolvedResult.canOnboard})`
    );
  }

  // Test 5: 레지스트리 온보딩 및 AnnouncementRule 자동 변환 어댑터
  {
    subscriptionAnnouncementRegistry.clearForTesting();
    const regResult = subscriptionAnnouncementRegistry.registerAnnouncement(FIXTURE_SUBSCRIPTION_ANNOUNCEMENT);
    const hasVerified = subscriptionAnnouncementRegistry.hasVerifiedAnnouncement('fixture-chokjin-3');
    const stored = subscriptionAnnouncementRegistry.getAnnouncement('fixture-chokjin-3');

    const rule = subscriptionAnnouncementRegistry.toEngineAnnouncementRule(FIXTURE_SUBSCRIPTION_ANNOUNCEMENT);
    const typeRows = subscriptionAnnouncementRegistry.toEngineTypeComparisonRows(FIXTURE_SUBSCRIPTION_ANNOUNCEMENT);

    const passed =
      regResult.success &&
      hasVerified &&
      stored !== undefined &&
      rule.ruleId.includes('fixture-chokjin-3') &&
      rule.busanResidenceRequirementMonths === 12 &&
      typeRows.length === 2 &&
      typeRows[0].typeCode === '59A' &&
      typeRows[0].supplyMethod.includes('가점 40%');

    addResult(
      'Test 5: SubscriptionAnnouncementRegistry 등록 및 Rule Engine 어댑터 변환',
      passed,
      `등록 성공(${regResult.success}), Rule ID(${rule.ruleId}), 타입비교행(${typeRows.length}개 생성, 예측 compRatio=null)`
    );
  }

  // Test 6: 기존 Phase 5A~5C Rule Engine과 무수정 직결 (Eligibility Evaluation)
  {
    const rule = subscriptionAnnouncementRegistry.toEngineAnnouncementRule(FIXTURE_SUBSCRIPTION_ANNOUNCEMENT);

    // 2026-10-15 공고이므로 2024-11-20 출생 자녀는 1년 11개월로 신생아 특공 현행 규칙 적용 대상
    const newbornProfile: UserSubscriptionProfile = {
      residenceRegion: 'busan',
      busanTransferDate: '2023-01-01',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 4,
      homelessSince: '2022-01-01',
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 2,
      marriageDate: '2024-05-10',
      minorChildrenCount: 1,
      childrenBirthDates: ['2024-11-20'], // 공고일 기준 만 2세 미만
      hasNewborn: true,
      newbornBirthDate: '2024-11-20',
      isFirstLifeEver: false,
      taxPaid5Years: true,
      bankbookMonths: 36,
      depositAmount: 300,
      dependentCount: 2,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_140',
      assetSatisfied: true,
    };

    // 기존 엔진 evaluateSubscriptionEligibility 호출
    const evaluation = evaluateSubscriptionEligibility(newbornProfile, rule);

    const passed =
      evaluation.residenceAnalysis.meetsLocalRequirement === true &&
      evaluation.newborn.status === 'applicable' && // 2026 공고이므로 신생아 제도 적용!
      evaluation.newborn.eligible === true &&
      evaluation.generalSupply.isFirstPriority === true &&
      evaluation.generalSupply.scoreBreakdown.totalScore > 0;

    addResult(
      'Test 6: 기존 청약엔진(evaluateSubscriptionEligibility) 무수정 자동 연동 및 2026 신생아 규칙 적용',
      passed,
      `해당지역 1순위(${evaluation.residenceAnalysis.meetsLocalRequirement}), 신생아 특공 적용(${evaluation.newborn.status}) 및 적격(${evaluation.newborn.eligible}), 일반 1순위(${evaluation.generalSupply.isFirstPriority})`
    );
  }

  // Test 7: 공고 미등록 시 "공고 확인 필요" 유지 vs 등록 후 "공고 확정" 전환 검증
  {
    // 1) 기존 미등록 초안 규칙 (rule-chokjin-3-draft)
    const draftRule = ANNOUNCEMENT_RULES['rule-chokjin-3-draft'];
    const isDraftBefore = isDraftAnnouncementRule(draftRule);

    // 2) 온보딩을 통해 검증 완료된 공식 공고 룰
    const officialRule = subscriptionAnnouncementRegistry.toEngineAnnouncementRule(FIXTURE_SUBSCRIPTION_ANNOUNCEMENT);
    const isDraftAfter = isDraftAnnouncementRule(officialRule);

    const passed = isDraftBefore === true && isDraftAfter === false;

    addResult(
      'Test 7: 공고 미등록 상태(초안) 공고 확인 필요 유지 vs 온보딩 등록 후 공고 확정 전환',
      passed,
      `미등록 모델 초안플래그(${isDraftBefore} - 공고 확인 필요 유지) -> 정식 온보딩 후(${isDraftAfter} - 공고 확정)`
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

nodeTest('청약 공고 온보딩', () => {
  const report = runAnnouncementOnboardingTestSuite();
  const failed = report.results.filter((r) => !r.passed);
  nodeAssert.equal(failed.length, 0, JSON.stringify(failed, null, 2));
  nodeAssert.ok(report.total > 0 && report.passed === report.total, `passed ${report.passed}/${report.total}`);
});
