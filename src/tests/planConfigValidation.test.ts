/**
 * Phase 4E-2 Automated Plan Config Validation Test Suite
 * 
 * 최소 검증 시나리오:
 * A. chokjin-3 -> valid (전체 기능 완비)
 * B. udong-3 partial -> valid (자료 미확보 정상 허용)
 * C. samik-beach partial -> valid (자료 미확보 정상 허용)
 * D. hasSitePlan=true + sitePlan=null -> invalid
 * E. hasInteractiveCoordinates=true + coordinates=[] -> invalid
 * F. hasUnitPlans=true + unitTypes=[] -> invalid
 */

import {
  ProjectPlanConfig,
  validateProjectPlanConfig,
} from '../types/planConfig.ts';
import {
  getProjectPlanConfig,
  getAllProjectPlanConfigs,
} from '../data/projects/planRegistry.ts';

export interface PlanConfigTestScenarioResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  expectedValid: boolean;
  actualValid: boolean;
  errors: string[];
}

export interface PlanConfigAuditReport {
  success: boolean;
  totalScenarios: number;
  passedScenarios: number;
  results: PlanConfigTestScenarioResult[];
}

export function runPlanConfigValidationAudit(): PlanConfigAuditReport {
  const results: PlanConfigTestScenarioResult[] = [];

  // Scenario A: chokjin-3 -> valid
  {
    const chokjinConfig = getProjectPlanConfig('chokjin-3');
    const errors: string[] = [];
    let passed = true;
    let actualValid = false;

    if (!chokjinConfig) {
      passed = false;
      errors.push('chokjin-3 config not found in registry');
    } else {
      const validation = validateProjectPlanConfig(chokjinConfig);
      actualValid = validation.isValid;
      if (!validation.isValid) {
        passed = false;
        errors.push(...validation.errors);
      } else {
        // Additional checks: unitTypes count is 39, coordinates count is 18
        if (chokjinConfig.unitTypes?.length !== 39) {
          passed = false;
          errors.push(`chokjin-3 unitTypes count mismatch: expected 39, got ${chokjinConfig.unitTypes?.length}`);
        }
        if (chokjinConfig.coordinates?.length !== 18) {
          passed = false;
          errors.push(`chokjin-3 coordinates count mismatch: expected 18, got ${chokjinConfig.coordinates?.length}`);
        }
      }
    }

    results.push({
      scenarioId: 'SCENARIO_A',
      scenarioName: 'chokjin-3 -> valid (전체 기능 완비)',
      passed,
      expectedValid: true,
      actualValid,
      errors,
    });
  }

  // Scenario B: udong-3 real asset mapped -> valid
  {
    const udongConfig = getProjectPlanConfig('udong-3');
    const errors: string[] = [];
    let passed = true;
    let actualValid = false;

    if (!udongConfig) {
      passed = false;
      errors.push('udong-3 config not found in registry');
    } else {
      const validation = validateProjectPlanConfig(udongConfig);
      actualValid = validation.isValid;
      if (!validation.isValid) {
        passed = false;
        errors.push(...validation.errors);
      } else {
        // Verify real asset capabilities (hasSitePlan=true, hasUnitPlans=true, hasInteractiveCoordinates=true, hasBuildingMappings=true, hasSupplyAllocation=true)
        const caps = udongConfig.capabilities;
        if (!caps.hasSitePlan || !caps.hasInteractiveCoordinates || !caps.hasUnitPlans || !caps.hasBuildingMappings || !caps.hasSupplyAllocation) {
          passed = false;
          errors.push('udong-3 should have hasSitePlan=true, hasUnitPlans=true, hasInteractiveCoordinates=true, hasBuildingMappings=true, hasSupplyAllocation=true');
        }
      }
    }

    results.push({
      scenarioId: 'SCENARIO_B',
      scenarioName: 'udong-3 real asset mapped -> valid (배치도/평면도 정상 검증)',
      passed,
      expectedValid: true,
      actualValid,
      errors,
    });
  }

  // Scenario C: samik-beach Phase 4G-2 -> valid
  {
    const samikConfig = getProjectPlanConfig('samik-beach');
    const errors: string[] = [];
    let passed = true;
    let actualValid = false;

    if (!samikConfig) {
      passed = false;
      errors.push('samik-beach config not found in registry');
    } else {
      const validation = validateProjectPlanConfig(samikConfig);
      actualValid = validation.isValid;
      if (!validation.isValid) {
        passed = false;
        errors.push(...validation.errors);
      } else {
        const caps = samikConfig.capabilities;
        if (!caps.hasSitePlan || !caps.hasUnitPlans || !caps.hasInteractiveCoordinates || !caps.hasBuildingMappings || caps.hasSupplyAllocation) {
          passed = false;
          errors.push('samik-beach should have sitePlan/unitPlans/coordinates/buildingMappings=true and unacquired supplyAllocation=false');
        }
      }
    }

    results.push({
      scenarioId: 'SCENARIO_C',
      scenarioName: 'samik-beach Phase 4G-2 -> valid (실제 에셋 연결 및 미확보 항목 분리)',
      passed,
      expectedValid: true,
      actualValid,
      errors,
    });
  }

  // Scenario D: hasSitePlan=true + sitePlan=null -> invalid
  {
    const invalidConfigD: ProjectPlanConfig = {
      projectId: 'test-invalid-d',
      projectName: '테스트 구역 D',
      capabilities: {
        hasSitePlan: true,
        hasInteractiveCoordinates: false,
        hasUnitPlans: false,
        hasBuildingMappings: false,
        hasSupplyAllocation: false,
        hasUnitComparison: false,
      },
      sitePlan: null,
    };

    const validation = validateProjectPlanConfig(invalidConfigD);
    const passed = !validation.isValid && validation.errors.some((e) => e.includes('hasSitePlan=true'));

    results.push({
      scenarioId: 'SCENARIO_D',
      scenarioName: 'hasSitePlan=true + sitePlan=null -> invalid',
      passed,
      expectedValid: false,
      actualValid: validation.isValid,
      errors: validation.errors,
    });
  }

  // Scenario E: hasInteractiveCoordinates=true + coordinates=[] -> invalid
  {
    const invalidConfigE: ProjectPlanConfig = {
      projectId: 'test-invalid-e',
      projectName: '테스트 구역 E',
      capabilities: {
        hasSitePlan: false,
        hasInteractiveCoordinates: true,
        hasUnitPlans: false,
        hasBuildingMappings: false,
        hasSupplyAllocation: false,
        hasUnitComparison: false,
      },
      coordinates: [],
    };

    const validation = validateProjectPlanConfig(invalidConfigE);
    const passed = !validation.isValid && validation.errors.some((e) => e.includes('hasInteractiveCoordinates=true'));

    results.push({
      scenarioId: 'SCENARIO_E',
      scenarioName: 'hasInteractiveCoordinates=true + coordinates=[] -> invalid',
      passed,
      expectedValid: false,
      actualValid: validation.isValid,
      errors: validation.errors,
    });
  }

  // Scenario F: hasUnitPlans=true + unitTypes=[] -> invalid
  {
    const invalidConfigF: ProjectPlanConfig = {
      projectId: 'test-invalid-f',
      projectName: '테스트 구역 F',
      capabilities: {
        hasSitePlan: false,
        hasInteractiveCoordinates: false,
        hasUnitPlans: true,
        hasBuildingMappings: false,
        hasSupplyAllocation: false,
        hasUnitComparison: false,
      },
      unitTypes: [],
    };

    const validation = validateProjectPlanConfig(invalidConfigF);
    const passed = !validation.isValid && validation.errors.some((e) => e.includes('hasUnitPlans=true'));

    results.push({
      scenarioId: 'SCENARIO_F',
      scenarioName: 'hasUnitPlans=true + unitTypes=[] -> invalid',
      passed,
      expectedValid: false,
      actualValid: validation.isValid,
      errors: validation.errors,
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

if (process.argv[1]?.endsWith('planConfigValidation.test.ts')) {
  console.log('--- Running Plan Config Validation Suite ---');
  const report = runPlanConfigValidationAudit();
  for (const r of report.results) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.scenarioId}: ${r.scenarioName} ${r.errors.length ? `(${r.errors.join(', ')})` : ''}`);
  }
  console.log(`\nFinal Result: ${report.success ? 'ALL PASSED' : 'FAILED'} (${report.passedScenarios}/${report.totalScenarios})`);
  process.exit(report.success ? 0 : 1);
}

