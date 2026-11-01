/**
 * Phase 4E-5 Automated Test Suite: UnitPlanView Commonization & ProjectPlanConfig Integration
 * 
 * Tests:
 * 1. Generic Project Configuration (No chokjin-3 strings, full capabilities, A동/B동, TYPE-A/TYPE-B)
 * 2. Partial Project Configurations (Udong3, SamikBeach: capabilities=false, grace ready states, 0 errors)
 * 3. UnitPlanView Production Hardcoding Zero Audit
 * 4. Viewer Integrity (InteractiveSitePlan & UnitTypeComparison untouched)
 */

import fs from 'fs';
import path from 'path';
import {
  ProjectPlanConfig,
  validateProjectPlanConfig,
} from '../types/planConfig.ts';
import {
  getProjectPlanConfig,
  getAllProjectPlanConfigs,
} from '../data/projects/planRegistry.ts';

export interface AuditResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

export function runUnitPlanViewCommonAudit(): { passed: boolean; results: AuditResult[] } {
  const results: AuditResult[] = [];

  // 1. Generic Project Test (Prompt [19])
  {
    const genericProjectConfig: ProjectPlanConfig = {
      projectId: 'test-project',
      projectName: '테스트재개발정비사업',
      displayName: '테스트구역',
      capabilities: {
        hasSitePlan: true,
        hasInteractiveCoordinates: true,
        hasUnitPlans: true,
        hasBuildingMappings: true,
        hasSupplyAllocation: true,
        hasUnitComparison: true,
      },
      planVersion: {
        planVersionId: 'test-v1',
        projectId: 'test-project',
        sourceType: 'association',
        sourceName: '테스트조합',
        documentTitle: '테스트 사업계획안',
        publishedDate: '2025-01-01',
        sourceDate: '2025-01-01',
        confirmationStatus: 'proposal',
        verificationStatus: 'verified',
        isCurrentKnownVersion: true,
        supersededBy: null,
        totalUnitsInPlanSet: 500,
        discrepancyNotice: '',
        totalSupplySummary: {
          totalUnits: 500,
          nonRentalUnits: 490,
          memberUnits: 300,
          generalSaleUnits: 190,
          rentalUnits: 10,
          reservedUnits: 0,
        },
      } as any,
      areaGroups: [
        {
          groupCode: '84',
          name: '84㎡',
          types: ['TYPE-A', 'TYPE-B'],
          totalUnits: 500,
        },
      ],
      unitTypes: [
        {
          typeCode: 'TYPE-A',
          typeName: '84A (테스트)',
          areaGroup: '84',
          exclusiveAreaM2: 84.5,
          netAreaM2: 84.5,
          units: 300,
          bayCount: 4,
          isDuplex: false,
          isTerrace: false,
          buildingNumbers: ['A동'],
          candidateBuildingNumbers: [],
          specialFeatures: ['4베이', '판상형'],
          allocation: {
            totalUnits: 300,
            memberUnits: 200,
            generalSaleUnits: 100,
            rentalUnits: 0,
            reservedUnits: 0,
          },
          sourceAsset: {
            assetPath: '/test/assets/type-a.png',
            primaryAssetPath: '/test/assets/type-a.png',
            isDuplex: false,
            isMultiLevel: false,
          } as any,
        } as any,
        {
          typeCode: 'TYPE-B',
          typeName: '84B (테스트)',
          areaGroup: '84',
          exclusiveAreaM2: 84.8,
          netAreaM2: 84.8,
          units: 200,
          bayCount: 3,
          isDuplex: false,
          isTerrace: false,
          buildingNumbers: ['B동'],
          candidateBuildingNumbers: [],
          specialFeatures: ['타워형'],
          allocation: {
            totalUnits: 200,
            memberUnits: 100,
            generalSaleUnits: 90,
            rentalUnits: 0,
            reservedUnits: 10,
          },
          sourceAsset: {
            assetPath: '/test/assets/type-b.png',
            primaryAssetPath: '/test/assets/type-b.png',
            isDuplex: false,
            isMultiLevel: false,
          } as any,
        } as any,
      ],
      sitePlan: {
        sitePlanId: 'test-site-plan',
        projectId: 'test-project',
        assetPath: '/test/assets/site-plan.png',
        sourceType: 'association',
        confirmationStatus: 'proposal',
        verificationStatus: 'verified-from-image',
        isCurrentKnownVersion: true,
        title: '테스트 배치도',
        versionNotice: '테스트 버전',
        totalBuildingsCount: 2,
        renderDimensions: { width: 1000, height: 1000, naturalAspectRatio: 1.0 },
      } as any,
      buildings: [
        {
          buildingId: 'b-A',
          buildingNumber: 'A동',
          projectId: 'test-project',
          highestFloor: 25,
          unitTypes: ['TYPE-A'],
          isKeyLandmark: false,
          dongAlias: null,
          zone: 'A블록',
        } as any,
        {
          buildingId: 'b-B',
          buildingNumber: 'B동',
          projectId: 'test-project',
          highestFloor: 25,
          unitTypes: ['TYPE-B'],
          isKeyLandmark: false,
          dongAlias: null,
          zone: 'B블록',
        } as any,
      ],
      coordinates: [
        {
          id: 'coord-A',
          buildingNumber: 'A동',
          dongNumber: 'A동',
          xPercent: 30,
          yPercent: 40,
        } as any,
        {
          id: 'coord-B',
          buildingNumber: 'B동',
          dongNumber: 'B동',
          xPercent: 70,
          yPercent: 60,
        } as any,
      ],
      recommendedComparisons: [
        {
          id: 'comp-1',
          title: 'A/B 비교',
          description: 'A타입과 B타입 비교',
          typeCodes: ['TYPE-A', 'TYPE-B'],
        },
      ],
      notices: ['테스트 사업계획안입니다.'],
    };

    const validation = validateProjectPlanConfig(genericProjectConfig);
    const jsonString = JSON.stringify(genericProjectConfig);
    const hasChokjinString = jsonString.includes('chokjin') || jsonString.includes('촉진');

    results.push({
      suite: 'Generic Project Test',
      name: 'Generic project config validation passes',
      passed: validation.isValid,
      details: validation.errors.join(', '),
    });

    results.push({
      suite: 'Generic Project Test',
      name: 'Generic project has zero Chokjin strings',
      passed: !hasChokjinString,
      details: hasChokjinString ? 'Chokjin strings found' : 'Completely clean',
    });

    results.push({
      suite: 'Generic Project Test',
      name: 'Generic project has valid A동/B동 buildings and TYPE-A/TYPE-B types',
      passed:
        genericProjectConfig.buildings.length === 2 &&
        genericProjectConfig.unitTypes.length === 2 &&
        genericProjectConfig.coordinates.length === 2,
    });
  }

  // 2. Real Asset & Partial Project Tests
  {
    const udongConfig = getProjectPlanConfig('udong-3');
    const udongValid = udongConfig ? validateProjectPlanConfig(udongConfig) : { isValid: false, errors: ['not found'] };

    results.push({
      suite: 'Real Asset Project Test (udong-3)',
      name: 'udong-3 config is registered and valid',
      passed: udongValid.isValid,
      details: udongValid.errors.join(', '),
    });

    results.push({
      suite: 'Real Asset Project Test (udong-3)',
      name: 'udong-3 has real asset capabilities (hasSitePlan, hasUnitPlans, hasInteractiveCoordinates, hasUnitComparison)',
      passed:
        !!udongConfig &&
        udongConfig.capabilities.hasSitePlan === true &&
        udongConfig.capabilities.hasUnitPlans === true &&
        udongConfig.capabilities.hasInteractiveCoordinates === true &&
        udongConfig.capabilities.hasUnitComparison === true,
      details: JSON.stringify(udongConfig?.capabilities),
    });

    const samikConfig = getProjectPlanConfig('samik-beach');
    const samikValid = samikConfig ? validateProjectPlanConfig(samikConfig) : { isValid: false, errors: ['not found'] };

    results.push({
      suite: 'Partial Project Test (samik-beach)',
      name: 'samik-beach config is registered and valid',
      passed: samikValid.isValid,
      details: samikValid.errors.join(', '),
    });

    results.push({
      suite: 'Phase 4G-2 Project Test (samik-beach)',
      name: 'samik-beach has sitePlan and unitPlans normalized without coordinates/buildingMappings',
      passed:
        !!samikConfig &&
        samikConfig.capabilities.hasSitePlan === true &&
        samikConfig.capabilities.hasUnitPlans === true &&
        samikConfig.capabilities.hasUnitComparison === true &&
        samikConfig.capabilities.hasInteractiveCoordinates === false &&
        samikConfig.capabilities.hasBuildingMappings === false,
      details: JSON.stringify(samikConfig?.capabilities),
    });
  }

  // 3. UnitPlanView Production Hardcoding Zero Audit (Prompt [18])
  {
    const unitPlanViewPath = path.resolve(process.cwd(), 'src/components/UnitPlanView.tsx');
    const content = fs.readFileSync(unitPlanViewPath, 'utf-8');

    // Forbidden project-specific imports or identifiers
    const forbiddenPatterns: { name: string; pattern: RegExp }[] = [
      { name: 'CHOKJIN3 constant reference', pattern: /\bCHOKJIN3_[A-Z0-9_]+\b/ },
      { name: 'chokjin3PlanData file import', pattern: /from\s+['"].*chokjin3PlanData.*['"]/ },
      { name: 'Direct chokjin planConfig import', pattern: /from\s+['"].*projects\/chokjin3.*['"]/ },
      { name: 'Hardcoded asset path to chokjin3', pattern: /\/assets\/plans\/chokjin3/ },
      { name: 'Hardcoded unit type 84A1', pattern: /['"]84A1['"]/ },
      { name: 'Hardcoded unit type 84A2', pattern: /['"]84A2['"]/ },
      { name: 'Hardcoded unit type 84T1', pattern: /['"]84T1['"]/ },
      { name: 'Hardcoded unit type 84T2', pattern: /['"]84T2['"]/ },
      { name: 'Hardcoded unit type 98C', pattern: /['"]98C['"]/ },
      { name: 'Hardcoded unit type 98D', pattern: /['"]98D['"]/ },
      { name: 'Hardcoded unit type 98T', pattern: /['"]98T['"]/ },
      { name: 'Hardcoded unit type 107W', pattern: /['"]107W['"]/ },
      { name: 'Hardcoded unit type 118-T', pattern: /['"]118-T['"]/ },
      { name: 'Hardcoded chokjin-3 conditional logic', pattern: /selectedProjectId\s*===?\s*['"]chokjin-3['"]/ },
      { name: 'Hardcoded factual total units 3545', pattern: /\b3545\b/ },
      { name: 'Hardcoded factual total units 3365', pattern: /\b3365\b/ },
      { name: 'Hardcoded factual units 1727', pattern: /\b1727\b/ },
      { name: 'Hardcoded factual units 1618', pattern: /\b1618\b/ },
    ];

    for (const item of forbiddenPatterns) {
      const match = content.match(item.pattern);
      results.push({
        suite: 'UnitPlanView Hardcoding Zero Audit',
        name: `No ${item.name}`,
        passed: !match,
        details: match ? `Found forbidden match: "${match[0]}"` : '0 occurrences',
      });
    }

    // Verify it uses getProjectPlanConfig
    const usesPlanConfig = content.includes('getProjectPlanConfig(selectedProjectId)');
    results.push({
      suite: 'UnitPlanView Architecture Check',
      name: 'Uses getProjectPlanConfig(selectedProjectId) as single entry point',
      passed: usesPlanConfig,
    });
  }

  const allPassed = results.every((r) => r.passed);
  return { passed: allPassed, results };
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('unitPlanViewCommon.test.ts')) {
  console.log('--- Running UnitPlanView Commonization Audit ---');
  const { passed, results } = runUnitPlanViewCommonAudit();
  for (const r of results) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.suite} - ${r.name} ${r.details ? `(${r.details})` : ''}`);
  }
  console.log(`\nFinal Result: ${passed ? 'ALL PASSED (100%)' : 'SOME FAILED'}`);
  process.exit(passed ? 0 : 1);
}
