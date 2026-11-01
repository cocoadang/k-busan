import {
  CHOKJIN3_UNIT_TYPES,
  CHOKJIN3_BUILDINGS,
} from '../data/chokjin3PlanData.ts';
import { FirestoreUnitTypeDoc } from '../schema/firestoreSchema.ts';

/**
 * Phase 4D-8 Automated Verification Suite for Unit Type Comparison
 */

export interface ComparisonTestResult {
  scenarioName: string;
  passed: boolean;
  details: string[];
}

export function runUnitTypeComparisonAudit(): {
  success: boolean;
  totalScenarios: number;
  passedScenarios: number;
  results: ComparisonTestResult[];
} {
  const results: ComparisonTestResult[] = [];

  // Helper matching UnitTypeComparison placement metadata logic
  function getPlacement(unit: FirestoreUnitTypeDoc) {
    if (unit.buildingNumbers && unit.buildingNumbers.length > 0) {
      return {
        dongDisplay: unit.buildingNumbers.join(', '),
        statusDisplay: '배치 확인',
        type: 'verified',
      };
    }
    if (unit.candidateBuildingNumbers && unit.candidateBuildingNumbers.length > 0) {
      return {
        dongDisplay: `${unit.candidateBuildingNumbers.join(', ')} 후보`,
        statusDisplay: '후보 · 미확정',
        type: 'candidate',
      };
    }
    return {
      dongDisplay: '세부 배치 확인 필요',
      statusDisplay: '세부 배치 확인 필요',
      type: 'unresolved',
    };
  }

  // Scenario A: 84A1 vs 98C
  {
    const unit84A1 = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '84A1');
    const unit98C = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '98C');
    const details: string[] = [];
    let passed = true;

    if (!unit84A1 || !unit98C) {
      passed = false;
      details.push('Units 84A1 or 98C not found in SSOT');
    } else {
      const p84A1 = getPlacement(unit84A1);
      const p98C = getPlacement(unit98C);

      // 84A1: Unresolved, 세부 배치 확인 필요
      if (p84A1.statusDisplay !== '세부 배치 확인 필요' || p84A1.dongDisplay !== '세부 배치 확인 필요') {
        passed = false;
        details.push(`84A1 placement failed: status=${p84A1.statusDisplay}, dong=${p84A1.dongDisplay}`);
      } else {
        details.push(`84A1 unresolved status correctly displayed: "${p84A1.statusDisplay}"`);
      }

      // 98C: Verified, 105동, 109동, 112동, 113동
      const expected98CDongs = ['105동', '109동', '112동', '113동'].join(', ');
      if (p98C.statusDisplay !== '배치 확인' || p98C.dongDisplay !== expected98CDongs) {
        passed = false;
        details.push(`98C placement failed: status=${p98C.statusDisplay}, dong=${p98C.dongDisplay}`);
      } else {
        details.push(`98C verified dongs correctly displayed: "${p98C.dongDisplay}"`);
      }

      // 98C General sale units: 24
      if (unit98C.allocation?.generalSaleUnits !== 24) {
        passed = false;
        details.push(`98C general sale units mismatch: expected 24, got ${unit98C.allocation?.generalSaleUnits}`);
      } else {
        details.push(`98C general sale units confirmed: 24세대`);
      }
    }

    results.push({
      scenarioName: 'Scenario A: 84A1 vs 98C (Unresolved vs Verified)',
      passed,
      details,
    });
  }

  // Scenario B: 84T1 vs 84T2
  {
    const unit84T1 = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '84T1');
    const unit84T2 = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '84T2');
    const details: string[] = [];
    let passed = true;

    if (!unit84T1 || !unit84T2) {
      passed = false;
      details.push('Units 84T1 or 84T2 not found in SSOT');
    } else {
      const p84T1 = getPlacement(unit84T1);
      const p84T2 = getPlacement(unit84T2);

      // 84T1: 118-T동 후보 · 미확정
      if (p84T1.statusDisplay !== '후보 · 미확정' || !p84T1.dongDisplay.includes('118-T동')) {
        passed = false;
        details.push(`84T1 candidate failed: status=${p84T1.statusDisplay}, dong=${p84T1.dongDisplay}`);
      } else {
        details.push(`84T1 candidate status confirmed: "${p84T1.dongDisplay}" (${p84T1.statusDisplay})`);
      }

      // 84T2: 117-T동 배치 확인
      if (p84T2.statusDisplay !== '배치 확인' || p84T2.dongDisplay !== '117-T동') {
        passed = false;
        details.push(`84T2 verified failed: status=${p84T2.statusDisplay}, dong=${p84T2.dongDisplay}`);
      } else {
        details.push(`84T2 verified status confirmed: "${p84T2.dongDisplay}" (${p84T2.statusDisplay})`);
      }

      // Both have terrace feature
      const t1Terrace = unit84T1.specialFeatures?.includes('테라스');
      const t2Terrace = unit84T2.specialFeatures?.includes('테라스');
      if (!t1Terrace || !t2Terrace) {
        passed = false;
        details.push(`Terrace feature missing on 84T1 or 84T2: 84T1=${t1Terrace}, 84T2=${t2Terrace}`);
      } else {
        details.push('Both 84T1 and 84T2 confirmed with "테라스" feature');
      }
    }

    results.push({
      scenarioName: 'Scenario B: 84T1 vs 84T2 (Candidate vs Verified Terrace)',
      passed,
      details,
    });
  }

  // Scenario C: 98C vs 114A vs 124A (Supply Plan Facts)
  {
    const unit98C = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '98C');
    const unit114A = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '114A');
    const unit124A = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '124A');
    const details: string[] = [];
    let passed = true;

    if (!unit98C || !unit114A || !unit124A) {
      passed = false;
      details.push('One of 98C, 114A, 124A not found in SSOT');
    } else {
      // 98C: Member 287, Reserved 0, General 24, Total 311
      const a98C = unit98C.allocation;
      if (a98C?.memberUnits !== 287 || a98C?.generalSaleUnits !== 24) {
        passed = false;
        details.push(`98C supply plan mismatch: member=${a98C?.memberUnits}, general=${a98C?.generalSaleUnits}`);
      } else {
        details.push(`98C supply plan: 조합원 287세대, 일반분양 24세대 (총 ${unit98C.units}세대)`);
      }

      // 114A: Member 98, Reserved 0, General 5, Total 103
      const a114A = unit114A.allocation;
      if (a114A?.memberUnits !== 98 || a114A?.generalSaleUnits !== 5) {
        passed = false;
        details.push(`114A supply plan mismatch: member=${a114A?.memberUnits}, general=${a114A?.generalSaleUnits}`);
      } else {
        details.push(`114A supply plan: 조합원 98세대, 일반분양 5세대 (총 ${unit114A.units}세대)`);
      }

      // 124A: Member 43, Reserved 0, General 0, Total 43
      const a124A = unit124A.allocation;
      if (a124A?.memberUnits !== 43 || a124A?.generalSaleUnits !== 0) {
        passed = false;
        details.push(`124A supply plan mismatch: member=${a124A?.memberUnits}, general=${a124A?.generalSaleUnits}`);
      } else {
        details.push(`124A supply plan: 조합원 43세대, 일반분양 0세대 (총 ${unit124A.units}세대, 일반분양 없음 사실 보존)`);
      }
    }

    results.push({
      scenarioName: 'Scenario C: 98C vs 114A vs 124A (Supply Plan Facts)',
      passed,
      details,
    });
  }

  // Scenario D: 98D vs 98T (Duplex 1F/2F Asset Support)
  {
    const unit98D = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '98D');
    const unit98T = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '98T');
    const details: string[] = [];
    let passed = true;

    if (!unit98D || !unit98T) {
      passed = false;
      details.push('Units 98D or 98T not found in SSOT');
    } else {
      const is98DDuplex = !!(unit98D.sourceAsset?.isDuplex || unit98D.sourceAsset?.isMultiLevel);
      const has98D2F = !!(unit98D.sourceAsset?.secondaryAssetPath || unit98D.sourceAsset?.secondaryImageUrl);

      const is98TDuplex = !!(unit98T.sourceAsset?.isDuplex || unit98T.sourceAsset?.isMultiLevel);
      const has98T2F = !!(unit98T.sourceAsset?.secondaryAssetPath || unit98T.sourceAsset?.secondaryImageUrl);

      if (!is98DDuplex || !has98D2F) {
        passed = false;
        details.push(`98D duplex support incomplete: isDuplex=${is98DDuplex}, has2F=${has98D2F}`);
      } else {
        details.push('98D confirmed with duplex flag and 2F floor plan asset');
      }

      if (!is98TDuplex || !has98T2F) {
        passed = false;
        details.push(`98T duplex support incomplete: isDuplex=${is98TDuplex}, has2F=${has98T2F}`);
      } else {
        details.push('98T confirmed with duplex flag and 2F floor plan asset');
      }

      // 98T verified in 116-T동
      if (!unit98T.buildingNumbers?.includes('116-T동')) {
        passed = false;
        details.push(`98T building numbers mismatch: expected 116-T동, got ${unit98T.buildingNumbers?.join(',')}`);
      } else {
        details.push('98T verified building confirmed: 116-T동');
      }
    }

    results.push({
      scenarioName: 'Scenario D: 98D vs 98T (Duplex 1F/2F Support & 116-T동)',
      passed,
      details,
    });
  }

  // Scenario E: SSOT Integrity (39 types, 3,365 non-rental units)
  {
    const totalCount = CHOKJIN3_UNIT_TYPES.length;
    const totalUnits = CHOKJIN3_UNIT_TYPES.reduce((sum, u) => sum + u.units, 0);
    const details: string[] = [];
    let passed = true;

    if (totalCount !== 39) {
      passed = false;
      details.push(`Unit types count mismatch: expected 39, got ${totalCount}`);
    } else {
      details.push('Unit types count confirmed: 39개 비임대 타입');
    }

    if (totalUnits !== 3365) {
      passed = false;
      details.push(`Total non-rental units mismatch: expected 3365, got ${totalUnits}`);
    } else {
      details.push('Total non-rental units confirmed: 3,365세대');
    }

    results.push({
      scenarioName: 'Scenario E: SSOT Integrity (39 types, 3,365 units)',
      passed,
      details,
    });
  }

  const passedScenarios = results.filter((r) => r.passed).length;
  return {
    success: passedScenarios === results.length,
    totalScenarios: results.length,
    passedScenarios,
    results,
  };
}

// Self-run when executed directly via tsx/node
const isDirectRun = process.argv[1]?.includes('unitTypeComparison.test');
if (isDirectRun) {
  const result = runUnitTypeComparisonAudit();
  console.log('=== Unit Type Comparison Audit Results ===');
  console.log(`Success: ${result.success}`);
  console.log(`Passed: ${result.passedScenarios} / ${result.totalScenarios}`);
  result.results.forEach((r) => {
    console.log(`- [${r.passed ? 'PASS' : 'FAIL'}] ${r.scenarioName}: ${r.details}`);
  });
  if (!result.success) {
    process.exit(1);
  }
}

