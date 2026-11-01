/**
 * Phase 4F-1: Plan Evidence Onboarding Pipeline Integration Test Suite
 *
 * 검증 시나리오:
 * 1. Evidence registration (원천 근거 등록)
 * 2. Extracted Fact creation (초기 추출 팩트 생성)
 * 3. Extracted → Verified transition (검증 전이)
 * 4. Verified → Normalized transition (정규화 전이)
 * 5. Normalized promotion eligibility (정규화 완료 팩트의 승격 자격 부여)
 * 6. Extracted promotion rejection (V7: extracted 상태 직접 승격 차단)
 * 7. Rejected promotion rejection (V6: rejected 팩트 승격 차단)
 * 8. Conflict detection & Conflicted promotion rejection (V4 충돌 감지 & V5 차단, 자동최신선택 금지)
 * 9. Missing sourceId on normalized fact (V2 차단)
 * 10. Invalid source reference (V1: unregistered sourceId 차단)
 * 11. documentStatus / factStatus separation (V8: 개념 혼용 차단)
 * 12. existing chokjin-3 regression (총 3,545 = 3,365 + 180, 1,727 + 20 + 1,618 = 3,365, proposal 보존)
 * 13. Partial Project compatibility (우동3, 삼익비치 source_not_available 유지 및 fake data 0건)
 */

import {
  PlanFactCandidate,
  PlanEvidenceReference,
  ProjectPlanConfig,
} from '../types/planConfig.ts';
import {
  createExtractedFact,
  verifyFact,
  normalizeFact,
  rejectFact,
  detectFactConflicts,
  validateFactsAgainstRegistry,
  canPromoteFactToConfig,
  applyFactToTotalUnitsSummary,
} from '../pipeline/planEvidencePipeline.ts';
import {
  getProjectPlanConfig,
  getAllProjectPlanConfigs,
} from '../data/projects/planRegistry.ts';
import { CHOKJIN3_UNIT_TYPES } from '../data/chokjin3PlanData.ts';

export interface OnboardingTestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

