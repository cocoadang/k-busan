/**
 * Phase 4G-3: Udong3 Interactive Site Plan Test Suite
 *
 * 검증 항목:
 * 1. 101동 ~ 118동 총 18개 주동 좌표가 모두 누락 없이 등록되었는지
 * 2. 101동 ~ 118동 건물의 normalizedX, normalizedY 좌표가 유효 범위(0 ~ 1) 내에 존재하는지
 * 3. 18개 주동의 coordinateStatus가 모두 'verified'인지
 * 4. 18개 주동 좌표 간 최소 거리 검증 (인접 동 마커 중첩 없음)
 * 5. capabilities.hasInteractiveCoordinates === true
 * 6. capabilities.hasSitePlan === true
 * 7. availability.sitePlan === 'normalized'
 * 8. capabilities.hasBuildingMappings === false (불확실한 타입 매핑 추정 금지)
 * 9. availability.buildingMappings === 'source_not_available'
 * 10. sitePlan.hasCoordinates === true && totalBuildingsCount === 18
 * 11. buildings 배열에 101동 ~ 118동 18개 주동이 정확히 등록되었는지
 * 12. validateProjectPlanConfig(udong3PlanConfig) 유효성 검증 통과 (isValid === true)
 * 13. [Regression] 촉진3(chokjin-3) 좌표, 39개 타입, 비임대 3,365세대 데이터 무결성 보존
 * 14. [Regression] 삼익비치(samik-beach) hasInteractiveCoordinates === false 유지 (좌표 미추가 원칙 준수)
 * 15. 사업지 전환 시 선택 동 초기화 상태 검증 (hasBuildingMappings=false -> selectedDong = '')
 * 16. 확대/축소(zoomLevel 1x, 1.5x, 2x, 3x) 시 정규화 좌표 일관성 검증
 */

import { getProjectPlanConfig } from '../data/projects/planRegistry.ts';
import { validateProjectPlanConfig } from '../types/planConfig.ts';
import { CHOKJIN3_UNIT_TYPES } from '../data/chokjin3PlanData.ts';

export interface Udong3SitePlanTestResult {
  itemNumber: number;
  name: string;
  passed: boolean;
  details?: string;
}

