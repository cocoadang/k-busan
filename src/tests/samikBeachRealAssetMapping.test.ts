/**
 * 삼익비치(남천2구역) 실물 에셋 매핑 및 기능 검증 테스트 스위트
 * Phase 4G-2: Samik Beach Real Asset Mapping Audit Suite
 *
 * 검증 항목:
 * 1. 삼익비치 배치도 연결 (site-plan.png) 및 hasSitePlan=true, availability.sitePlan='normalized'
 * 2. hasInteractiveCoordinates=false, hasBuildingMappings=false (좌표/동배치 미생성 원칙)
 * 3. 업로드된 19개 타입 평면도 실제 assetPath 매핑 및 hasUnitPlans=true, availability.unitPlans='normalized'
 * 4. 복층/단층 에셋 무결성: availableFloors의 모든 층에 실제 에셋 존재 (누락 0건)
 * 5. 다중 타입 비교 활성화 (hasUnitComparison=true, availability.unitComparison='normalized')
 * 6. Evidence 출처 구조: assetVerificationStatus='verified', metadataVerificationStatus='unverified'
 * 7. 공급세대수 임의 추정 금지 (units: 0)
 * 8. 20개 실물 에셋(배치도 1 + 평면도 19) 디스크 실재성 (fs.existsSync)
 * 9. 빈 문자열("") 또는 null 이미지 경로 0건
 * 10. validateProjectPlanConfig 검증 유효성 100% PASS
 */

import * as fs from 'fs';
import * as path from 'path';
import { getProjectPlanConfig } from '../data/projects/planRegistry.ts';
import { validateProjectPlanConfig } from '../types/planConfig.ts';

export interface SamikBeachAuditResult {
  itemNumber: number;
  name: string;
  passed: boolean;
  details: string;
}

export interface SamikBeachAuditSuiteReport {
  total: number;
  passed: number;
  results: SamikBeachAuditResult[];
}

