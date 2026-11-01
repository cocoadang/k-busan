/**
 * Phase 4H-1: 우동3구역 실제 공급계획 연결 검증 테스트
 *
 * 검증 항목:
 * 1. 전체 세대수 합계 검증 (총 2,395세대 = 비임대 2,274 + 임대 121)
 * 2. 총괄 공급계획 산술 검증 (조합원 1,095 + 일반분양 1,156 + 보류지 23 = 비임대 2,274)
 * 3. 24개 단위세대 평면도 세대수 합계 검증 (2,274세대)
 * 4. 24개 타입 모두 '0세대'가 제거되고 실제 세대수 연결 검증 (units > 0)
 * 5. 모든 타입에 units, memberUnits, reservedUnits, generalSaleUnits, rentalUnits 연결 검증
 * 6. 임대(39㎡, 121세대) 포함/제외 관계 검증 (평면도 UI 제외, 공급계획 총괄 보존)
 * 7. 155복B conflict 식별자 보존 및 statusNotice 명시 검증
 * 8. Evidence sourceId ('udong3-mgmt-plan-official-notice-2026-68') 연결 및 등록 검증
 * 9. capabilities.hasSupplyAllocation === true & availability.supplyAllocation === 'normalized'
 * 10. validateProjectPlanConfig(udong3PlanConfig) 스키마 유효성 통과
 * 11. 촉진3(chokjin-3) 총 3,545세대, 비임대 3,365세대, 39개 타입 공급계획 불변 regression PASS
 * 12. 삼익비치(samik-beach) hasSupplyAllocation=false, availability='source_not_available' 격리 regression PASS
 */

import { getProjectPlanConfig } from '../data/projects/planRegistry.ts';
import { validateProjectPlanConfig } from '../types/planConfig.ts';

export interface Udong3SupplyTestResult {
  itemNumber: number;
  name: string;
  passed: boolean;
  details?: string;
}

