/**
 * Phase 4G-4: Samik Beach Interactive Site Plan Test Suite
 *
 * 검증 항목:
 * 1. 101동 ~ 108동 총 8개 주동 좌표가 모두 누락 없이 등록되었는지
 * 2. 101동 ~ 108동 건물의 normalizedX, normalizedY 좌표가 유효 범위(0 ~ 1) 및 실제 배치도 범위 내 존재하는지
 * 3. 8개 주동의 coordinateStatus가 모두 'verified'인지
 * 4. 8개 주동 좌표 간 최소 거리 검증 (인접 동 마커 중첩 없음)
 * 5. capabilities.hasInteractiveCoordinates === true
 * 6. capabilities.hasSitePlan === true
 * 7. availability.sitePlan === 'normalized'
 * 8. capabilities.hasBuildingMappings === false (불확실한 타입 매핑 추정 금지)
 * 9. availability.buildingMappings === 'source_not_available'
 * 10. sitePlan.totalBuildingsCount === 8
 * 11. buildings 배열에 101동 ~ 108동 8개 주동이 정확히 등록되었는지
 * 12. validateProjectPlanConfig(samikBeachPlanConfig) 유효성 검증 통과 (isValid === true)
 * 13. [Regression] 우동3(udong-3) 18개 주동 좌표 및 데이터 무결성 보존
 * 14. [Regression] 촉진3(chokjin-3) 좌표, 39개 타입, 비임대 3,365세대 데이터 무결성 보존
 * 15. 사업지 전환 시 선택 동 초기화 상태 검증 (hasBuildingMappings=false -> selectedDong = '')
 * 16. 확대/축소(zoomLevel 1x, 1.5x, 2x, 3x) 시 정규화 좌표 일관성 검증
 */

import { getProjectPlanConfig } from '../data/projects/planRegistry.ts';
import { validateProjectPlanConfig } from '../types/planConfig.ts';
import { CHOKJIN3_UNIT_TYPES } from '../data/chokjin3PlanData.ts';

export interface SamikBeachSitePlanTestResult {
  itemNumber: number;
  name: string;
  passed: boolean;
  details?: string;
}

