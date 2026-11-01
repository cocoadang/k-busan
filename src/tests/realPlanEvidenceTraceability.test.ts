/**
 * Phase 4F-2: Real Plan Evidence Ingestion & End-to-End Traceability Test Suite
 *
 * 검증 시나리오 (Section 24):
 * 1. 실제 asset 존재 (public/assets/plans/chokjin3/84a1.jfif 파일시스템 실재 확인)
 * 2. sourceId 연결 (chokjin-3-assoc-plan-v1 등록 및 연결)
 * 3. EvidenceLocation assetPath 연결 (assetPath, fileName 매핑 확인)
 * 4. 실제 Fact extracted (초기 추출 팩트 생성)
 * 5. extracted → verified (실물 대조 검증 상태 전이)
 * 6. verified → normalized (데이터 규격 정규화 전이)
 * 7. canonical field mapping (typeCode, units 표준 필드 매핑)
 * 8. Existing Data MATCH 또는 CONFLICT 판정 (84A1 MATCH 및 상충 시 자동수정 차단 검증)
 * 9. metadata unverified 유지 (asset=verified, metadata=unverified 분리)
 * 10. documentStatus proposal 유지 (제안안 상태 불변)
 * 11. premature promotion 차단 유지 (extracted/conflicted 승격 방어)
 * 12. 기존 4F-1 테스트 regression (13/13 PASS)
 * 13. 기존 Multi-Project regression (44/44 PASS)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getProjectPlanConfig,
} from '../data/projects/planRegistry.ts';
import { CHOKJIN3_UNIT_TYPES } from '../data/chokjin3PlanData.ts';
import {
  REAL_PLAN_EVIDENCE_MANIFEST,
  compareRealFactWithCanonicalData,
} from '../pipeline/realEvidenceManifest.ts';
import {
  createExtractedFact,
  verifyFact,
  normalizeFact,
  canPromoteFactToConfig,
} from '../pipeline/planEvidencePipeline.ts';
import { runPlanEvidenceOnboardingSuite } from './planEvidenceOnboarding.test.ts';
import { runPlanEvidenceIntegritySuite } from './planEvidenceIntegrity.test.ts';
import { runMultiProjectPlanEngineAudit } from './multiProjectPlanEngine.test.ts';
import { runPlanConfigValidationAudit } from './planConfigValidation.test.ts';

export interface TraceabilityTestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

export function runRealPlanEvidenceTraceabilitySuite(): {
  total: number;
  passed: number;
  results: TraceabilityTestResult[];
} {
  const results: TraceabilityTestResult[] = [];

  // =========================================================================
  // Scenario 1: 실제 Asset 존재 확인 (Filesystem 실재성)
  // =========================================================================
  {
    const realFilePath = path.resolve(process.cwd(), 'public/assets/plans/chokjin3/84a1.jfif');
    const fileExists = fs.existsSync(realFilePath);
    let fileSize = 0;
    if (fileExists) {
      const stats = fs.statSync(realFilePath);
      fileSize = stats.size;
    }

    const passed = fileExists && fileSize > 100000; // 508,534 bytes 실제 JFIF 파일

    results.push({
      suite: 'Scenario 1: 실제 Asset 존재 확인',
      name: 'public/assets/plans/chokjin3/84a1.jfif 실물 파일 존재 및 유효 크기 확인',
      passed,
      details: `exists: ${fileExists}, size: ${fileSize} bytes`,
    });
  }

  // =========================================================================
  // Scenario 2: sourceId 연결 확인
  // =========================================================================
  {
    const config = getProjectPlanConfig('chokjin-3');
    const planSource = config?.evidenceSources?.find((s) => s.sourceId === 'chokjin-3-assoc-plan-v1');

    const passed =
      planSource !== undefined &&
      planSource.sourceId === 'chokjin-3-assoc-plan-v1' &&
      planSource.title?.includes('촉진3구역') === true;

    results.push({
      suite: 'Scenario 2: sourceId 연결 확인',
      name: 'ProjectPlanConfig에 "chokjin-3-assoc-plan-v1" Evidence 객체 등록 확인',
      passed,
      details: `sourceId: ${planSource?.sourceId}, title: "${planSource?.title}"`,
    });
  }

  // =========================================================================
  // Scenario 3: EvidenceLocation assetPath 연결 확인
  // =========================================================================
  {
    const manifestItem = REAL_PLAN_EVIDENCE_MANIFEST.find(
      (m) => m.fileName === '84a1.jfif' && m.sourceId === 'chokjin-3-assoc-plan-v1'
    );

    const factWithLocation = manifestItem?.facts.find((f) => f.field === 'unitType');
    const loc = factWithLocation?.evidenceLocation;

    const passed =
      loc !== undefined &&
      loc.assetPath === '/assets/plans/chokjin3/84a1.jfif' &&
      loc.fileName === '84a1.jfif' &&
      loc.note !== undefined;

    results.push({
      suite: 'Scenario 3: EvidenceLocation assetPath 연결',
      name: 'Fact Candidate의 EvidenceLocation에 assetPath 및 fileName 바인딩 확인',
      passed,
      details: `assetPath: ${loc?.assetPath}, fileName: ${loc?.fileName}`,
    });
  }

  // =========================================================================
  // Scenario 4: 실제 Fact extracted (초기 추출)
  // =========================================================================
  {
    const rawFact = createExtractedFact({
      factId: 'fact-test-raw-84a1',
      projectId: 'chokjin-3',
      field: 'unitType',
      value: '84A1',
      sourceId: 'chokjin-3-assoc-plan-v1',
      evidenceLocation: {
        assetPath: '/assets/plans/chokjin3/84a1.jfif',
        fileName: '84a1.jfif',
      },
    });

    const passed =
      rawFact.status === 'extracted' &&
      rawFact.value === '84A1' &&
      rawFact.extractedAt !== undefined;

    results.push({
      suite: 'Scenario 4: 실제 Fact extracted',
      name: 'status="extracted"로 원시 사실 생성 완료',
      passed,
      details: `status: ${rawFact.status}, value: ${rawFact.value}`,
    });
  }

  // =========================================================================
  // Scenario 5: extracted → verified 전이
  // =========================================================================
  {
    const rawFact = createExtractedFact({
      factId: 'fact-test-raw-84a1-units',
      projectId: 'chokjin-3',
      field: 'unitCount',
      value: '232세대',
      sourceId: 'chokjin-3-assoc-plan-v1',
      evidenceLocation: {
        assetPath: '/assets/plans/chokjin3/84a1.jfif',
        fileName: '84a1.jfif',
      },
    });

    const verifiedFact = verifyFact(rawFact, {
      verifiedBy: 'plan-engine-auditor',
      notes: '84a1.jfif 이미지 상단 232세대 텍스트 육안 대조 완료',
    });

    const passed =
      verifiedFact.status === 'verified' &&
      verifiedFact.verifiedAt !== undefined &&
      verifiedFact.verificationNote?.includes('232세대') === true;

    results.push({
      suite: 'Scenario 5: extracted → verified 전이',
      name: '실물 원본 대조 확인 시 status="verified"로 정상 전이',
      passed,
      details: `status: ${verifiedFact.status}, verifiedAt: ${verifiedFact.verifiedAt}`,
    });
  }

  // =========================================================================
  // Scenario 6: verified → normalized 전이
  // =========================================================================
  {
    const rawFact = createExtractedFact({
      factId: 'fact-test-raw-84a1-units',
      projectId: 'chokjin-3',
      field: 'unitCount',
      value: '232세대',
      sourceId: 'chokjin-3-assoc-plan-v1',
    });
    const verifiedFact = verifyFact(rawFact, { notes: '대조 확인' });
    const normalizedFact = normalizeFact<string, number>(verifiedFact, {
      normalizedValue: 232,
      notes: '단위 제거 후 정수 232로 정규화',
    });

    const passed =
      normalizedFact.status === 'normalized' &&
      normalizedFact.value === 232 &&
      typeof normalizedFact.value === 'number';

    results.push({
      suite: 'Scenario 6: verified → normalized 전이',
      name: '데이터 모델 정합성 검증 완료 시 status="normalized"로 정상 전이',
      passed,
      details: `status: ${normalizedFact.status}, value: ${normalizedFact.value} (${typeof normalizedFact.value})`,
    });
  }

  // =========================================================================
  // Scenario 7: Canonical field mapping (typeCode & units)
  // =========================================================================
  {
    const existing84A1 = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '84A1');
    const manifestItem = REAL_PLAN_EVIDENCE_MANIFEST[0];
    const factType = manifestItem.facts.find((f) => f.field === 'unitType');
    const factUnits = manifestItem.facts.find((f) => f.field === 'unitCount');

    const typeCodeMapped = factType?.value === existing84A1?.typeCode;
    const unitsMapped = factUnits?.value === existing84A1?.units;

    const passed = typeCodeMapped && unitsMapped;

    results.push({
      suite: 'Scenario 7: Canonical field mapping',
      name: '정규화된 Fact가 Canonical 필드(typeCode, units)에 정확히 대응',
      passed,
      details: `typeCodeMapped: ${typeCodeMapped}, unitsMapped: ${unitsMapped}`,
    });
  }

  // =========================================================================
  // Scenario 8: Existing Data MATCH 또는 CONFLICT 판정
  // =========================================================================
  {
    const existing84A1 = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '84A1');
    const manifestItem = REAL_PLAN_EVIDENCE_MANIFEST[0];
    const factType = manifestItem.facts.find((f) => f.field === 'unitType')!;
    const factUnits = manifestItem.facts.find((f) => f.field === 'unitCount')!;

    // 1. 정상 일치 비교 (MATCH)
    const reportType = compareRealFactWithCanonicalData(factType, existing84A1?.typeCode);
    const reportUnits = compareRealFactWithCanonicalData(factUnits, existing84A1?.units);

    // 2. 가상 상충 비교 (CONFLICT 시뮬레이션): 만약 250세대였다면 CONFLICT 보고 및 자동수정 차단
    const conflictMockFact = { ...factUnits, value: 250 };
    const reportConflict = compareRealFactWithCanonicalData(conflictMockFact, existing84A1?.units);

    const passed =
      reportType.result === 'MATCH' &&
      reportUnits.result === 'MATCH' &&
      reportConflict.result === 'CONFLICT';

    results.push({
      suite: 'Scenario 8: Existing Data MATCH & CONFLICT 판정',
      name: '실제 84A1 데이터 MATCH 확인 및 불일치 시 자동수정 차단(CONFLICT) 검증',
      passed,
      details: `Type: ${reportType.result}, Units: ${reportUnits.result}, ConflictMock: ${reportConflict.result}`,
    });
  }

  // =========================================================================
  // Scenario 9: Metadata unverified 유지 (Asset vs Metadata 분리)
  // =========================================================================
  {
    const config = getProjectPlanConfig('chokjin-3');
    const planSource = config?.evidenceSources?.find((s) => s.sourceId === 'chokjin-3-assoc-plan-v1');

    const assetVerified = planSource?.assetVerificationStatus === 'verified';
    const metadataUnverified = planSource?.metadataVerificationStatus === 'unverified';
    const overallUnverified = planSource?.verificationStatus === 'unverified';

    const passed = assetVerified && metadataUnverified && overallUnverified;

    results.push({
      suite: 'Scenario 9: Metadata unverified 유지',
      name: '실물 파일 실재(asset=verified)와 공문 메타데이터(metadata=unverified) 엄격 분리',
      passed,
      details: `asset: ${planSource?.assetVerificationStatus}, metadata: ${planSource?.metadataVerificationStatus}, overall: ${planSource?.verificationStatus}`,
    });
  }

  // =========================================================================
  // Scenario 10: documentStatus proposal 유지
  // =========================================================================
  {
    const config = getProjectPlanConfig('chokjin-3');
    const planSource = config?.evidenceSources?.find((s) => s.sourceId === 'chokjin-3-assoc-plan-v1');
    const manifestItem = REAL_PLAN_EVIDENCE_MANIFEST[0];

    const configProposal = config?.documentStatus === 'proposal';
    const sourceProposal = planSource?.documentStatus === 'proposal';
    const manifestProposal = manifestItem.documentStatus === 'proposal';

    const passed = configProposal && sourceProposal && manifestProposal;

    results.push({
      suite: 'Scenario 10: documentStatus proposal 유지',
      name: '사업계획 상태가 인가/확정으로 임의 승격되지 않고 proposal 유지',
      passed,
      details: `config: ${config?.documentStatus}, source: ${planSource?.documentStatus}, manifest: ${manifestItem.documentStatus}`,
    });
  }

  // =========================================================================
  // Scenario 11: Premature Promotion 방어 유지
  // =========================================================================
  {
    const rawFact = createExtractedFact({
      factId: 'fact-premature',
      projectId: 'chokjin-3',
      field: 'unitCount',
      value: 232,
      sourceId: 'chokjin-3-assoc-plan-v1',
    });

    const guard = canPromoteFactToConfig(rawFact);
    const caught = guard.eligible === false && guard.error?.includes('V7_CANNOT_PROMOTE_EXTRACTED') === true;

    results.push({
      suite: 'Scenario 11: Premature Promotion 방어',
      name: 'extracted 상태 팩트의 운영 데이터 승격 시도 엄격 차단',
      passed: caught,
      details: guard.error,
    });
  }

  // =========================================================================
  // Scenario 12: 기존 4F-1 테스트 Regression 검증
  // =========================================================================
  {
    const report4F1 = runPlanEvidenceOnboardingSuite();
    const passed = report4F1.passed === report4F1.total && report4F1.total === 13;

    results.push({
      suite: 'Scenario 12: 기존 4F-1 테스트 Regression',
      name: 'Phase 4F-1 온보딩 테스트 13개 시나리오 100% PASS',
      passed,
      details: `${report4F1.passed}/${report4F1.total} passed`,
    });
  }

  // =========================================================================
  // Scenario 13: 기존 Multi-Project Regression 검증
  // =========================================================================
  {
    const reportIntegrity = runPlanEvidenceIntegritySuite();
    const reportEngine = runMultiProjectPlanEngineAudit();
    const reportValidation = runPlanConfigValidationAudit();

    const allPassed =
      reportIntegrity.passed === reportIntegrity.total &&
      reportEngine.allPassed === true &&
      reportValidation.success === true;

    results.push({
      suite: 'Scenario 13: 기존 Multi-Project Regression',
      name: '기존 무결성, 다중사업지 엔진, 설정 검증 테스트 100% PASS',
      passed: allPassed,
      details: `Integrity: ${reportIntegrity.passed}/${reportIntegrity.total}, Engine: ${reportEngine.passedTests}/${reportEngine.totalTests}, Validation: ${reportValidation.passedScenarios}/${reportValidation.totalScenarios}`,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    results,
  };
}

if (process.argv[1]?.endsWith('realPlanEvidenceTraceability.test.ts')) {
  console.log('=== Running Phase 4F-2 Real Plan Evidence Traceability Test Suite ===');
  const report = runRealPlanEvidenceTraceabilitySuite();
  for (const r of report.results) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.suite} - ${r.name}`);
    if (r.details) {
      console.log(`       Details: ${r.details}`);
    }
  }
  console.log(`\nResults: ${report.passed}/${report.total} passed (${Math.round((report.passed / report.total) * 100)}% PASS)`);
  process.exit(report.passed === report.total ? 0 : 1);
}
