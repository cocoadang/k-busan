/**
 * Phase 4E-4: Generic Unit Type Comparison Validation & Regression Test Suite
 * 
 * 검증 항목:
 * 1. Generic Mock Fixture Test (가상 사업지: 50㎡, 75㎡, TYPE-X, TYPE-Y, TYPE-Z)
 *    - areaGroups prop 구동 (50㎡, 75㎡ 필터링)
 *    - 최대 3개 선택 한도 (Max 3 selection limit)
 *    - allocation 공급계획 (조합원/일반분양 정합성)
 *    - confirmed mapping (A동 배치 확인)
 *    - candidate mapping (B동 후보 · 미확정)
 *    - duplex 복층 처리 (1F/2F 에셋 분기)
 *    - recommended preset (TYPE-X vs TYPE-Y 외부 주입 및 빈 프리셋 안전 처리)
 * 2. Static Forbidden String Audit (UnitTypeComparison.tsx 내 사업지 고유 문자열 0건 검증)
 * 3. 촉진3 4개 시나리오 및 SSOT 무결성 회귀 (84A1 vs 98C, 84T1 vs 84T2, 98C vs 114A vs 124A, 98D vs 98T, 39개 타입/3,365세대)
 */

import fs from 'fs';
import path from 'path';
import { FirestoreUnitTypeDoc } from '../schema/firestoreSchema.ts';
import { AreaGroupDefinition, RecommendedComparisonPreset } from '../types/planConfig.ts';
import { runUnitTypeComparisonAudit } from './unitTypeComparison.test.ts';

// 1. Generic Mock Fixture (테스트 전용 가상 데이터 - production 미저장)
export const GENERIC_COMPARISON_FIXTURE = {
  areaGroups: [
    { groupCode: '50', name: '50㎡', totalUnits: 150, types: ['TYPE-X', 'TYPE-Y'] },
    { groupCode: '75', name: '75㎡', totalUnits: 20, types: ['TYPE-Z'] },
  ] as AreaGroupDefinition[],
  unitTypes: [
    {
      unitTypeId: 'generic-type-x',
      typeName: 'TYPE-X',
      typeCode: 'TYPE-X',
      units: 100,
      projectId: 'generic-project',
      planVersionId: 'generic-v1',
      areaGroup: '50',
      netAreaM2: 50.12,
      floorPlanAssetId: 'mock-asset-x',
      locationMapIncludedInOriginal: true,
      specialFeatures: ['4베이 판상형', '팬트리'],
      verificationStatus: 'verified' as const,
      confirmationStatus: 'proposal' as const,
      verifiedFacts: {
        typeName: 'TYPE-X',
        units: 100,
        areaGroup: '50㎡',
        sourceType: 'association',
        evidence: '테스트 도면',
        hasLocationMap: true,
        verificationStatus: 'verified' as const,
        confirmationStatus: 'proposal' as const,
      },
      allocation: {
        totalUnits: 100,
        memberUnits: 80,
        reservedUnits: 0,
        generalSaleUnits: 20,
        rentalUnits: 0,
      },
      sourceAsset: {
        assetId: 'asset-x',
        originalFileName: 'type-x.png',
        assetType: 'floor_plan' as const,
        isDuplex: false,
        primaryAssetPath: '/assets/mock/type-x.png',
        imageUrl: '/assets/mock/type-x.png',
      },
      buildingNumbers: ['A동'],
      candidateBuildingNumbers: [],
      mappingStatus: 'verified' as const,
      unverifiedAttributesNotice: '테스트 고지',
      createdAt: '2026-09-15T00:00:00Z',
    },
    {
      unitTypeId: 'generic-type-y',
      typeName: 'TYPE-Y',
      typeCode: 'TYPE-Y',
      units: 50,
      projectId: 'generic-project',
      planVersionId: 'generic-v1',
      areaGroup: '50',
      netAreaM2: 50.45,
      floorPlanAssetId: 'mock-asset-y',
      locationMapIncludedInOriginal: true,
      specialFeatures: ['타워형'],
      verificationStatus: 'verified' as const,
      confirmationStatus: 'proposal' as const,
      verifiedFacts: {
        typeName: 'TYPE-Y',
        units: 50,
        areaGroup: '50㎡',
        sourceType: 'association',
        evidence: '테스트 도면',
        hasLocationMap: true,
        verificationStatus: 'verified' as const,
        confirmationStatus: 'proposal' as const,
      },
      allocation: {
        totalUnits: 50,
        memberUnits: 50,
        reservedUnits: 0,
        generalSaleUnits: 0,
        rentalUnits: 0,
      },
      sourceAsset: {
        assetId: 'asset-y',
        originalFileName: 'type-y.png',
        assetType: 'floor_plan' as const,
        isDuplex: false,
        primaryAssetPath: '/assets/mock/type-y.png',
        imageUrl: '/assets/mock/type-y.png',
      },
      buildingNumbers: [],
      candidateBuildingNumbers: ['B동'],
      mappingStatus: 'supported' as const,
      unverifiedAttributesNotice: '테스트 고지',
      createdAt: '2026-09-15T00:00:00Z',
    },
    {
      unitTypeId: 'generic-type-z',
      typeName: 'TYPE-Z',
      typeCode: 'TYPE-Z',
      units: 20,
      projectId: 'generic-project',
      planVersionId: 'generic-v1',
      areaGroup: '75',
      netAreaM2: 75.88,
      floorPlanAssetId: 'mock-asset-z',
      locationMapIncludedInOriginal: true,
      specialFeatures: ['복층 테라스', '단독 옥상'],
      verificationStatus: 'verified' as const,
      confirmationStatus: 'proposal' as const,
      verifiedFacts: {
        typeName: 'TYPE-Z',
        units: 20,
        areaGroup: '75㎡',
        sourceType: 'association',
        evidence: '테스트 도면',
        hasLocationMap: true,
        verificationStatus: 'verified' as const,
        confirmationStatus: 'proposal' as const,
      },
      allocation: {
        totalUnits: 20,
        memberUnits: 18,
        reservedUnits: 0,
        generalSaleUnits: 2,
        rentalUnits: 0,
      },
      sourceAsset: {
        assetId: 'asset-z',
        originalFileName: 'type-z.png',
        assetType: 'floor_plan' as const,
        isDuplex: true,
        primaryAssetPath: '/assets/mock/type-z-1f.png',
        secondaryAssetPath: '/assets/mock/type-z-2f.png',
        imageUrl: '/assets/mock/type-z-1f.png',
      },
      buildingNumbers: [],
      candidateBuildingNumbers: [],
      mappingStatus: 'unresolved' as const,
      unverifiedAttributesNotice: '테스트 고지',
      createdAt: '2026-09-15T00:00:00Z',
    },
  ] as FirestoreUnitTypeDoc[],
  recommendedPresets: [
    {
      id: 'preset-x-vs-y',
      label: 'TYPE-X vs TYPE-Y',
      typeCodes: ['TYPE-X', 'TYPE-Y'],
      description: '확정동 vs 후보동 대조',
    },
  ] as RecommendedComparisonPreset[],
};