export function runSamikBeachRealAssetMappingSuite(): SamikBeachAuditSuiteReport {
  const results: SamikBeachAuditResult[] = [];
  const samikConfig = getProjectPlanConfig('samik-beach');

  // 1. 삼익비치 config 등록 및 기본 식별자 검증
  results.push({
    itemNumber: 1,
    name: '삼익비치 config 등록 및 식별자(samik-beach)',
    passed:
      !!samikConfig &&
      samikConfig.projectId === 'samik-beach' &&
      samikConfig.displayName === '삼익비치',
    details: `projectId: "${samikConfig?.projectId}", displayName: "${samikConfig?.displayName}"`,
  });

  // 2. 배치도 에셋 연결 및 capabilities/availability
  const sitePlan = samikConfig?.sitePlan;
  results.push({
    itemNumber: 2,
    name: '배치도(site-plan.png) 연결 및 hasSitePlan=true, availability="normalized"',
    passed:
      samikConfig?.capabilities.hasSitePlan === true &&
      samikConfig?.availability?.sitePlan === 'normalized' &&
      sitePlan?.assetPath === '/assets/plans/samikBeach/site-plan.png',
    details: `hasSitePlan: ${samikConfig?.capabilities.hasSitePlan}, assetPath: "${sitePlan?.assetPath}"`,
  });

  // 3. Phase 4G-5: 인터랙티브 좌표 활성화 및 주동 매핑 등록 (hasInteractiveCoordinates=true, hasBuildingMappings=true)
  results.push({
    itemNumber: 3,
    name: '인터랙티브 좌표 활성화 및 주동 매핑 등록 (hasInteractiveCoordinates=true, hasBuildingMappings=true)',
    passed:
      samikConfig?.capabilities.hasInteractiveCoordinates === true &&
      samikConfig?.capabilities.hasBuildingMappings === true &&
      samikConfig?.availability?.buildingMappings === 'normalized' &&
      (samikConfig?.coordinates || []).length === 8 &&
      (samikConfig?.buildings || []).length === 8,
    details: `interactiveCoords: ${samikConfig?.capabilities.hasInteractiveCoordinates}, buildingMappings: ${samikConfig?.capabilities.hasBuildingMappings}, coords count: ${(samikConfig?.coordinates || []).length}, buildings: ${(samikConfig?.buildings || []).length}`,
  });

  // 4. 단위세대 평면도 기능 활성화 및 정규화
  results.push({
    itemNumber: 4,
    name: '단위세대 평면도 활성화 (hasUnitPlans=true, availability.unitPlans="normalized")',
    passed:
      samikConfig?.capabilities.hasUnitPlans === true &&
      samikConfig?.availability?.unitPlans === 'normalized',
    details: `hasUnitPlans: ${samikConfig?.capabilities.hasUnitPlans}, availability: "${samikConfig?.availability?.unitPlans}"`,
  });

  // 5. 타입 비교 활성화 (hasUnitComparison=true, availability.unitComparison="normalized")
  results.push({
    itemNumber: 5,
    name: '타입 비교 활성화 (hasUnitComparison=true, availability.unitComparison="normalized")',
    passed:
      samikConfig?.capabilities.hasUnitComparison === true &&
      samikConfig?.availability?.unitComparison === 'normalized',
    details: `hasUnitComparison: ${samikConfig?.capabilities.hasUnitComparison}`,
  });

  // 6. 업로드된 19개 평면도 타입 전체 매핑 검증
  const EXPECTED_TYPES: Record<string, string> = {
    '60A': '60a.jpg',
    '84A': '84a.jpg',
    '84B': '84b.jpg',
    '84C': '84c.jpg',
    '84D': '84d.jpg',
    '96A': '96a.jpg',
    '96B': '96b.jpg',
    '114A': '114a.jpg',
    '119A': '119a.jpg',
    '145A': '145a.png',
    '158PA': '158pa.png',
    '169A': '169a.png',
    '175PA': '175pa.png',
    '182PA': '182pa.png',
    '188PA': '188pa.png',
    '208PA': '208pa.png',
    '219PA': '219pa.png',
    '219PB': '219pb.png',
    '244PA': '244pa.png',
  };

  const unitTypes = samikConfig?.unitTypes || [];
  const all19Mapped =
    Object.keys(EXPECTED_TYPES).length === 19 &&
    unitTypes.length === 19 &&
    Object.entries(EXPECTED_TYPES).every(([code, file]) => {
      const doc = unitTypes.find((u) => u.typeCode === code);
      return (
        doc !== undefined &&
        doc.sourceAsset?.originalFileName === file &&
        doc.sourceAsset?.assetPath === `/assets/plans/samikBeach/${file}` &&
        doc.sourceAsset?.primaryAssetPath === `/assets/plans/samikBeach/${file}`
      );
    });

  results.push({
    itemNumber: 6,
    name: '19개 단위세대 평면도가 모두 올바른 assetPath에 매핑되었는지',
    passed: all19Mapped,
    details: `mapped count: ${unitTypes.length}, expected: 19, allMatched: ${all19Mapped}`,
  });

  // 7. 실물 에셋 파일 20개(배치도 1 + 평면도 19)가 디스크에 물리적으로 존재하는지 (fs.existsSync)
  const requiredFiles = ['site-plan.png', ...Object.values(EXPECTED_TYPES)];
  const missingFiles: string[] = [];
  for (const f of requiredFiles) {
    const fullPath = path.resolve(process.cwd(), 'public/assets/plans/samikBeach', f);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(f);
    }
  }

  results.push({
    itemNumber: 7,
    name: '20개 에셋 파일이 실제로 public/assets/plans/samikBeach/ 아래 존재하는지',
    passed: missingFiles.length === 0,
    details: missingFiles.length === 0 ? 'All 20 assets physically exist on disk' : `Missing: ${missingFiles.join(', ')}`,
  });

  // 8. 빈 경로("") 또는 누락된 이미지 경로 0건 검증
  const hasEmptyOrMissingPaths = unitTypes.some(
    (u) =>
      !u.sourceAsset ||
      !u.sourceAsset.primaryAssetPath ||
      u.sourceAsset.primaryAssetPath.trim() === '' ||
      !u.sourceAsset.assetPath ||
      u.sourceAsset.assetPath.trim() === ''
  );

  results.push({
    itemNumber: 8,
    name: '평면도 이미지 빈 문자열("") 또는 누락 경로 0건',
    passed: !hasEmptyOrMissingPaths,
    details: hasEmptyOrMissingPaths ? 'Found empty image path' : 'All 19 types have valid non-empty paths',
  });

  // 9. 펜트하우스 타입(specialFeatures: ['펜트하우스']) 정확성
  const penthouseCodes = ['158PA', '175PA', '182PA', '188PA', '208PA', '219PA', '219PB', '244PA'];
  const penthousesCorrect = penthouseCodes.every((code) => {
    const doc = unitTypes.find((u) => u.typeCode === code);
    return doc?.specialFeatures?.includes('펜트하우스');
  });

  results.push({
    itemNumber: 9,
    name: '펜트하우스 8개 타입 특성 태그("펜트하우스") 확인',
    passed: penthousesCorrect,
    details: `penthouses checked: ${penthouseCodes.length}, allTagged: ${penthousesCorrect}`,
  });

  // 10. Evidence 구조 검증 (assetVerificationStatus='verified', metadataVerificationStatus='unverified')
  const evidenceSources = samikConfig?.evidenceSources || [];
  const evidenceValid =
    evidenceSources.length >= 2 &&
    evidenceSources.every(
      (e) =>
        e.assetVerificationStatus === 'verified' &&
        e.metadataVerificationStatus === 'unverified' &&
        e.sourceType === 'user-supplied'
    );

  results.push({
    itemNumber: 10,
    name: 'Evidence 검증 상태 (asset: verified, metadata: unverified, sourceType: user-supplied)',
    passed: evidenceValid,
    details: `evidence count: ${evidenceSources.length}, allValid: ${evidenceValid}`,
  });

  // 11. 공급세대수 추정 금지 (units: 0 유지)
  const zeroSupplyPreserved =
    unitTypes.every((u) => u.units === 0) &&
    samikConfig?.planVersion?.totalUnitsInPlanSet === 0;

  results.push({
    itemNumber: 11,
    name: '공급 세대수 임의 추정 금지 (units=0 유지)',
    passed: zeroSupplyPreserved,
    details: `all units 0: ${zeroSupplyPreserved}`,
  });

  // 12. Area Groups 정합성 (14개 그룹, 모든 타입 매핑)
  const areaGroups = samikConfig?.areaGroups || [];
  const allGroupTypesMapped =
    areaGroups.length === 14 &&
    areaGroups.reduce((acc, g) => acc + (g.types?.length || 0), 0) === 19;

  results.push({
    itemNumber: 12,
    name: '14개 면적 그룹 정합성 (19개 타입 전원 포함)',
    passed: allGroupTypesMapped,
    details: `areaGroups count: ${areaGroups.length}, totalTypesInGroups: ${areaGroups.reduce((acc, g) => acc + (g.types?.length || 0), 0)}`,
  });

  // 13. validateProjectPlanConfig 유효성 검사 (0 errors)
  const validation = validateProjectPlanConfig(samikConfig!);
  results.push({
    itemNumber: 13,
    name: 'validateProjectPlanConfig 종합 감사 통과 (0 errors)',
    passed: validation.isValid && validation.errors.length === 0,
    details: validation.isValid ? 'Validation passed with 0 errors' : `Errors: ${validation.errors.join(', ')}`,
  });

  // 14. 복층/다층 floors[] 공통 구조 검증 (우동3 확장 규격 준수)
  const allHaveFloors = unitTypes.every((u) => {
    const floors = u.sourceAsset?.floors;
    return (
      Array.isArray(floors) &&
      floors.length > 0 &&
      floors.every(
        (f) =>
          typeof f.floorId === 'string' &&
          f.floorId.length > 0 &&
          typeof f.label === 'string' &&
          f.label.length > 0 &&
          typeof f.assetPath === 'string' &&
          f.assetPath.startsWith('/assets/plans/samikBeach/')
      )
    );
  });

  results.push({
    itemNumber: 14,
    name: '우동3 확장 floors[] 공통 구조 탑재 및 각 층 asset 연결 검증',
    passed: allHaveFloors,
    details: allHaveFloors
      ? 'All 19 types have valid floors[] array conforming to multi-project schema'
      : 'Some types lack valid floors[] structure',
  });

  // 15. floors[] 내 모든 층별 에셋 파일 디스크 실재성 (fs.existsSync)
  let allFloorAssetsExist = true;
  const missingFloorAssets: string[] = [];
  for (const u of unitTypes) {
    for (const f of u.sourceAsset?.floors || []) {
      const diskPath = path.resolve(process.cwd(), 'public', f.assetPath.replace(/^\//, ''));
      if (!fs.existsSync(diskPath)) {
        allFloorAssetsExist = false;
        missingFloorAssets.push(`${u.typeCode}:${f.floorId}:${f.assetPath}`);
      }
    }
  }

  results.push({
    itemNumber: 15,
    name: 'floors[] 내 모든 층별 에셋 실제 파일 디스크 실재성 검증',
    passed: allFloorAssetsExist,
    details: allFloorAssetsExist
      ? 'All floor assets in floors[] physically exist on disk'
      : `Missing floor assets: ${missingFloorAssets.join(', ')}`,
  });

  // 16. 촉진3 / 우동3 정합성 및 regression 방지 검증
  const chokjinConfig = getProjectPlanConfig('chokjin-3');
  const udongConfig = getProjectPlanConfig('udong-3');
  const chokjinValid = chokjinConfig ? validateProjectPlanConfig(chokjinConfig).isValid : false;
  const udongValid = udongConfig ? validateProjectPlanConfig(udongConfig).isValid : false;

  results.push({
    itemNumber: 16,
    name: '촉진3·우동3 데이터 비침범 및 regression PASS 검증',
    passed:
      chokjinValid &&
      udongValid &&
      chokjinConfig?.capabilities.hasSitePlan === true &&
      chokjinConfig?.capabilities.hasInteractiveCoordinates === true &&
      udongConfig?.capabilities.hasSitePlan === true &&
      udongConfig?.capabilities.hasInteractiveCoordinates === true,
    details: `chokjinValid: ${chokjinValid}, udongValid: ${udongValid}`,
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    results,
  };
}