export function runUdong3SupplyPlanSuite(): {
  total: number;
  passed: number;
  results: Udong3SupplyTestResult[];
} {
  const results: Udong3SupplyTestResult[] = [];
  const udongConfig = getProjectPlanConfig('udong-3');
  const chokjinConfig = getProjectPlanConfig('chokjin-3');
  const samikConfig = getProjectPlanConfig('samik-beach');

  const summary = udongConfig?.planVersion?.totalSupplySummary;
  const unitTypes = udongConfig?.unitTypes || [];
  const excludedTypes = udongConfig?.planVersion?.excludedHousingTypes || [];

  // 1. 전체 세대수 합계 검증 (총 2,395세대)
  const totalUnits = summary?.totalUnits;
  const nonRental = summary?.nonRentalUnits;
  const rental = summary?.rentalUnits;
  const totalMatches = totalUnits === 2395 && nonRental === 2274 && rental === 121 && (nonRental + rental === totalUnits);
  results.push({
    itemNumber: 1,
    name: '전체 세대수 총괄 합계 검증 (2,395 = 비임대 2,274 + 임대 121)',
    passed: !!totalMatches,
    details: `total: ${totalUnits}, nonRental: ${nonRental}, rental: ${rental}`,
  });

  // 2. 총괄 공급계획 산술 검증
  const member = summary?.memberUnits;
  const general = summary?.generalSaleUnits;
  const reserved = summary?.reservedUnits;
  const breakdownMatches =
    member === 1095 &&
    general === 1156 &&
    reserved === 23 &&
    (member + general + reserved === nonRental);
  results.push({
    itemNumber: 2,
    name: '총괄 공급계획 산술 검증 (조합원 1,095 + 일반분양 1,156 + 보류지 23 = 2,274)',
    passed: !!breakdownMatches,
    details: `member: ${member}, general: ${general}, reserved: ${reserved}, sum: ${member! + general! + reserved!}`,
  });

  // 3. 24개 단위세대 평면도 세대수 합계 검증
  const sumOfUnitTypes = unitTypes.reduce((acc, u) => acc + (u.units || 0), 0);
  const planSetTotalMatches =
    udongConfig?.planVersion?.totalUnitsInPlanSet === 2274 &&
    sumOfUnitTypes === 2274;
  results.push({
    itemNumber: 3,
    name: '24개 단위세대 평면도 세대수 합계 검증 (2,274세대)',
    passed: planSetTotalMatches,
    details: `typesCount: ${unitTypes.length}, sumOfUnits: ${sumOfUnitTypes}, totalUnitsInPlanSet: ${udongConfig?.planVersion?.totalUnitsInPlanSet}`,
  });

  // 4. 24개 타입 모두 '0세대' 제거 및 실제 세대수 연결
  const zeroUnitTypes = unitTypes.filter((u) => u.units === 0);
  results.push({
    itemNumber: 4,
    name: '24개 타입 모두 0세대 제거 및 실제 세대수 연결 (units > 0)',
    passed: unitTypes.length === 24 && zeroUnitTypes.length === 0,
    details: `total types: ${unitTypes.length}, zero unit types: ${zeroUnitTypes.map((u) => u.typeCode).join(', ') || '0건'}`,
  });

  // 5. 모든 타입에 allocation 필수 5대 속성 연결 검증
  const allTypesHaveAllocationProps = unitTypes.every((u) => {
    const alloc = u.allocation;
    if (!alloc) return false;
    return (
      typeof u.units === 'number' &&
      typeof alloc.memberUnits === 'number' &&
      typeof alloc.reservedUnits === 'number' &&
      typeof alloc.generalSaleUnits === 'number' &&
      typeof alloc.rentalUnits === 'number' &&
      alloc.totalUnits === u.units
    );
  });
  results.push({
    itemNumber: 5,
    name: '모든 타입에 units, memberUnits, reservedUnits, generalSaleUnits, rentalUnits 연결 검증',
    passed: allTypesHaveAllocationProps,
    details: `allTypesHaveAllocationProps: ${allTypesHaveAllocationProps}`,
  });

  // 6. 임대(39㎡, 121세대) 포함/제외 관계 검증
  const rentalInExcluded = excludedTypes.find((e) => e.typeCode === '39');
  const rentalInSelectableTypes = unitTypes.find((u) => u.typeCode === '39');
  const rentalValid =
    rentalInExcluded !== undefined &&
    rentalInExcluded.units === 121 &&
    rentalInExcluded.housingCategory === 'rental' &&
    rentalInExcluded.excludedFromUnitPlanUI === true &&
    rentalInSelectableTypes === undefined;
  results.push({
    itemNumber: 6,
    name: '임대(39㎡, 121세대) 포함/제외 관계 검증 (평면도 UI 제외, 공급계획 총괄 보존)',
    passed: rentalValid,
    details: `excluded rental units: ${rentalInExcluded?.units}, inSelectableTypes: ${rentalInSelectableTypes !== undefined}`,
  });

  // 7. 155복B conflict 식별자 보존 및 statusNotice 명시 검증
  const type155 = unitTypes.find((u) => u.typeCode === '155복B');
  const type155Valid =
    type155 !== undefined &&
    type155.units === 16 &&
    type155.allocation?.isConflict === true &&
    type155.sourceAlias === '154B' &&
    !!type155.allocation?.statusNotice;
  results.push({
    itemNumber: 7,
    name: '155복B conflict 식별자 보존 및 statusNotice 명시 검증 (공식 고시 154B 16세대 매핑)',
    passed: !!type155Valid,
    details: `type155 units: ${type155?.units}, isConflict: ${type155?.allocation?.isConflict}, alias: ${type155?.sourceAlias}`,
  });

  // 8. Evidence sourceId 연결 및 등록 검증
  const officialSourceId = 'udong3-mgmt-plan-official-notice-2026-68';
  const registeredSources = new Set((udongConfig?.evidenceSources || []).map((s) => s.sourceId));
  const isSourceRegistered = registeredSources.has(officialSourceId);
  const planVersionRefMatches = udongConfig?.planVersion?.evidenceSourceId === officialSourceId;
  const summaryRefMatches = summary?.evidenceSourceId === officialSourceId;
  const allUnitTypesRefMatches = unitTypes.every((u) => u.evidenceSourceId === officialSourceId);
  results.push({
    itemNumber: 8,
    name: '공식 고시 Evidence sourceId 연결 및 등록 검증',
    passed: isSourceRegistered && planVersionRefMatches && summaryRefMatches && allUnitTypesRefMatches,
    details: `sourceRegistered: ${isSourceRegistered}, planVersionRef: ${planVersionRefMatches}, summaryRef: ${summaryRefMatches}, allUnitTypesRef: ${allUnitTypesRefMatches}`,
  });

  // 9. capabilities 및 availability 상태 검증
  const caps = udongConfig?.capabilities;
  const avail = udongConfig?.availability;
  const capsPass =
    caps?.hasSupplyAllocation === true &&
    avail?.supplyAllocation === 'normalized';
  results.push({
    itemNumber: 9,
    name: 'capabilities.hasSupplyAllocation === true & availability.supplyAllocation === "normalized"',
    passed: !!capsPass,
    details: `hasSupplyAllocation: ${caps?.hasSupplyAllocation}, supplyAllocation: ${avail?.supplyAllocation}`,
  });

  // 10. validateProjectPlanConfig 검증
  const validation = udongConfig ? validateProjectPlanConfig(udongConfig) : { isValid: false, errors: ['config not found'] };
  results.push({
    itemNumber: 10,
    name: 'validateProjectPlanConfig(udong3PlanConfig) 스키마 유효성 100% 통과 (0 errors)',
    passed: validation.isValid && validation.errors.length === 0,
    details: `isValid: ${validation.isValid}, errors: [${validation.errors.join(', ')}]`,
  });

  // 11. 촉진3 regression 검증
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
    itemNumber: 11,
    name: '촉진3(chokjin-3) 39개 타입, 비임대 3,365세대, 총 3,545세대 regression PASS',
    passed: chokjinValid,
    details: `chokjin total: ${chokjinSummary?.totalUnits}, nonRental: ${chokjinSummary?.nonRentalUnits}, typesCount: ${chokjinConfig?.unitTypes?.length}`,
  });

  // 12. 삼익비치 regression 검증
  const samikCaps = samikConfig?.capabilities;
  const samikAvail = samikConfig?.availability;
  const samikIsolated =
    samikCaps?.hasSupplyAllocation === false &&
    samikAvail?.supplyAllocation === 'source_not_available';
  results.push({
    itemNumber: 12,
    name: '삼익비치(samik-beach) hasSupplyAllocation=false, supplyAllocation="source_not_available" 격리 regression PASS',
    passed: samikIsolated,
    details: `samik hasSupplyAllocation: ${samikCaps?.hasSupplyAllocation}, availability: ${samikAvail?.supplyAllocation}`,
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

nodeTest('우동3 공급계획', () => {
  const report = runUdong3SupplyPlanSuite();
  const failed = report.results.filter((r) => !r.passed);
  nodeAssert.equal(failed.length, 0, JSON.stringify(failed, null, 2));
  nodeAssert.ok(report.total > 0 && report.passed === report.total, `passed ${report.passed}/${report.total}`);
});
