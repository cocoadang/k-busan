/**
 * Phase 4E-7: Plan Engine Evidence Integrity Integration Test Suite
 * 
 * 검증 항목:
 * 1. Evidence reference validation (유효한 원천 근거 등록 및 매핑)
 * 2. Unresolved sourceId detection (Case E: 등록되지 않은 sourceId 참조 시 invalid 감지)
 * 3. Document status (proposal, approved, confirmed, historical, unknown)
 * 4. Data availability status (source_not_available, source_available, normalized)
 * 5. Capability vs Availability contradiction (Case A: hasSitePlan=true & availability='source_not_available' -> invalid)
 * 6. chokjin-3 proposal preservation (조합 제안안 기준 유지, 확정/인가 승격 차단)
 * 7. Source -> ProjectPlanConfig traceability (총 3,545세대의 원천 Evidence 역추적)
 * 8. Missing Evidence graceful handling (부분 자료 사업지 정상 허용)
 * 9. Partial Project compatibility (우동3, 삼익비치 source_not_available 무결성)
 * 10. 산술 Regression (총 3,545 = 3,365 + 180, 조합원 1,727 + 보류지 20 + 일반분양 1,618 = 3,365)
 */

import {
  ProjectPlanConfig,
  validateProjectPlanConfig,
  PlanEvidenceReference,
} from '../types/planConfig.ts';
import {
  getProjectPlanConfig,
  getAllProjectPlanConfigs,
} from '../data/projects/planRegistry.ts';
import { CHOKJIN3_UNIT_TYPES } from '../data/chokjin3PlanData.ts';

export interface EvidenceTestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