export function runSamikBeachInteractiveSitePlanSuite(): {
  total: number;
  passed: number;
  results: SamikBeachSitePlanTestResult[];
} {
  const results: SamikBeachSitePlanTestResult[] = [];
  const samikConfig = getProjectPlanConfig('samik-beach');
  const udongConfig = getProjectPlanConfig('udong-3');
  const chokjinConfig = getProjectPlanConfig('chokjin-3');

  const EXPECTED_DONGS = [
    '101동', '102동', '103동', '104동',
    '105동', '106동', '107동', '108동'
  ];

  const coords = samikConfig?.coordinates || [];
  const bldgs = samikConfig?.buildings || [];

  // 1. 101동 ~ 108동 총 8개 주동 좌표 등록 검증
  const registeredDongs = coords.map((c) => c.buildingNumber);
  const all8Registered =
    coords.length === 8 &&
    EXPECTED_DONGS.every((dong) => registeredDongs.includes(dong));

  results.push({
    itemNumber: 1,
    name: '101동 ~ 108동 총 8개 주동 좌표 누락 없이 등록 검증',
    passed: all8Registered,
    details: `Registered: ${coords.length}/8 dongs (${registeredDongs.join(', ')})`,
  });

  // 2. normalizedX, normalizedY 유효 범위(0 ~ 1) 및 배치도 범위 검증
  const allCoordsInBounds = coords.every(
    (c) => c.normalizedX > 0.1 && c.normalizedX < 0.95 && c.normalizedY > 0.1 && c.normalizedY < 0.9
  );

  results.push({
    itemNumber: 2,
    name: '모든 주동 좌표 실제 배치도 정규화 범위(0.1 < x < 0.95, 0.1 < y < 0.9) 검증',
    passed: allCoordsInBounds && coords.length === 8,
    details: `allInBounds: ${allCoordsInBounds}`,
  });

  // 3. coordinateStatus === 'verified'
  const allVerified = coords.every((c) => c.coordinateStatus === 'verified');
  results.push({
    itemNumber: 3,
    name: "모든 주동 좌표 coordinateStatus === 'verified' 검증",
    passed: allVerified && coords.length === 8,
    details: `allVerified: ${allVerified}`,
  });

  // 4. 인접 동 마커 중첩 방지 (최소 거리 검증: W=966, H=365 기준)
  let minPixelDist = Infinity;
  let closestPair = '';
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const dx = (coords[i].normalizedX - coords[j].normalizedX) * 966;
      const dy = (coords[i].normalizedY - coords[j].normalizedY) * 365;
      const dist = Math.hypot(dx, dy);
      if (dist < minPixelDist) {
        minPixelDist = dist;
        closestPair = `${coords[i].buildingNumber} - ${coords[j].buildingNumber}`;
      }
    }
  }

  const noOverlap = minPixelDist >= 30;
  results.push({
    itemNumber: 4,
    name: '인접 주동 마커 최소 거리 검증 (30px 이상 이격으로 마커 중첩 방지)',
    passed: noOverlap,
    details: `Closest pair: ${closestPair}, dist: ${minPixelDist.toFixed(1)}px (threshold: >= 30px)`,
  });

  // 5. capabilities.hasInteractiveCoordinates === true
  results.push({
    itemNumber: 5,
    name: 'capabilities.hasInteractiveCoordinates === true',
    passed: samikConfig?.capabilities.hasInteractiveCoordinates === true,
    details: `hasInteractiveCoordinates: ${samikConfig?.capabilities.hasInteractiveCoordinates}`,
  });

  // 6. capabilities.hasSitePlan === true
  results.push({
    itemNumber: 6,
    name: 'capabilities.hasSitePlan === true',
    passed: samikConfig?.capabilities.hasSitePlan === true,
    details: `hasSitePlan: ${samikConfig?.capabilities.hasSitePlan}`,
  });

  // 7. availability.sitePlan === 'normalized'
  results.push({
    itemNumber: 7,
    name: "availability.sitePlan === 'normalized'",
    passed: samikConfig?.availability?.sitePlan === 'normalized',
    details: `availability.sitePlan: ${samikConfig?.availability?.sitePlan}`,
  });

  // 8. capabilities.hasBuildingMappings === true
  results.push({
    itemNumber: 8,
    name: 'capabilities.hasBuildingMappings === true (실제 배치도 기반 동별 타입 매핑 등록 완료)',
    passed: samikConfig?.capabilities.hasBuildingMappings === true,
    details: `hasBuildingMappings: ${samikConfig?.capabilities.hasBuildingMappings}`,
  });

  // 9. availability.buildingMappings === 'normalized'
  results.push({
    itemNumber: 9,
    name: "availability.buildingMappings === 'normalized'",
    passed: samikConfig?.availability?.buildingMappings === 'normalized',
    details: `availability.buildingMappings: ${samikConfig?.availability?.buildingMappings}`,
  });

  // 10. sitePlan.totalBuildingsCount === 8
  const sitePlan = samikConfig?.sitePlan;
  results.push({
    itemNumber: 10,
    name: 'sitePlan.totalBuildingsCount === 8',
    passed: sitePlan?.totalBuildingsCount === 8,
    details: `totalBuildingsCount: ${sitePlan?.totalBuildingsCount}`,
  });

  // 11. buildings 배열에 101동 ~ 108동 8개 주동 등록
  const bldgNumbers = bldgs.map((b) => b.buildingNumber);
  const allBldgsRegistered =
    bldgs.length === 8 &&
    EXPECTED_DONGS.every((dong) => bldgNumbers.includes(dong));

  results.push({
    itemNumber: 11,
    name: 'buildings 배열에 101동 ~ 108동 총 8개 주동 등록 검증',
    passed: allBldgsRegistered,
    details: `bldgs count: ${bldgs.length}/8`,
  });

  // 12. validateProjectPlanConfig 유효성 검증
  const validation = samikConfig ? validateProjectPlanConfig(samikConfig) : { isValid: false, errors: ['no config'] };
  results.push({
    itemNumber: 12,
    name: 'validateProjectPlanConfig(samikBeachPlanConfig) 유효성 검증 통과 (isValid === true)',
    passed: validation.isValid,
    details: `isValid: ${validation.isValid}, errors: [${validation.errors.join(', ')}]`,
  });

  // 13. [Regression] 우동3 데이터 무결성 보존
  const udongValid =
    !!udongConfig &&
    udongConfig.capabilities.hasInteractiveCoordinates === true &&
    (udongConfig.coordinates?.length ?? 0) === 18 &&
    (udongConfig.buildings?.length ?? 0) === 18;

  results.push({
    itemNumber: 13,
    name: '우동3(udong-3) 18개 주동 좌표 및 데이터 무결성 regression PASS',
    passed: udongValid,
    details: `udong coords: ${udongConfig?.coordinates?.length}, bldgs: ${udongConfig?.buildings?.length}`,
  });

  // 14. [Regression] 촉진3 데이터 무결성 보존
  const chokjinValid =
    !!chokjinConfig &&
    chokjinConfig.capabilities.hasInteractiveCoordinates === true &&
    chokjinConfig.capabilities.hasBuildingMappings === true &&
    (chokjinConfig.coordinates?.length ?? 0) > 0 &&
    (chokjinConfig.unitTypes?.length ?? 0) === 39 &&
    CHOKJIN3_UNIT_TYPES.length === 39 &&
    chokjinConfig.planVersion?.totalSupplySummary?.nonRentalUnits === 3365;

  results.push({
    itemNumber: 14,
    name: '촉진3(chokjin-3) 좌표·타입(39종)·세대수(3,365) regression PASS',
    passed: chokjinValid,
    details: `chokjin types: ${chokjinConfig?.unitTypes?.length}, nonRental: ${chokjinConfig?.planVersion?.totalSupplySummary?.nonRentalUnits}`,
  });

  // 15. 사업지 전환 시 선택 동 초기화 및 state isolation 검증
  const samikDefaultDong =
    (samikConfig?.capabilities.hasBuildingMappings && samikConfig?.buildings?.[0]?.buildingNumber) || '';
  const udongDefaultDong =
    (udongConfig?.capabilities.hasBuildingMappings && udongConfig?.buildings?.[0]?.buildingNumber) || '';
  const stateIsolationPass = samikDefaultDong === '101동' && udongDefaultDong === '101동';

  results.push({
    itemNumber: 15,
    name: "사업지 전환 시 선택 동 상태 격리 검증 (삼익비치 '101동', 우동3 '101동')",
    passed: stateIsolationPass,
    details: `samik: "${samikDefaultDong}", udong: "${udongDefaultDong}"`,
  });

  // 16. 확대/축소 시 정규화 좌표 일관성 검증
  const zoomLevels = [1, 1.5, 2, 3];
  const allZoomsConsistent = zoomLevels.every((zoom) => {
    return coords.every((c) => {
      const renderedX = c.normalizedX * 966 * zoom;
      const renderedY = c.normalizedY * 365 * zoom;
      return (
        Number.isFinite(renderedX) &&
        Number.isFinite(renderedY) &&
        renderedX > 0 &&
        renderedY > 0
      );
    });
  });

  results.push({
    itemNumber: 16,
    name: '확대/축소(zoomLevel 1x, 1.5x, 2x, 3x) 시 정규화 좌표 스케일링 일관성 검증',
    passed: allZoomsConsistent,
    details: `allZoomsConsistent: ${allZoomsConsistent}`,
  });

  // 17. [Phase 4G-5] 101동 ~ 108동 각각 실제 타입 연결 검증
  const allBldgsHaveTypes =
    bldgs.length === 8 &&
    bldgs.every((b) => b.unitTypesShown && b.unitTypesShown.length > 0);

  results.push({
    itemNumber: 17,
    name: '101~108동 8개 주동 전수 실제 타입 연결 검증 (unitTypesShown.length > 0)',
    passed: allBldgsHaveTypes,
    details: `All 8 buildings mapped: ${allBldgsHaveTypes}, counts: ${bldgs.map((b) => `${b.buildingNumber}(${b.unitTypesShown.length})`).join(', ')}`,
  });

  // 18. [Phase 4G-5] 존재하지 않는 typeCode 0건 검증
  const validSamikTypeCodes = new Set((samikConfig?.unitTypes || []).map((u) => u.typeCode));
  const invalidTypeCodes: string[] = [];
  bldgs.forEach((b) => {
    b.unitTypesShown.forEach((tc) => {
      if (!validSamikTypeCodes.has(tc)) {
        invalidTypeCodes.push(`${b.buildingNumber}:${tc}`);
      }
    });
  });

  results.push({
    itemNumber: 18,
    name: '배치도 매핑에 존재하지 않는 typeCode 0건 검증',
    passed: invalidTypeCodes.length === 0,
    details: `Invalid type codes: ${invalidTypeCodes.length} (${invalidTypeCodes.join(', ') || 'None'})`,
  });

  // 19. [Phase 4G-5] 19개 삼익비치 타입 전수 커버리지 검증
  const mappedTypeCodes = new Set<string>();
  bldgs.forEach((b) => {
    b.unitTypesShown.forEach((tc) => mappedTypeCodes.add(tc));
  });
  const all19TypesMapped =
    validSamikTypeCodes.size === 19 &&
    Array.from(validSamikTypeCodes).every((tc) => mappedTypeCodes.has(tc));

  results.push({
    itemNumber: 19,
    name: '기존 19개 삼익비치 typeCode 전수 배치도 매핑 커버리지 검증 (19/19)',
    passed: all19TypesMapped,
    details: `Mapped: ${mappedTypeCodes.size}/${validSamikTypeCodes.size} types`,
  });

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

nodeTest('삼익비치 인터랙티브 배치도', () => {
  const report = runSamikBeachInteractiveSitePlanSuite();
  const failed = report.results.filter((r) => !r.passed);
  nodeAssert.equal(failed.length, 0, JSON.stringify(failed, null, 2));
  nodeAssert.ok(report.total > 0 && report.passed === report.total, `passed ${report.passed}/${report.total}`);
});