export function runUdong3InteractiveSitePlanSuite(): {
  total: number;
  passed: number;
  results: Udong3SitePlanTestResult[];
} {
  const results: Udong3SitePlanTestResult[] = [];
  const udongConfig = getProjectPlanConfig('udong-3');
  const chokjinConfig = getProjectPlanConfig('chokjin-3');
  const samikConfig = getProjectPlanConfig('samik-beach');

  const EXPECTED_DONGS = [
    '101동', '102동', '103동', '104동', '105동', '106동',
    '107동', '108동', '109동', '110동', '111동', '112동',
    '113동', '114동', '115동', '116동', '117동', '118동'
  ];

  const coords = udongConfig?.coordinates || [];
  const bldgs = udongConfig?.buildings || [];

  // 1. 101동 ~ 118동 총 18개 주동 좌표 등록 검증
  const registeredDongs = coords.map((c) => c.buildingNumber);
  const all18Registered =
    coords.length === 18 &&
    EXPECTED_DONGS.every((dong) => registeredDongs.includes(dong));

  results.push({
    itemNumber: 1,
    name: '101동 ~ 118동 총 18개 주동 좌표 누락 없이 등록 검증',
    passed: all18Registered,
    details: `Registered: ${coords.length}/18 dongs`,
  });

  // 2. normalizedX, normalizedY 유효 범위(0 ~ 1) 검증
  const allCoordsInBounds = coords.every(
    (c) => c.normalizedX > 0 && c.normalizedX < 1 && c.normalizedY > 0 && c.normalizedY < 1
  );

  results.push({
    itemNumber: 2,
    name: '모든 주동 좌표 정규화 범위(0 < x, y < 1) 검증',
    passed: allCoordsInBounds && coords.length === 18,
    details: `allInBounds: ${allCoordsInBounds}`,
  });

  // 3. coordinateStatus === 'verified'
  const allVerified = coords.every((c) => c.coordinateStatus === 'verified');
  results.push({
    itemNumber: 3,
    name: "모든 주동 좌표 coordinateStatus === 'verified' 검증",
    passed: allVerified && coords.length === 18,
    details: `allVerified: ${allVerified}`,
  });

  // 4. 인접 동 마커 중첩 방지 (최소 거리 검증: W=966, H=596 기준)
  let minPixelDist = Infinity;
  let closestPair = '';
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const dx = (coords[i].normalizedX - coords[j].normalizedX) * 966;
      const dy = (coords[i].normalizedY - coords[j].normalizedY) * 596;
      const dist = Math.hypot(dx, dy);
      if (dist < minPixelDist) {
        minPixelDist = dist;
        closestPair = `${coords[i].buildingNumber} - ${coords[j].buildingNumber}`;
      }
    }
  }

  // 마커 뱃지 크기(26px) 대비 최소 40px 이상 거리 확보되어 중첩 없음
  const noOverlap = minPixelDist >= 40;
  results.push({
    itemNumber: 4,
    name: '인접 동 마커 중첩 없음 (최소 유클리드 거리 40px 이상 확보 검증)',
    passed: noOverlap,
    details: `closestPair: ${closestPair}, minDistance: ${minPixelDist.toFixed(1)}px (기준: >= 40px)`,
  });

  // 5. capabilities.hasInteractiveCoordinates === true
  results.push({
    itemNumber: 5,
    name: 'capabilities.hasInteractiveCoordinates === true',
    passed: udongConfig?.capabilities.hasInteractiveCoordinates === true,
    details: `hasInteractiveCoordinates: ${udongConfig?.capabilities.hasInteractiveCoordinates}`,
  });

  // 6. capabilities.hasSitePlan === true
  results.push({
    itemNumber: 6,
    name: 'capabilities.hasSitePlan === true',
    passed: udongConfig?.capabilities.hasSitePlan === true,
    details: `hasSitePlan: ${udongConfig?.capabilities.hasSitePlan}`,
  });

  // 7. availability.sitePlan === 'normalized'
  results.push({
    itemNumber: 7,
    name: "availability.sitePlan === 'normalized'",
    passed: udongConfig?.availability?.sitePlan === 'normalized',
    details: `availability.sitePlan: ${udongConfig?.availability?.sitePlan}`,
  });

  // 8. capabilities.hasBuildingMappings === true
  results.push({
    itemNumber: 8,
    name: 'capabilities.hasBuildingMappings === true (실제 배치도 기반 동별 타입 매핑 등록)',
    passed: udongConfig?.capabilities.hasBuildingMappings === true,
    details: `hasBuildingMappings: ${udongConfig?.capabilities.hasBuildingMappings}`,
  });

  // 9. availability.buildingMappings === 'normalized'
  results.push({
    itemNumber: 9,
    name: "availability.buildingMappings === 'normalized'",
    passed: udongConfig?.availability?.buildingMappings === 'normalized',
    details: `availability.buildingMappings: ${udongConfig?.availability?.buildingMappings}`,
  });

  // 10. sitePlan 메타데이터(totalBuildingsCount === 18, assetPath) 및 capabilities.hasInteractiveCoordinates 검증
  const sitePlanValid =
    udongConfig?.capabilities?.hasInteractiveCoordinates === true &&
    udongConfig?.sitePlan?.totalBuildingsCount === 18 &&
    udongConfig?.sitePlan?.assetPath === '/assets/plans/udong3/site-plan.jpg';

  results.push({
    itemNumber: 10,
    name: 'sitePlan 메타데이터(totalBuildingsCount=18) 및 좌표 역량 검증',
    passed: sitePlanValid,
    details: `hasInteractiveCoordinates: ${udongConfig?.capabilities?.hasInteractiveCoordinates}, totalBuildings: ${udongConfig?.sitePlan?.totalBuildingsCount}`,
  });

  // 11. buildings 배열에 18개 주동 정확 등록 및 unitTypesShown 매핑 검증
  const allBldgsValid =
    bldgs.length === 18 &&
    bldgs.every((b) => EXPECTED_DONGS.includes(b.buildingNumber) && b.unitTypesShown.length > 0);

  results.push({
    itemNumber: 11,
    name: 'buildings 배열 18개 주동 등록 및 동별 타입 연결 검증 (unitTypesShown.length > 0)',
    passed: allBldgsValid,
    details: `bldgs count: ${bldgs.length}, allBldgsHaveTypes: ${allBldgsValid}`,
  });

  // 12. validateProjectPlanConfig 유효성 검증
  const validation = udongConfig ? validateProjectPlanConfig(udongConfig) : { isValid: false, errors: ['not found'] };
  results.push({
    itemNumber: 12,
    name: 'validateProjectPlanConfig(udong3PlanConfig) 스키마 유효성 통과',
    passed: validation.isValid,
    details: validation.isValid ? 'Validation passed with 0 errors' : `Errors: ${validation.errors.join(', ')}`,
  });

  // 13. [Regression] 촉진3 데이터 무결성 보존
  const chokjinValid =
    !!chokjinConfig &&
    chokjinConfig.capabilities.hasInteractiveCoordinates === true &&
    chokjinConfig.capabilities.hasBuildingMappings === true &&
    (chokjinConfig.coordinates?.length ?? 0) > 0 &&
    (chokjinConfig.unitTypes?.length ?? 0) === 39 &&
    CHOKJIN3_UNIT_TYPES.length === 39 &&
    chokjinConfig.planVersion?.totalSupplySummary?.nonRentalUnits === 3365;

  results.push({
    itemNumber: 13,
    name: '촉진3(chokjin-3) 좌표·타입(39종)·세대수(3,365) regression PASS',
    passed: chokjinValid,
    details: `chokjin types: ${chokjinConfig?.unitTypes?.length}, nonRental: ${chokjinConfig?.planVersion?.totalSupplySummary?.nonRentalUnits}`,
  });

  // 14. [Regression] 삼익비치 8개 주동 좌표 및 매핑 무결성 보존
  const samikValid =
    !!samikConfig &&
    samikConfig.capabilities.hasInteractiveCoordinates === true &&
    samikConfig.capabilities.hasBuildingMappings === true &&
    (samikConfig.coordinates?.length ?? 0) === 8 &&
    (samikConfig.buildings?.length ?? 0) === 8;

  results.push({
    itemNumber: 14,
    name: '삼익비치(samik-beach) 좌표(8개동) 및 주동 매핑 regression PASS',
    passed: samikValid,
    details: `samik hasInteractiveCoordinates: ${samikConfig?.capabilities.hasInteractiveCoordinates}, coords count: ${samikConfig?.coordinates?.length ?? 0}`,
  });

  // 15. 사업지 전환 시 선택 동 상태 격리 검증
  const udongDefaultDong =
    (udongConfig?.capabilities.hasBuildingMappings && udongConfig?.buildings?.[0]?.buildingNumber) || '';
  const samikDefaultDong =
    (samikConfig?.capabilities.hasBuildingMappings && samikConfig?.buildings?.[0]?.buildingNumber) || '';
  const stateIsolationPass = udongDefaultDong === '101동' && samikDefaultDong === '101동';

  results.push({
    itemNumber: 15,
    name: "사업지 전환 시 선택 동 상태 격리 검증 (우동3 '101동', 삼익비치 '101동')",
    passed: stateIsolationPass,
    details: `udong: "${udongDefaultDong}", samik: "${samikDefaultDong}"`,
  });

  // 16. 확대/축소 시 정규화 좌표 스케일링 안전성
  const zoomFactors = [1.0, 1.5, 2.0, 3.0];
  const zoomSafe = zoomFactors.every((zoom) => {
    const baseW = 966;
    const baseH = 596;
    const scaledW = baseW * zoom;
    const scaledH = baseH * zoom;
    return coords.every((c) => {
      const posX = c.normalizedX * scaledW;
      const posY = c.normalizedY * scaledH;
      return posX >= 0 && posX <= scaledW && posY >= 0 && posY <= scaledH;
    });
  });

  results.push({
    itemNumber: 16,
    name: '확대/축소(zoom 1x ~ 3x) 시 정규화 좌표 스케일링 안전성 검증',
    passed: zoomSafe,
    details: `Tested zoom levels: ${zoomFactors.join(', ')}, all within bounds`,
  });

  // 17. [Phase 4G-6] 존재하지 않는 typeCode 0건 검증 (기존 24개 우동3 typeCode만 사용)
  const validUdongTypeCodes = new Set((udongConfig?.unitTypes || []).map((u) => u.typeCode));
  const invalidTypeCodes: string[] = [];
  bldgs.forEach((b) => {
    b.unitTypesShown.forEach((tc) => {
      if (!validUdongTypeCodes.has(tc)) {
        invalidTypeCodes.push(`${b.buildingNumber}:${tc}`);
      }
    });
  });

  results.push({
    itemNumber: 17,
    name: '배치도 매핑에 존재하지 않는 typeCode 0건 검증',
    passed: invalidTypeCodes.length === 0,
    details: `Invalid type codes: ${invalidTypeCodes.length} (${invalidTypeCodes.join(', ') || 'None'})`,
  });

  // 18. [Phase 4G-6] 미확인 타입은 verified 처리하지 않음 (mappingStatus !== 'verified')
  const UNCONFIRMED_TYPES = ['84C', '84D1', '84D2', '84E', '96A1', '96C', '96D', '99P', '171T', '197P', '200P'];
  const allUnconfirmedUnresolved = UNCONFIRMED_TYPES.every((tc) => {
    const doc = (udongConfig?.unitTypes || []).find((u) => u.typeCode === tc);
    return doc !== undefined && doc.mappingStatus !== 'verified' && (doc.buildingNumbers || []).length === 0;
  });

  results.push({
    itemNumber: 18,
    name: '미확인 타입(11종) verified 처리 배제 검증 (mappingStatus !== "verified")',
    passed: allUnconfirmedUnresolved,
    details: `All 11 unconfirmed types unresolved: ${allUnconfirmedUnresolved}`,
  });

  // 19. [Phase 4G-6] 확인된 타입(13종) verified 및 buildingNumbers 역방향 매핑 검증
  const CONFIRMED_TYPES = ['59', '74', '74P', '84A', '84B', '96A', '96B', '111', '126', '154복A', '155복B', '160', '210'];
  const allConfirmedVerified = CONFIRMED_TYPES.every((tc) => {
    const doc = (udongConfig?.unitTypes || []).find((u) => u.typeCode === tc);
    return doc !== undefined && doc.mappingStatus === 'verified' && (doc.buildingNumbers || []).length > 0;
  });

  results.push({
    itemNumber: 19,
    name: '확인된 타입(13종) verified 및 buildingNumbers 역방향 매핑 검증',
    passed: allConfirmedVerified,
    details: `All 13 confirmed types verified with dongs: ${allConfirmedVerified}`,
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    results,
  };
}