export function runPlanEvidenceIntegritySuite(): {
  total: number;
  passed: number;
  results: EvidenceTestResult[];
} {
  const results: EvidenceTestResult[] = [];

  // =========================================================================
  // Test 1: 촉진3 Evidence Reference 구조 및 등록 검증
  // =========================================================================
  {
    const chokjin = getProjectPlanConfig('chokjin-3');
    const sources = chokjin?.evidenceSources || [];

    const hasPlanDocSource = sources.some(
      (s) =>
        s.sourceId === 'chokjin-3-assoc-plan-v1' &&
        s.sourceType === 'association' &&
        s.documentStatus === 'proposal'
    );
    const hasSiteLayoutSource = sources.some(
      (s) =>
        s.sourceId === 'chokjin-3-assoc-site-layout-v1' &&
        s.sourceType === 'association' &&
        s.documentStatus === 'proposal'
    );

    results.push({
      suite: 'Test 1: Evidence Reference 구조',
      name: '촉진3 원천 근거 자료 2건(도면집, 배치도) 정식 등록',
      passed: sources.length >= 2 && hasPlanDocSource && hasSiteLayoutSource,
      details: `registered sources: ${sources.map((s) => s.sourceId).join(', ')}`,
    });
  }

  // =========================================================================
  // Test 2: Unresolved sourceId Detection (Case E)
  // =========================================================================
  {
    const baseConfig = getProjectPlanConfig('chokjin-3');
    if (baseConfig) {
      // Create a corrupted config referencing a non-existent sourceId
      const corruptedConfig: ProjectPlanConfig = {
        ...baseConfig,
        planVersion: {
          ...baseConfig.planVersion!,
          evidenceSourceId: 'non-existent-ghost-document-source-999',
        },
      };

      const val = validateProjectPlanConfig(corruptedConfig);
      const caught = !val.isValid && val.errors.some((e) => e.includes('non-existent-ghost-document-source-999'));

      results.push({
        suite: 'Test 2: Case E Unresolved sourceId Detection',
        name: '미등록 sourceId 참조 시 invalid 감지 및 오류 메시지 산출',
        passed: caught,
        details: val.errors.filter((e) => e.includes('sourceId')).join(' | '),
      });
    }
  }

  // =========================================================================
  // Test 3: Document Status 구현 및 촉진3 proposal 유지 검증
  // =========================================================================
  {
    const chokjin = getProjectPlanConfig('chokjin-3');
    const isProposal = chokjin?.documentStatus === 'proposal';
    const planVersionStatus = chokjin?.planVersion?.confirmationStatus === 'proposal';

    results.push({
      suite: 'Test 3: Document Status',
      name: '촉진3 documentStatus = "proposal" 유지 (확정안 승격 금지)',
      passed: isProposal && planVersionStatus,
      details: `config.documentStatus: ${chokjin?.documentStatus}, planVersion: ${chokjin?.planVersion?.confirmationStatus}`,
    });
  }

  // =========================================================================
  // Test 4: Data Availability Status 실제 구현 검증
  // =========================================================================
  {
    const chokjin = getProjectPlanConfig('chokjin-3');
    const udong = getProjectPlanConfig('udong-3');
    const samik = getProjectPlanConfig('samik-beach');

    const chokjinNormalized =
      chokjin?.availability?.sitePlan === 'normalized' &&
      chokjin?.availability?.unitPlans === 'normalized' &&
      chokjin?.availability?.buildingMappings === 'normalized' &&
      chokjin?.availability?.supplyAllocation === 'normalized' &&
      chokjin?.availability?.unitComparison === 'normalized';

    const udongAvailability =
      udong?.availability?.sitePlan === 'normalized' &&
      udong?.availability?.unitPlans === 'normalized' &&
      udong?.availability?.buildingMappings === 'normalized' &&
      udong?.availability?.supplyAllocation === 'normalized';

    const samikAvailability =
      samik?.availability?.sitePlan === 'normalized' &&
      samik?.availability?.unitPlans === 'normalized' &&
      samik?.availability?.buildingMappings === 'normalized' &&
      samik?.availability?.supplyAllocation === 'source_not_available';

    results.push({
      suite: 'Test 4: Data Availability Status',
      name: '촉진3(전체 normalized), 우동3(공급계획/동매핑 포함 normalized), 삼익비치(동매핑 normalized, 공급계획 미확보) 명시적 구분',
      passed: chokjinNormalized && udongAvailability && samikAvailability,
      details: `chokjin: ${chokjin?.availability?.supplyAllocation}, udong: ${udong?.availability?.supplyAllocation}, samik: ${samik?.availability?.supplyAllocation}`,
    });
  }

  // =========================================================================
  // Test 5: Capability vs Availability Contradiction (Case A)
  // =========================================================================
  {
    const contradictionConfig: ProjectPlanConfig = {
      projectId: 'contradiction-project',
      projectName: '모순 프로젝트',
      capabilities: {
        hasSitePlan: true, // UI 기능 제공 선언
        hasInteractiveCoordinates: false,
        hasUnitPlans: false,
        hasBuildingMappings: false,
        hasSupplyAllocation: false,
        hasUnitComparison: false,
      },
      availability: {
        sitePlan: 'source_not_available', // 그러나 원본 자료 미확보! (모순)
        unitPlans: 'source_not_available',
        buildingMappings: 'source_not_available',
        supplyAllocation: 'source_not_available',
        unitComparison: 'source_not_available',
      },
      sitePlan: {
        sitePlanId: 'mock-site',
        projectId: 'contradiction-project',
        assetPath: '/assets/mock.jpg',
        sourceType: 'association',
        confirmationStatus: 'proposal',
        verificationStatus: 'unverified',
        isCurrentKnownVersion: true,
        title: 'mock',
        versionNotice: 'mock',
        totalBuildingsCount: 1,
        totalUnitTypesMapped: 1,
        uploadedAt: '2026-01-01',
        verifiedAt: '2026-01-01',
      },
      evidenceSources: [],
    };

    const val = validateProjectPlanConfig(contradictionConfig);
    const caught =
      !val.isValid &&
      val.errors.some((e) => e.includes('hasSitePlan=true이나 sitePlan availability가 "source_not_available"'));

    results.push({
      suite: 'Test 5: Capability vs Availability Contradiction (Case A)',
      name: 'hasSitePlan=true & sitePlan="source_not_available" 논리적 모순 감지',
      passed: caught,
      details: val.errors.join(' | '),
    });
  }

  // =========================================================================
  // Test 6: Source Available vs Capability=false (정상 허용 케이스)
  // =========================================================================
  {
    // 원본은 확보했으나 아직 인터랙티브 서비스로 정규화되지 않은 상태 -> 정상이어야 함
    const rawAcquiredConfig: ProjectPlanConfig = {
      projectId: 'raw-acquired-project',
      projectName: '원본확보 프로젝트',
      capabilities: {
        hasSitePlan: false, // 아직 기능 미제공
        hasInteractiveCoordinates: false,
        hasUnitPlans: false,
        hasBuildingMappings: false,
        hasSupplyAllocation: false,
        hasUnitComparison: false,
      },
      availability: {
        sitePlan: 'source_available', // 원본 확보 완료
        unitPlans: 'source_available',
        buildingMappings: 'source_not_available',
        supplyAllocation: 'source_not_available',
        unitComparison: 'source_not_available',
      },
      evidenceSources: [
        {
          sourceId: 'raw-doc-1',
          title: '입수한 조합 임시 배치도',
          documentStatus: 'proposal',
        },
      ],
    };

    const val = validateProjectPlanConfig(rawAcquiredConfig);

    results.push({
      suite: 'Test 6: Raw Available without Capability',
      name: 'hasSitePlan=false & sitePlan="source_available" (정규화 전 단계) 정상 허용',
      passed: val.isValid && val.errors.length === 0,
      details: `isValid: ${val.isValid}, errors: ${val.errors.length}`,
    });
  }

  // =========================================================================
  // Test 7: Source → UI Traceability (총 세대수 3,545세대 역추적)
  // =========================================================================
  {
    const chokjin = getProjectPlanConfig('chokjin-3');
    const summary = chokjin?.planVersion?.totalSupplySummary;

    // 1. 값 확인
    const totalUnits = summary?.totalUnits;
    const is3545 = totalUnits === 3545;

    // 2. Evidence 참조 확인
    const evidenceRef = summary?.evidenceSourceId;
    const resolvedEvidence = chokjin?.evidenceSources?.find(
      (s) => s.sourceId === evidenceRef
    );

    const isTraceable =
      is3545 &&
      evidenceRef === 'chokjin-3-assoc-plan-v1' &&
      resolvedEvidence !== undefined &&
      resolvedEvidence.title === '시민공원주변 촉진3구역 조합원 총회 및 조합 배포자료' &&
      resolvedEvidence.issuer === '시민공원주변 촉진3구역 주택재개발정비사업조합' &&
      resolvedEvidence.documentStatus === 'proposal';

    results.push({
      suite: 'Test 7: Source → UI Traceability',
      name: '총 3,545세대 값이 "chokjin-3-assoc-plan-v1" Evidence 객체로 역추적 확인',
      passed: isTraceable,
      details: `totalUnits(${totalUnits}) -> ref(${evidenceRef}) -> title: "${resolvedEvidence?.title}", status: ${resolvedEvidence?.documentStatus}`,
    });
  }

  // =========================================================================
  // Test 8: Partial Project 무결성 (우동3구역, 삼익비치)
  // =========================================================================
  {
    const udong = getProjectPlanConfig('udong-3');
    const samik = getProjectPlanConfig('samik-beach');

    const udongVal = validateProjectPlanConfig(udong!);
    const samikVal = validateProjectPlanConfig(samik!);

    const passed =
      udongVal.isValid &&
      udongVal.errors.length === 0 &&
      samikVal.isValid &&
      samikVal.errors.length === 0;

    results.push({
      suite: 'Test 8: Partial Project 무결성',
      name: '우동3, 삼익비치 source_not_available 상태에서 config 유효성 100% 통과',
      passed,
      details: `udong errors: ${udongVal.errors.length}, samik errors: ${samikVal.errors.length}`,
    });
  }

  // =========================================================================
  // Test 9: 산술 Regression (촉진3 3,545 = 3,365 + 180, 공급합계 3,365)
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

    results.push({
      suite: 'Test 9: 촉진3 산술 Regression',
      name: '총 3,545세대, 비임대 3,365세대, 공급합계 3,365세대 정확성 불변',
      passed: math1 && math2 && math3,
      details: `3545=3365+180 (${math1}), 3365=1727+20+1618 (${math2}), 39types sum=${typesSum} (${math3})`,
    });
  }

  // =========================================================================
  // Test 10: 전체 등록 프로젝트 검증
  // =========================================================================
  {
    const allConfigs = getAllProjectPlanConfigs();
    let allValid = true;
    const failureMessages: string[] = [];

    for (const config of allConfigs) {
      const val = validateProjectPlanConfig(config);
      if (!val.isValid) {
        allValid = false;
        failureMessages.push(`${config.projectId}: ${val.errors.join(', ')}`);
      }
    }

    results.push({
      suite: 'Test 10: 전체 Production Config 종합 유효성',
      name: '등록된 모든 사업지 config 검증 오류 0건',
      passed: allValid,
      details: allValid ? 'All 3 configs 100% valid' : failureMessages.join('; '),
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    results,
  };
}

if (process.argv[1]?.endsWith('planEvidenceIntegrity.test.ts')) {
  console.log('=== Running Phase 4E-7 Plan Evidence Integrity Integration Test Suite ===');
  const report = runPlanEvidenceIntegritySuite();
  for (const r of report.results) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.suite} - ${r.name}`);
    if (r.details) {
      console.log(`       Details: ${r.details}`);
    }
  }
  console.log(`\nResults: ${report.passed}/${report.total} passed (${Math.round((report.passed / report.total) * 100)}% PASS)`);
  process.exit(report.passed === report.total ? 0 : 1);
}
