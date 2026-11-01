/**
 * Phase 4H-2: 삼익비치(남천2구역) 공급계획 연결 및 감사 검증 테스트 스위트
 *
 * 검증 항목:
 * 1. 공식 인허가 고시 총괄 세대수 팩트 확인 (부산 수영구 고시 제2026-71호 기준 3,060세대, 1:1 재건축)
 * 2. 공급 배분 원칙 확인 (1대1 재건축으로 임대 0세대, 일반분양 0세대, 세부 배분 임의 추정 금지)
 * 3. 19개 단위세대 평면도 세대수 임의 추정 금지 원칙 준수 (19개 타입 전원 units === 0)
 * 4. 19개 단위세대 모두 evidenceSourceId ('samikbeach-unit-plans-user-supplied-v1') 연결 검증
 * 5. 19개 단위세대 모두 allocation 5대 속성 연결 및 statusNotice 명시 검증
 * 6. 타입별 합계(0세대)와 총괄 세대수(3,060세대) 산술 검증 (관리처분계획 확정 전 미확인 상태 식별)
 * 7. 배치도 8개 주동 좌표 (101~108동) 및 buildingMappings Freeze 불변 검증
 * 8. 20개 실물 에셋(배치도 1 + 평면도 19) 실재성 Freeze 검증
 * 9. validateProjectPlanConfig(samikBeachPlanConfig) 유효성 0 errors 통과
 * 10. 촉진3(chokjin-3) 39개 타입, 비임대 3,365세대, 총 3,545세대 regression PASS
 * 11. 우동3(udong-3) 24개 타입, 비임대 2,274세대, 총 2,395세대 regression PASS
 */

import * as fs from 'fs';
import * as path from 'path';
import { getProjectPlanConfig } from '../data/projects/planRegistry.ts';
import { validateProjectPlanConfig } from '../types/planConfig.ts';

export interface SamikBeachSupplyTestResult {
  itemNumber: number;
  name: string;
  passed: boolean;
  details?: string;
}