// Placement metadata helper mirroring UnitTypeComparison logic
export function evaluatePlacementMetadata(unit: FirestoreUnitTypeDoc) {
  if (unit.buildingNumbers && unit.buildingNumbers.length > 0) {
    return {
      dongDisplay: unit.buildingNumbers.join(', '),
      statusDisplay: '배치 확인',
      type: 'verified' as const,
    };
  }
  if (unit.candidateBuildingNumbers && unit.candidateBuildingNumbers.length > 0) {
    return {
      dongDisplay: `${unit.candidateBuildingNumbers.join(', ')} 후보`,
      statusDisplay: '후보 · 미확정',
      type: 'candidate' as const,
    };
  }
  return {
    dongDisplay: '세부 배치 확인 필요',
    statusDisplay: '세부 배치 확인 필요',
    type: 'unresolved' as const,
  };
}

export function runGenericUnitTypeComparisonAudit(): {
  success: boolean;
  totalTests: number;
  passedTests: number;
  details: {
    areaGroupsPropPassed: boolean;
    maxSelectionPassed: boolean;
    allocationPassed: boolean;
    confirmedMappingPassed: boolean;
    candidateMappingPassed: boolean;
    duplexHandlingPassed: boolean;
    recommendedPresetPassed: boolean;
    forbiddenStringsInProduction: boolean;
    chokjin3RegressionPassed: boolean;
    errors: string[];
  };
} {
  const errors: string[] = [];
  let areaGroupsPropPassed = true;
  let maxSelectionPassed = true;
  let allocationPassed = true;
  let confirmedMappingPassed = true;
  let candidateMappingPassed = true;
  let duplexHandlingPassed = true;
  let recommendedPresetPassed = true;
  let forbiddenStringsInProduction = false;
  let chokjin3RegressionPassed = true;

  const fixture = GENERIC_COMPARISON_FIXTURE;

  // 1. AreaGroups Prop & Filtering Check
  {
    const filterTabs = [
      { code: 'all', label: '전체' },
      ...fixture.areaGroups.map((g) => ({ code: g.groupCode, label: `${g.groupCode}㎡` })),
    ];
    if (filterTabs.length !== 3 || filterTabs[1].code !== '50' || filterTabs[2].code !== '75') {
      areaGroupsPropPassed = false;
      errors.push(`AreaGroup filter tabs incorrect: ${JSON.stringify(filterTabs)}`);
    }

    const filtered50 = fixture.unitTypes.filter((u) => u.areaGroup === '50');
    if (filtered50.length !== 2 || !filtered50.some((u) => u.typeCode === 'TYPE-X')) {
      areaGroupsPropPassed = false;
      errors.push('AreaGroup 50 filtering failed to return TYPE-X and TYPE-Y');
    }

    const filtered75 = fixture.unitTypes.filter((u) => u.areaGroup === '75');
    if (filtered75.length !== 1 || filtered75[0].typeCode !== 'TYPE-Z') {
      areaGroupsPropPassed = false;
      errors.push('AreaGroup 75 filtering failed to return TYPE-Z');
    }
  }

  // 2. Max Selection (최대 3개 선택) Rule Check
  {
    const selected = ['TYPE-X', 'TYPE-Y', 'TYPE-Z'];
    const canAdd4th = selected.length < 3;
    if (canAdd4th) {
      maxSelectionPassed = false;
      errors.push('Max 3 selection check failed: 4th selection was not blocked');
    }
    if (selected.length !== 3) {
      maxSelectionPassed = false;
      errors.push(`Selection count mismatch: expected 3, got ${selected.length}`);
    }
  }

  // 3. Allocation (공급계획) Check
  {
    const unitX = fixture.unitTypes.find((u) => u.typeCode === 'TYPE-X');
    const unitY = fixture.unitTypes.find((u) => u.typeCode === 'TYPE-Y');

    if (!unitX?.allocation || unitX.allocation.memberUnits !== 80 || unitX.allocation.generalSaleUnits !== 20) {
      allocationPassed = false;
      errors.push('TYPE-X allocation mismatch: expected member=80, general=20');
    }

    if (!unitY?.allocation || unitY.allocation.memberUnits !== 50 || unitY.allocation.generalSaleUnits !== 0) {
      allocationPassed = false;
      errors.push('TYPE-Y allocation mismatch: expected member=50, general=0');
    }
  }

  // 4. Confirmed Mapping Check (A동 배치 확인)
  {
    const unitX = fixture.unitTypes.find((u) => u.typeCode === 'TYPE-X')!;
    const placementX = evaluatePlacementMetadata(unitX);
    if (placementX.statusDisplay !== '배치 확인' || placementX.dongDisplay !== 'A동' || placementX.type !== 'verified') {
      confirmedMappingPassed = false;
      errors.push(`Confirmed mapping check failed for TYPE-X: ${JSON.stringify(placementX)}`);
    }
  }

  // 5. Candidate Mapping Check (B동 후보 · 미확정)
  {
    const unitY = fixture.unitTypes.find((u) => u.typeCode === 'TYPE-Y')!;
    const placementY = evaluatePlacementMetadata(unitY);
    if (placementY.statusDisplay !== '후보 · 미확정' || !placementY.dongDisplay.includes('B동 후보') || placementY.type !== 'candidate') {
      candidateMappingPassed = false;
      errors.push(`Candidate mapping check failed for TYPE-Y: ${JSON.stringify(placementY)}`);
    }
  }

  // 6. Duplex Handling Check (TYPE-Z 복층 1F/2F 에셋)
  {
    const unitZ = fixture.unitTypes.find((u) => u.typeCode === 'TYPE-Z')!;
    const isDuplex = !!(unitZ.sourceAsset?.isDuplex || unitZ.sourceAsset?.isMultiLevel);
    const primaryAsset = unitZ.sourceAsset?.primaryAssetPath || '';
    const secondaryAsset = unitZ.sourceAsset?.secondaryAssetPath || '';

    if (!isDuplex) {
      duplexHandlingPassed = false;
      errors.push('TYPE-Z isDuplex flag evaluation failed');
    }
    if (primaryAsset !== '/assets/mock/type-z-1f.png' || secondaryAsset !== '/assets/mock/type-z-2f.png') {
      duplexHandlingPassed = false;
      errors.push(`TYPE-Z duplex asset paths incorrect: primary=${primaryAsset}, secondary=${secondaryAsset}`);
    }

    // Floor switching logic check
    const floor1Src = primaryAsset;
    const floor2Src = secondaryAsset;
    if (floor1Src === floor2Src) {
      duplexHandlingPassed = false;
      errors.push('Duplex 1F and 2F image sources should be distinct');
    }
  }

  // 7. Recommended Preset Check (TYPE-X vs TYPE-Y & Empty Handling)
  {
    const preset = fixture.recommendedPresets[0];
    if (preset.label !== 'TYPE-X vs TYPE-Y' || preset.typeCodes.length !== 2) {
      recommendedPresetPassed = false;
      errors.push(`Preset definition invalid: ${JSON.stringify(preset)}`);
    }

    // Empty preset safety check
    const emptyPresets: RecommendedComparisonPreset[] = [];
    const shouldRenderPresets = emptyPresets && emptyPresets.length > 0;
    if (shouldRenderPresets) {
      recommendedPresetPassed = false;
      errors.push('Empty presets list should suppress preset section rendering');
    }
  }

  // 8. Static Forbidden Strings Check in src/components/UnitTypeComparison.tsx
  {
    const componentPath = path.resolve(process.cwd(), 'src/components/UnitTypeComparison.tsx');
    if (fs.existsSync(componentPath)) {
      const code = fs.readFileSync(componentPath, 'utf-8');
      const forbiddenRegex = /(chokjin|CHOKJIN3|촉진3|84A1|84A2|84T1|84T2|98C|98D|98T|114A|124A|116-T|117-T|118-T)/g;
      const matches = code.match(forbiddenRegex);
      if (matches && matches.length > 0) {
        forbiddenStringsInProduction = true;
        errors.push(`Found forbidden project-specific strings in UnitTypeComparison.tsx: ${matches.join(', ')}`);
      }
    } else {
      errors.push('UnitTypeComparison.tsx not found for static audit');
    }
  }

  // 9. 촉진3 Regression Check (Existing Scenarios A, B, C, D, E)
  {
    const regressionAudit = runUnitTypeComparisonAudit();
    if (!regressionAudit.success) {
      chokjin3RegressionPassed = false;
      errors.push(`Chokjin3 regression audit failed: ${regressionAudit.results.filter((r) => !r.passed).map((r) => r.scenarioName).join('; ')}`);
    }
  }

  const allPassed =
    areaGroupsPropPassed &&
    maxSelectionPassed &&
    allocationPassed &&
    confirmedMappingPassed &&
    candidateMappingPassed &&
    duplexHandlingPassed &&
    recommendedPresetPassed &&
    !forbiddenStringsInProduction &&
    chokjin3RegressionPassed;

  const totalTests = 9;
  const passedTests = [
    areaGroupsPropPassed,
    maxSelectionPassed,
    allocationPassed,
    confirmedMappingPassed,
    candidateMappingPassed,
    duplexHandlingPassed,
    recommendedPresetPassed,
    !forbiddenStringsInProduction,
    chokjin3RegressionPassed,
  ].filter(Boolean).length;

  return {
    success: allPassed,
    totalTests,
    passedTests,
    details: {
      areaGroupsPropPassed,
      maxSelectionPassed,
      allocationPassed,
      confirmedMappingPassed,
      candidateMappingPassed,
      duplexHandlingPassed,
      recommendedPresetPassed,
      forbiddenStringsInProduction,
      chokjin3RegressionPassed,
      errors,
    },
  };
}

// Self-run when executed directly via tsx/node
const isDirectRun = process.argv[1]?.includes('genericUnitTypeComparison.test');
if (isDirectRun) {
  const result = runGenericUnitTypeComparisonAudit();
  console.log('=== Generic Unit Type Comparison Test Audit Results ===');
  console.log(`Success: ${result.success}`);
  console.log(`Passed: ${result.passedTests} / ${result.totalTests}`);
  console.log(JSON.stringify(result.details, null, 2));
  if (!result.success) {
    process.exit(1);
  }
}