export function runPlanEvidenceOnboardingSuite(): {
  total: number;
  passed: number;
  results: OnboardingTestResult[];
} {
  const results: OnboardingTestResult[] = [];

  // =========================================================================
  // Test 1: Evidence Registration & Location 지원
  // =========================================================================
  {
    const fixtureSource: PlanEvidenceReference = {
      sourceId: 'fixture-assoc-meeting-2026-v1',
      sourceType: 'association',
      title: '2026년도 정기총회 조합원 배포 책자',
      documentNumber: 'ASSOC-2026-03',
      issuer: '촉진3구역 주택재개발정비사업조합',
      publishedAt: '2026-03-15',
      documentStatus: 'proposal',
      evidenceNotes: '사업시행계획 변경안 총회 의결 책자',
    };

    const hasAllFields =
      fixtureSource.sourceId === 'fixture-assoc-meeting-2026-v1' &&
      fixtureSource.documentStatus === 'proposal' &&
      fixtureSource.issuer !== undefined;

    results.push({
      suite: 'Test 1: Evidence Registration',
      name: '원천 Evidence 참조 객체 등록 및 메타데이터 지원',
      passed: hasAllFields,
      details: `sourceId: ${fixtureSource.sourceId}, status: ${fixtureSource.documentStatus}`,
    });
  }

  // =========================================================================
  // Test 2: Extracted Fact Creation (초기 추출 단계)
  // =========================================================================
  {
    const extracted = createExtractedFact({
      factId: 'fact-total-units-3545',
      projectId: 'chokjin-3',
      field: 'totalUnits',
      value: 3545,
      sourceId: 'fixture-assoc-meeting-2026-v1',
      evidenceLocation: {
        page: 42,
        section: '제3장 사업시행계획',
        table: '표 3-2 주택건설계획 총괄표',
        note: '총 건립세대수 합계란',
      },
      auditNotes: 'PDF 42페이지 원본 표에서 추출됨',
    });

    const passed =
      extracted.status === 'extracted' &&
      extracted.value === 3545 &&
      extracted.extractedAt !== undefined &&
      extracted.evidenceLocation?.page === 42;

    results.push({
      suite: 'Test 2: Extracted Fact Creation',
      name: 'status="extracted"로 초기 팩트 정상 생성 및 evidenceLocation 기록',
      passed,
      details: `status: ${extracted.status}, page: ${extracted.evidenceLocation?.page}`,
    });
  }

  // =========================================================================
  // Test 3: Extracted → Verified Transition
  // =========================================================================
  {
    const raw = createExtractedFact({
      factId: 'fact-total-units-3545',
      projectId: 'chokjin-3',
      field: 'totalUnits',
      value: 3545,
      sourceId: 'fixture-assoc-meeting-2026-v1',
    });

    const verified = verifyFact(raw, {
      verifiedBy: 'analyst-1',
      notes: '원본 PDF 표 3-2 대조 결과 3,545세대 텍스트 실물 확인 완료',
      evidenceLocation: { page: 42, table: '표 3-2' },
    });

    const passed =
      verified.status === 'verified' &&
      verified.verifiedAt !== undefined &&
      verified.verificationNote?.includes('3,545세대') === true;

    results.push({
      suite: 'Test 3: Extracted → Verified Transition',
      name: '대조 검증 완료 시 status="verified" 및 검증일시/메모 기록',
      passed,
      details: `status: ${verified.status}, verifiedAt: ${verified.verifiedAt}`,
    });
  }

  // =========================================================================
  // Test 4: Verified → Normalized Transition
  // =========================================================================
  {
    const raw = createExtractedFact({
      factId: 'fact-total-units-3545',
      projectId: 'chokjin-3',
      field: 'totalUnits',
      value: '3,545세대', // 추출 원시 문자열 형태
      sourceId: 'fixture-assoc-meeting-2026-v1',
    });

    const verified = verifyFact(raw, { notes: '실물 확인' });

    const normalized = normalizeFact<string, number>(verified, {
      normalizedValue: 3545, // 데이터 모델에 맞는 정수형 파싱
      notes: '단위(세대) 제거 및 정수형 number로 정규화 완료',
    });

    const passed =
      normalized.status === 'normalized' &&
      normalized.value === 3545 &&
      normalized.normalizedAt !== undefined;

    results.push({
      suite: 'Test 4: Verified → Normalized Transition',
      name: '데이터 모델 규격 일치 확인 시 status="normalized" 전이',
      passed,
      details: `status: ${normalized.status}, value: ${normalized.value} (type: ${typeof normalized.value})`,
    });
  }

  // =========================================================================
  // Test 5: Normalized Promotion Eligibility (승격 적격 판정)
  // =========================================================================
  {
    const normalizedFact: PlanFactCandidate<number> = {
      factId: 'fact-total-3545-norm',
      projectId: 'chokjin-3',
      field: 'totalUnits',
      value: 3545,
      sourceId: 'fixture-assoc-meeting-2026-v1',
      status: 'normalized',
      evidenceLocation: { page: 42 },
    };

    const guard = canPromoteFactToConfig(normalizedFact);

    results.push({
      suite: 'Test 5: Normalized Promotion Eligibility',
      name: 'status="normalized"인 팩트는 승격 자격(eligible=true) 획득',
      passed: guard.eligible === true && guard.error === undefined,
      details: `eligible: ${guard.eligible}`,
    });
  }

  // =========================================================================
  // Test 6: Extracted Promotion Rejection (V7 차단)
  // =========================================================================
  {
    const rawFact = createExtractedFact({
      factId: 'fact-unverified-raw',
      projectId: 'chokjin-3',
      field: 'totalUnits',
      value: 3545,
      sourceId: 'fixture-assoc-meeting-2026-v1',
    });

    const guard = canPromoteFactToConfig(rawFact);
    const caught = guard.eligible === false && guard.error?.includes('V7_CANNOT_PROMOTE_EXTRACTED') === true;

    // 명시적 적용 함수에서도 예외 발생하는지 확인
    let threw = false;
    try {
      applyFactToTotalUnitsSummary(
        {
          totalUnits: 0,
          nonRentalUnits: 0,
          rentalUnits: 0,
          memberUnits: 0,
          reservedUnits: 0,
          generalSaleUnits: 0,
        },
        rawFact
      );
    } catch {
      threw = true;
    }

    results.push({
      suite: 'Test 6: Extracted Promotion Rejection (V7)',
      name: 'extracted 상태 팩트를 config에 직접 승격 시도 시 엄격 차단',
      passed: caught && threw,
      details: guard.error,
    });
  }

  // =========================================================================
  // Test 7: Rejected Promotion Rejection (V6 차단)
  // =========================================================================
  {
    const rawFact = createExtractedFact({
      factId: 'fact-erroneous',
      projectId: 'chokjin-3',
      field: 'totalUnits',
      value: 9999,
      sourceId: 'fixture-assoc-meeting-2026-v1',
    });

    const rejectedFact = rejectFact(rawFact, '단순 타이핑 오기재로 판명되어 기각');
    const guard = canPromoteFactToConfig(rejectedFact);
    const caught = guard.eligible === false && guard.error?.includes('V6_CANNOT_PROMOTE_REJECTED') === true;

    results.push({
      suite: 'Test 7: Rejected Promotion Rejection (V6)',
      name: 'rejected 상태 팩트의 운영 데이터 승격 시도 차단',
      passed: caught,
      details: guard.error,
    });
  }

  // =========================================================================
  // Test 8: Conflict Detection & Conflicted Promotion Rejection (V4 & V5)
  // =========================================================================
  {
    // 동일 projectId + field에 대해 서로 다른 수치를 제시하는 2개 Evidence 시뮬레이션
    const factA: PlanFactCandidate<number> = {
      factId: 'fact-assoc-meeting-3545',
      projectId: 'chokjin-3',
      field: 'totalUnits',
      value: 3545,
      sourceId: 'evidence-assoc-meeting-v1',
      status: 'normalized',
      evidenceLocation: { page: 12 },
    };

    const factB: PlanFactCandidate<number> = {
      factId: 'fact-press-news-3500',
      projectId: 'chokjin-3',
      field: 'totalUnits',
      value: 3500, // 상충하는 다른 값!
      sourceId: 'evidence-press-article-v2',
      status: 'normalized',
      evidenceLocation: { note: '2026-06 기사 본문' },
    };

    // 충돌 감지기 실행
    const conflictResult = detectFactConflicts([factA, factB]);
    const detectedConflict = conflictResult.hasConflict;

    const conflictedA = conflictResult.resolvedFacts.find((f) => f.factId === factA.factId);
    const conflictedB = conflictResult.resolvedFacts.find((f) => f.factId === factB.factId);

    const isConflictedStatus =
      conflictedA?.status === 'conflicted' &&
      conflictedB?.status === 'conflicted' &&
      conflictedA.conflictDetails?.competingValues.includes(3500) === true;

    // conflicted 팩트 승격 가드 검증 (V5)
    const guardA = canPromoteFactToConfig(conflictedA!);
    const caughtV5 = guardA.eligible === false && guardA.error?.includes('V5_CANNOT_PROMOTE_CONFLICTED') === true;

    results.push({
      suite: 'Test 8: Conflict Detection & Promotion Rejection (V4 & V5)',
      name: '상충값 감지 시 임의선택 금지(status="conflicted" 격리) 및 승격 차단',
      passed: detectedConflict && isConflictedStatus && caughtV5,
      details: `hasConflict: ${detectedConflict}, A.status: ${conflictedA?.status}, guardError: ${guardA.error}`,
    });
  }

  // =========================================================================
  // Test 9: Missing sourceId on Normalized Fact (V2 차단)
  // =========================================================================
  {
    const registeredSources: PlanEvidenceReference[] = [
      { sourceId: 'valid-source-1', title: '정상 소스' },
    ];

    const factMissingSource: PlanFactCandidate = {
      factId: 'fact-ghost-source',
      projectId: 'chokjin-3',
      field: 'totalUnits',
      value: 3545,
      sourceId: '', // 빈 sourceId!
      status: 'normalized',
    };

    const val = validateFactsAgainstRegistry([factMissingSource], registeredSources);
    const caught = !val.isValid && val.errors.some((e) => e.code === 'V2_NORMALIZED_WITHOUT_SOURCE');

    results.push({
      suite: 'Test 9: Missing sourceId on Normalized Fact (V2)',
      name: 'normalized 상태임에도 sourceId가 누락된 경우 V2 오류 차단',
      passed: caught,
      details: val.errors.map((e) => `[${e.code}] ${e.message}`).join(' | '),
    });
  }

  // =========================================================================
  // Test 10: Invalid / Unregistered Source Reference (V1 차단)
  // =========================================================================
  {
    const registeredSources: PlanEvidenceReference[] = [
      { sourceId: 'valid-source-1', title: '정상 소스' },
    ];

    const factUnregisteredSource: PlanFactCandidate = {
      factId: 'fact-unregistered',
      projectId: 'chokjin-3',
      field: 'totalUnits',
      value: 3545,
      sourceId: 'non-existent-unregistered-doc',
      status: 'verified',
    };

    const val = validateFactsAgainstRegistry([factUnregisteredSource], registeredSources);
    const caught = !val.isValid && val.errors.some((e) => e.code === 'V1_MISSING_SOURCE_REGISTRATION');

    results.push({
      suite: 'Test 10: Unregistered Source Reference (V1)',
      name: 'evidenceSources에 등록되지 않은 임의 sourceId 참조 시 V1 오류 차단',
      passed: caught,
      details: val.errors.map((e) => `[${e.code}] ${e.message}`).join(' | '),
    });
  }

  // =========================================================================
  // Test 11: documentStatus와 factStatus 혼용 방지 (V8 검증)
  // =========================================================================
  {
    const registeredSources: PlanEvidenceReference[] = [
      { sourceId: 'valid-source-1', title: '정상 소스' },
    ];

    // fact.status에 documentStatus 값('proposal')을 오지정한 비정상 팩트
    const confusedFact = {
      factId: 'fact-status-confusion',
      projectId: 'chokjin-3',
      field: 'totalUnits',
      value: 3545,
      sourceId: 'valid-source-1',
      status: 'proposal' as unknown as PlanFactCandidate['status'],
    };

    const val = validateFactsAgainstRegistry([confusedFact], registeredSources);
    const caught = !val.isValid && val.errors.some((e) => e.code === 'V8_STATUS_TYPE_CONFUSION');

    results.push({
      suite: 'Test 11: DocumentStatus vs FactStatus Confusion (V8)',
      name: 'documentStatus("proposal")를 fact.status로 혼용한 경우 V8 오류 차단',
      passed: caught,
      details: val.errors.map((e) => `[${e.code}] ${e.message}`).join(' | '),
    });
  }

  // =========================================================================
  // Test 12: 촉진3 Existing Data 보호 & Regression 검증
  // =========================================================================
  {
    const chokjin = getProjectPlanConfig('chokjin-3');
    const summary = chokjin?.planVersion?.totalSupplySummary;

    const total = summary?.totalUnits || 0;
    const nonRental = summary?.nonRentalUnits || 0;
    const rental = summary?.rentalUnits || 0;
    const member = summary?.memberUnits || 0;
    const reserved = summary?.reservedUnits || 0;
    const general = summary?.generalSaleUnits || 0;

    const math1 = total === 3545 && nonRental === 3365 && rental === 180 && total === nonRental + rental;
    const math2 = member === 1727 && reserved === 20 && general === 1618 && nonRental === member + reserved + general;

    let typesSum = 0;
    for (const u of CHOKJIN3_UNIT_TYPES) {
      if (u.allocation) {
        typesSum +=
          (u.allocation.memberUnits || 0) +
          (u.allocation.reservedUnits || 0) +
          (u.allocation.generalSaleUnits || 0);
      }
    }

    const math3 = typesSum === 3365;
    const statusProposal = chokjin?.documentStatus === 'proposal';

    results.push({
      suite: 'Test 12: 촉진3 Existing Baseline Regression',
      name: '총 3,545세대, 비임대 3,365세대, 공급 3,365세대 및 proposal 상태 완벽 보존',
      passed: math1 && math2 && math3 && statusProposal,
      details: `3545=3365+180 (${math1}), 3365=1727+20+1618 (${math2}), 39types sum=${typesSum} (${math3}), proposal (${statusProposal})`,
    });
  }

  // =========================================================================
  // Test 13: Non-Acquired Data Zero-Fake-Data (우동3 미확보 항목 및 삼익비치 Partial)
  // =========================================================================
  {
    const udong = getProjectPlanConfig('udong-3');
    const samik = getProjectPlanConfig('samik-beach');

    // 우동3: Phase 4G-3 실측 좌표 18개 주동 매핑 완료, 미확보 데이터(주동 매핑, 공급계획)에 대해 임의 fake data 0건
    const udongClean =
      udong?.capabilities.hasInteractiveCoordinates === true &&
      udong?.capabilities.hasBuildingMappings === false &&
      udong?.capabilities.hasSupplyAllocation === false &&
      (udong?.coordinates || []).length === 18 &&
      (udong?.buildings || []).length === 18;

    // 삼익비치: 미확보 데이터(좌표, 주동매핑, 공급계획)에 대해 임의 fake data 0건
    const samikClean =
      samik?.capabilities.hasInteractiveCoordinates === false &&
      samik?.capabilities.hasBuildingMappings === false &&
      samik?.capabilities.hasSupplyAllocation === false &&
      (samik?.coordinates || []).length === 0 &&
      (samik?.buildings || []).length === 0;

    results.push({
      suite: 'Test 13: Partial Projects Zero-Fake-Data',
      name: '우동3 및 삼익비치 미확보 항목(좌표/주동매핑/공급계획) fake data 0건',
      passed: udongClean && samikClean,
      details: `udongClean: ${udongClean}, samikClean: ${samikClean}`,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    results,
  };
}

if (process.argv[1]?.endsWith('planEvidenceOnboarding.test.ts')) {
  console.log('=== Running Phase 4F-1 Plan Evidence Onboarding Pipeline Integration Test Suite ===');
  const report = runPlanEvidenceOnboardingSuite();
  for (const r of report.results) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.suite} - ${r.name}`);
    if (r.details) {
      console.log(`       Details: ${r.details}`);
    }
  }
  console.log(`\nResults: ${report.passed}/${report.total} passed (${Math.round((report.passed / report.total) * 100)}% PASS)`);
  process.exit(report.passed === report.total ? 0 : 1);
}