export function runSamikBeachSupplyPlanSuite(): {
  total: number;
  passed: number;
  results: SamikBeachSupplyTestResult[];
} {
  const results: SamikBeachSupplyTestResult[] = [];
  const samikConfig = getProjectPlanConfig('samik-beach');
  const udongConfig = getProjectPlanConfig('udong-3');
  const chokjinConfig = getProjectPlanConfig('chokjin-3');

  const unitTypes = samikConfig?.unitTypes || [];

  // 1. 공식 인허가 고시 총괄 세대수 팩트 확인 (3,060세대)
  // 부산광역시 수영구 고시 제2026-71호 및 정비계획 변경고시(부산시 고시 제2026-181호)
  const officialTotalUnits = 3060;
  const noticeVerified = (samikConfig?.notices || []).some((n) =>
    n.includes('3,060세대') && n.includes('수영구 고시 제2026-71호')
  );
  results.push({
    itemNumber: 1,
    name: '공식 인허가 고시 총괄 세대수 팩트 확인 (수영구 고시 제2026-71호: 3,060세대, 1:1 재건축)',
    passed: noticeVerified,
    details: `officialTotalUnits: ${officialTotalUnits}, noticeMatched: ${noticeVerified}`,
  });

  // 2. 공급 배분 임의 추정 금지 원칙 준수 (Evidence 없는 세부 배분 추정 금지)
  const noFabricatedBreakdown =
    samikConfig?.planVersion?.totalSupplySummary?.memberUnits === 0 &&
    samikConfig?.planVersion?.totalSupplySummary?.generalSaleUnits === 0 &&
    samikConfig?.planVersion?.totalSupplySummary?.rentalUnits === 0;
  results.push({
    itemNumber: 2,
    name: '공급 배분 임의 추정 금지 원칙 준수 (관리처분계획 인가 전 미확인 수치 임의 입력 배제)',
    passed: noFabricatedBreakdown,
    details: `member: ${samikConfig?.planVersion?.totalSupplySummary?.memberUnits}, general: ${samikConfig?.planVersion?.totalSupplySummary?.generalSaleUnits}, rental: ${samikConfig?.planVersion?.totalSupplySummary?.rentalUnits}`,
  });

  // 3. 19개 단위세대 평면도 세대수 임의 추정 금지 원칙 준수 (전원 units: 0)
  const allUnitsZero = unitTypes.length === 19 && unitTypes.every((u) => u.units === 0);
  results.push({
    itemNumber: 3,
    name: '19개 단위세대 평면도 세대수 임의 추정 금지 원칙 준수 (19개 타입 전원 units=0 유지)',
    passed: allUnitsZero,
    details: `typesCount: ${unitTypes.length}, allZero: ${allUnitsZero}`,
  });

  // 4. 19개 단위세대 모두 evidenceSourceId 연결 검증
  const allEvidenceConnected = unitTypes.every(
    (u) => u.evidenceSourceId === 'samikbeach-unit-plans-user-supplied-v1'
  );
  results.push({
    itemNumber: 4,
    name: '19개 단위세대 모두 evidenceSourceId ("samikbeach-unit-plans-user-supplied-v1") 연결 검증',
    passed: allEvidenceConnected,
    details: `evidenceConnectedCount: ${unitTypes.filter((u) => u.evidenceSourceId).length} / ${unitTypes.length}`,
  });

  // 5. 19개 단위세대 모두 allocation 5대 속성 연결 및 statusNotice 명시 검증
  const allAllocationValid = unitTypes.every((u) => {
    const alloc = u.allocation;
    if (!alloc) return false;
    return (
      typeof alloc.totalUnits === 'number' &&
      typeof alloc.memberUnits === 'number' &&
      typeof alloc.reservedUnits === 'number' &&
      typeof alloc.generalSaleUnits === 'number' &&
      typeof alloc.rentalUnits === 'number' &&
      typeof alloc.statusNotice === 'string' &&
      alloc.statusNotice.length > 0
    );
  });
  results.push({
    itemNumber: 5,
    name: '19개 단위세대 모두 allocation 5대 속성 연결 및 statusNotice 명시 검증',
    passed: allAllocationValid,
    details: `allocationValidCount: ${unitTypes.filter((u) => u.allocation).length} / ${unitTypes.length}`,
  });

  // 6. 타입별 합계(0세대)와 총괄 세대수(3,060세대) 산술 검증 (Discrepancy / 미확정 식별)
  const sumOfUnitTypes = unitTypes.reduce((acc, u) => acc + (u.units || 0), 0);
  const arithmeticVerified =
    sumOfUnitTypes === 0 &&
    officialTotalUnits === 3060 &&
    samikConfig?.planVersion?.discrepancyNotice !== null &&
    (samikConfig?.planVersion?.discrepancyNotice?.includes('3,060세대') ?? false);
  results.push({
    itemNumber: 6,
    name: '타입별 합계(0세대)와 총괄 세대수(3,060세대) 산술 검증 (관리처분인가 전 미확정 상태 식별)',
    passed: arithmeticVerified,
    details: `sumOfUnits: ${sumOfUnitTypes}, officialTotal: ${officialTotalUnits}, discrepancyNoticeSet: ${arithmeticVerified}`,
  });

  // 7. 배치도 8개 주동 좌표 (101~108동) 및 buildingMappings Freeze 불변 검증
  const coordsCount = (samikConfig?.coordinates || []).length;
  const buildingsCount = (samikConfig?.buildings || []).length;
  const coordsFrozen =
    coordsCount === 8 &&
    buildingsCount === 8 &&
    samikConfig?.capabilities.hasInteractiveCoordinates === true &&
    samikConfig?.capabilities.hasBuildingMappings === true;
  results.push({
    itemNumber: 7,
    name: '배치도 8개 주동 좌표 (101~108동) 및 buildingMappings Freeze 불변 검증',
    passed: coordsFrozen,
    details: `coords: ${coordsCount}, buildings: ${buildingsCount}`,
  });

  // 8. 20개 실물 에셋 (배치도 1 + 평면도 19) 실재성 Freeze 검증
  let missingAssets = 0;
  const sitePlanPath = path.resolve(process.cwd(), 'public/assets/plans/samikBeach/site-plan.png');
  if (!fs.existsSync(sitePlanPath)) missingAssets++;
  for (const u of unitTypes) {
    const p = path.resolve(process.cwd(), `public${u.sourceAsset.imageUrl}`);
    if (!fs.existsSync(p)) missingAssets++;
  }
  results.push({
    itemNumber: 8,
    name: '20개 실물 에셋 (배치도 1 + 평면도 19) 실재성 Freeze 검증',
    passed: missingAssets === 0,
    details: `missingAssets: ${missingAssets}`,
  });

  // 9. validateProjectPlanConfig(samikBeachPlanConfig) 유효성 0 errors 통과
  const validation = validateProjectPlanConfig(samikConfig!);
  results.push({
    itemNumber: 9,
    name: 'validateProjectPlanConfig(samikBeachPlanConfig) 스키마 유효성 0 errors 통과',
    passed: validation.isValid && validation.errors.length === 0,
    details: `isValid: ${validation.isValid}, errors: [${validation.errors.join(', ')}]`,
  });

  // 10. 촉진3(chokjin-3) 39개 타입, 비임대 3,365세대, 총 3,545세대 regression PASS
  const chokjinSummary = chokjinConfig?.planVersion?.totalSupplySummary;
  const chokjinValid =
    chokjinSummary?.totalUnits === 3545 &&
    chokjinSummary?.nonRentalUnits === 3365 &&
    chokjinSummary?.rentalUnits === 180 &&
    chokjinSummary?.memberUnits === 1727 &&
    chokjinSummary?.generalSaleUnits === 1618 &&
    chokjinSummary?.reservedUnits === 20 &&
    (chokjinConfig?.unitTypes?.length || 0) === 39;
  results.push({
    itemNumber: 10,
    name: '촉진3(chokjin-3) 39개 타입, 비임대 3,365세대, 총 3,545세대 regression PASS',
    passed: chokjinValid,
    details: `chokjin total: ${chokjinSummary?.totalUnits}, nonRental: ${chokjinSummary?.nonRentalUnits}, typesCount: ${chokjinConfig?.unitTypes?.length}`,
  });

  // 11. 우동3(udong-3) 24개 타입, 비임대 2,274세대, 총 2,395세대 regression PASS
  const udongSummary = udongConfig?.planVersion?.totalSupplySummary;
  const udongValid =
    udongSummary?.totalUnits === 2395 &&
    udongSummary?.nonRentalUnits === 2274 &&
    udongSummary?.rentalUnits === 121 &&
    udongSummary?.memberUnits === 1095 &&
    udongSummary?.generalSaleUnits === 1156 &&
    udongSummary?.reservedUnits === 23 &&
    (udongConfig?.unitTypes?.length || 0) === 24;
  results.push({
    itemNumber: 11,
    name: '우동3(udong-3) 24개 타입, 비임대 2,274세대, 총 2,395세대 regression PASS',
    passed: udongValid,
    details: `udong total: ${udongSummary?.totalUnits}, nonRental: ${udongSummary?.nonRentalUnits}, typesCount: ${udongConfig?.unitTypes?.length}`,
  });

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    results,
  };
}

// Make failures visible to node --test (previously only reported via return value).
import nodeTest from 'node:test';
import nodeAssert from 'node:assert/strict';

nodeTest('삼익비치 공급계획', () => {
  const report = runSamikBeachSupplyPlanSuite();
  const failed = report.results.filter((r) => !r.passed);
  nodeAssert.equal(failed.length, 0, JSON.stringify(failed, null, 2));
  nodeAssert.ok(report.total > 0 && report.passed === report.total, `passed ${report.passed}/${report.total}`);
});
