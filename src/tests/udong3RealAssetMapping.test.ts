/**
 * Phase 4G-1: Udong3 Real Site Plan & Unit Plan Mapping Test Suite
 *
 * 검증 항목 (Section 19 & Section 21):
 * 1. udong3 config가 registry에서 정상 로드되는지
 * 2. hasSitePlan === true
 * 3. hasUnitPlans === true
 * 4. hasInteractiveCoordinates === false
 * 5. sitePlan.assetPath === '/assets/plans/udong3/site-plan.jpg'
 * 6. 24개 타입 평면도가 모두 올바른 assetPath에 매핑되었는지
 * 7. 39㎡가 unit plan selector/types 목록에서 제외되었는지
 * 8. 39㎡ 121세대가 canonical/factual planVersion.excludedHousingTypes 데이터에 정상 보존되었는지
 * 9. udong3 capability 활성화가 samik-beach에 영향을 주지 않는지 (samik-beach는 여전히 partial)
 * 10. 촉진3의 39개 타입, 비임대 3,365세대 원본 데이터가 훼손되지 않았는지
 * 11. 84A -> 84a.jpg
 * 12. 84D1 -> 84d1.jpg
 * 13. 96A1 -> 96a1.jpg
 * 14. 154복A -> 154-1.jpg (1F), 154-2.jpg (2F)
 * 15. 155복B -> 155-1.jpg (1F), 155-2.jpg (2F)
 * 16. 171T -> 171t-1.jpg (1F), 171t-2.jpg (2F), 171t-b1.jpg (B1)
 * 17. 197P -> 197p.jpg
 * 18. 200P -> 200p.jpg
 * 19. 210 -> 210a.jpg
 * 20. 전체 asset 파일이 실제로 public/assets/plans/udong3/ 아래 존재하는지 (fs.existsSync 검증)
 */

import * as fs from 'fs';
import * as path from 'path';
import { getProjectPlanConfig } from '../data/projects/planRegistry.ts';
import { validateProjectPlanConfig } from '../types/planConfig.ts';
import { CHOKJIN3_UNIT_TYPES } from '../data/chokjin3PlanData.ts';

export interface Udong3MappingTestResult {
  itemNumber: number;
  name: string;
  passed: boolean;
  details?: string;
}

export function runUdong3RealAssetMappingSuite(): {
  total: number;
  passed: number;
  results: Udong3MappingTestResult[];
} {
  const results: Udong3MappingTestResult[] = [];
  const udongConfig = getProjectPlanConfig('udong-3');

  // 1. udong3 config registry 로드 검증
  results.push({
    itemNumber: 1,
    name: 'udong3 config가 registry에서 정상 로드되는지',
    passed: !!udongConfig && udongConfig.projectId === 'udong-3' && udongConfig.displayName === '우동3구역',
    details: `projectId: "${udongConfig?.projectId}", displayName: "${udongConfig?.displayName}"`,
  });

  // 2. hasSitePlan === true
  results.push({
    itemNumber: 2,
    name: 'hasSitePlan === true',
    passed: udongConfig?.capabilities.hasSitePlan === true,
    details: `hasSitePlan: ${udongConfig?.capabilities.hasSitePlan}`,
  });

  // 3. hasUnitPlans === true
  results.push({
    itemNumber: 3,
    name: 'hasUnitPlans === true',
    passed: udongConfig?.capabilities.hasUnitPlans === true,
    details: `hasUnitPlans: ${udongConfig?.capabilities.hasUnitPlans}`,
  });

  // 4. hasInteractiveCoordinates === true & 101~118동 18개 주동 실측 좌표 검증 (Phase 4G-3)
  const coords = udongConfig?.coordinates || [];
  const bldgs = udongConfig?.buildings || [];
  const coords18Valid =
    coords.length === 18 &&
    bldgs.length === 18 &&
    coords.every(
      (c) =>
        c.normalizedX > 0 &&
        c.normalizedX < 1 &&
        c.normalizedY > 0 &&
        c.normalizedY < 1 &&
        c.coordinateStatus === 'verified'
    );

  results.push({
    itemNumber: 4,
    name: 'hasInteractiveCoordinates === true & 101~118동 18개 주동 실측 좌표 검증',
    passed: udongConfig?.capabilities.hasInteractiveCoordinates === true && coords18Valid,
    details: `hasInteractiveCoordinates: ${udongConfig?.capabilities.hasInteractiveCoordinates}, coords count: ${coords.length}, bldgs count: ${bldgs.length}`,
  });

  // 5. sitePlan.assetPath === '/assets/plans/udong3/site-plan.jpg'
  results.push({
    itemNumber: 5,
    name: "sitePlan.assetPath === '/assets/plans/udong3/site-plan.jpg'",
    passed: udongConfig?.sitePlan?.assetPath === '/assets/plans/udong3/site-plan.jpg',
    details: `sitePlan.assetPath: "${udongConfig?.sitePlan?.assetPath}"`,
  });

  // 6. 24개 타입 평면도가 모두 올바른 assetPath에 매핑되었는지
  const EXPECTED_MAPPING: Record<string, string> = {
    '59': '59a.jpg',
    '74': '74a.jpg',
    '74P': '74p.jpg',
    '84A': '84a.jpg',
    '84B': '84b.jpg',
    '84C': '84c.jpg',
    '84D1': '84d1.jpg',
    '84D2': '84d2.jpg',
    '84E': '84e.jpg',
    '96A': '96a.jpg',
    '96A1': '96a1.jpg',
    '96B': '96b.jpg',
    '96C': '96c.jpg',
    '96D': '96d.jpg',
    '99P': '99p.jpg',
    '111': '111a.jpg',
    '126': '126a.jpg',
    '154복A': '154-1.jpg',
    '155복B': '155-1.jpg',
    '160': '160a.jpg',
    '171T': '171t-1.jpg',
    '197P': '197p.jpg',
    '200P': '200p.jpg',
    '210': '210a.jpg',
  };

  const unitTypes = udongConfig?.unitTypes || [];
  const typeCodes = unitTypes.map((u) => u.typeCode);
  const all24Mapped =
    Object.keys(EXPECTED_MAPPING).length === 24 &&
    unitTypes.length === 24 &&
    Object.entries(EXPECTED_MAPPING).every(([code, file]) => {
      const doc = unitTypes.find((u) => u.typeCode === code);
      return (
        doc !== undefined &&
        doc.sourceAsset?.originalFileName === file &&
        doc.sourceAsset?.assetPath === `/assets/plans/udong3/${file}`
      );
    });

  results.push({
    itemNumber: 6,
    name: '24개 타입 평면도가 모두 올바른 assetPath에 매핑되었는지',
    passed: all24Mapped,
    details: `mapped count: ${unitTypes.length}, expected: 24, allMatched: ${all24Mapped}`,
  });

  // 7. 39㎡가 unit plan selector/types 목록에서 제외되었는지
  const has39InSelectableTypes = typeCodes.includes('39') || typeCodes.includes('39㎡');
  const has39InAreaGroups = (udongConfig?.areaGroups || []).some(
    (g) => g.groupCode === '39' || g.types.includes('39')
  );

  results.push({
    itemNumber: 7,
    name: '39㎡가 unit plan selector/types 목록에서 제외되었는지 (UI 배제)',
    passed: !has39InSelectableTypes && !has39InAreaGroups,
    details: `inSelectable: ${has39InSelectableTypes}, inAreaGroups: ${has39InAreaGroups}`,
  });

  // 8. 39㎡ 121세대가 canonical/factual planVersion.excludedHousingTypes 데이터에 정상 보존되었는지
  const excludedTypes = udongConfig?.planVersion?.excludedHousingTypes || [];
  const canonical39 = excludedTypes.find((e) => e.typeCode === '39');
  const canonicalSummary = udongConfig?.planVersion?.totalSupplySummary;

  results.push({
    itemNumber: 8,
    name: '39㎡ 121세대가 canonical planVersion.excludedHousingTypes 에 보존되었는지',
    passed:
      canonical39 !== undefined &&
      canonical39.units === 121 &&
      canonical39.housingCategory === 'rental' &&
      canonical39.excludedFromUnitPlanUI === true &&
      canonicalSummary?.rentalUnits === 121,
    details: `canonical39 units: ${canonical39?.units}, rentalUnits: ${canonicalSummary?.rentalUnits}`,
  });

  // 9. udong3 capability 활성화와 samik-beach의 독립성 (상태 격리)
  const samikConfig = getProjectPlanConfig('samik-beach');
  const samikIsolated =
    !!samikConfig &&
    samikConfig.projectId === 'samik-beach' &&
    samikConfig.capabilities.hasBuildingMappings === true &&
    samikConfig.capabilities.hasInteractiveCoordinates === true &&
    samikConfig !== udongConfig &&
    samikConfig.buildings?.length === 8 &&
    udongConfig.buildings?.length === 18;

  results.push({
    itemNumber: 9,
    name: 'udong3 capability 활성화와 samik-beach의 독립성 (상태 격리)',
    passed: samikIsolated,
    details: `samik capabilities: ${JSON.stringify(samikConfig?.capabilities)}`,
  });

  // 10. 촉진3의 39개 타입, 비임대 3,365세대 원본 데이터가 훼손되지 않았는지
  const chokjinConfig = getProjectPlanConfig('chokjin-3');
  const chokjinTypesCount = chokjinConfig?.unitTypes?.length ?? 0;
  const chokjinTotalUnits = chokjinConfig?.planVersion?.totalSupplySummary?.nonRentalUnits;
  const chokjinUncorrupted =
    chokjinTypesCount === 39 &&
    chokjinTotalUnits === 3365 &&
    CHOKJIN3_UNIT_TYPES.length === 39;

  results.push({
    itemNumber: 10,
    name: '촉진3의 39개 타입, 비임대 3,365세대 원본 데이터 보존 검증',
    passed: chokjinUncorrupted,
    details: `chokjin types: ${chokjinTypesCount}, nonRental: ${chokjinTotalUnits}`,
  });

  // 11. 84A -> 84a.jpg
  const doc84A = unitTypes.find((u) => u.typeCode === '84A');
  results.push({
    itemNumber: 11,
    name: '84A -> 84a.jpg',
    passed: doc84A?.sourceAsset?.assetPath === '/assets/plans/udong3/84a.jpg',
    details: `84A assetPath: "${doc84A?.sourceAsset?.assetPath}"`,
  });

  // 12. 84D1 -> 84d1.jpg
  const doc84D1 = unitTypes.find((u) => u.typeCode === '84D1');
  results.push({
    itemNumber: 12,
    name: '84D1 -> 84d1.jpg',
    passed: doc84D1?.sourceAsset?.assetPath === '/assets/plans/udong3/84d1.jpg',
    details: `84D1 assetPath: "${doc84D1?.sourceAsset?.assetPath}"`,
  });

  // 13. 96A1 -> 96a1.jpg
  const doc96A1 = unitTypes.find((u) => u.typeCode === '96A1');
  results.push({
    itemNumber: 13,
    name: '96A1 -> 96a1.jpg',
    passed: doc96A1?.sourceAsset?.assetPath === '/assets/plans/udong3/96a1.jpg',
    details: `96A1 assetPath: "${doc96A1?.sourceAsset?.assetPath}"`,
  });

  // 14. 154복A -> 154-1.jpg (1F), 154-2.jpg (2F)
  const doc154 = unitTypes.find((u) => u.typeCode === '154복A');
  results.push({
    itemNumber: 14,
    name: '154복A -> 154-1.jpg (1F), 154-2.jpg (2F)',
    passed:
      doc154?.sourceAsset?.assetPath === '/assets/plans/udong3/154-1.jpg' &&
      doc154?.sourceAsset?.primaryAssetPath === '/assets/plans/udong3/154-1.jpg' &&
      doc154?.sourceAsset?.secondaryAssetPath === '/assets/plans/udong3/154-2.jpg' &&
      doc154?.sourceAsset?.isDuplex === true,
    details: `154복A primary: "${doc154?.sourceAsset?.primaryAssetPath}", secondary: "${doc154?.sourceAsset?.secondaryAssetPath}"`,
  });

  // 15. 155복B -> 155-1.jpg (1F), 155-2.jpg (2F)
  const doc155 = unitTypes.find((u) => u.typeCode === '155복B');
  results.push({
    itemNumber: 15,
    name: '155복B -> 155-1.jpg (1F), 155-2.jpg (2F)',
    passed:
      doc155?.sourceAsset?.assetPath === '/assets/plans/udong3/155-1.jpg' &&
      doc155?.sourceAsset?.primaryAssetPath === '/assets/plans/udong3/155-1.jpg' &&
      doc155?.sourceAsset?.secondaryAssetPath === '/assets/plans/udong3/155-2.jpg' &&
      doc155?.sourceAsset?.isDuplex === true,
    details: `155복B primary: "${doc155?.sourceAsset?.primaryAssetPath}", secondary: "${doc155?.sourceAsset?.secondaryAssetPath}"`,
  });

  // 16. 171T -> 171t-1.jpg (1F), 171t-2.jpg (2F), 171t-b1.jpg (B1)
  const doc171T = unitTypes.find((u) => u.typeCode === '171T');
  results.push({
    itemNumber: 16,
    name: '171T -> 171t-1.jpg (1F), 171t-2.jpg (2F), 171t-b1.jpg (B1)',
    passed:
      doc171T?.sourceAsset?.assetPath === '/assets/plans/udong3/171t-1.jpg' &&
      doc171T?.sourceAsset?.primaryAssetPath === '/assets/plans/udong3/171t-1.jpg' &&
      doc171T?.sourceAsset?.secondaryAssetPath === '/assets/plans/udong3/171t-2.jpg' &&
      doc171T?.sourceAsset?.tertiaryAssetPath === '/assets/plans/udong3/171t-b1.jpg' &&
      doc171T?.sourceAsset?.isDuplex === true,
    details: `171T primary: "${doc171T?.sourceAsset?.primaryAssetPath}", secondary: "${doc171T?.sourceAsset?.secondaryAssetPath}", tertiary: "${doc171T?.sourceAsset?.tertiaryAssetPath}"`,
  });

  // 17. 197P -> 197p.jpg
  const doc197P = unitTypes.find((u) => u.typeCode === '197P');
  results.push({
    itemNumber: 17,
    name: '197P -> 197p.jpg',
    passed: doc197P?.sourceAsset?.assetPath === '/assets/plans/udong3/197p.jpg',
    details: `197P assetPath: "${doc197P?.sourceAsset?.assetPath}"`,
  });

  // 18. 200P -> 200p.jpg
  const doc200P = unitTypes.find((u) => u.typeCode === '200P');
  results.push({
    itemNumber: 18,
    name: '200P -> 200p.jpg',
    passed: doc200P?.sourceAsset?.assetPath === '/assets/plans/udong3/200p.jpg',
    details: `200P assetPath: "${doc200P?.sourceAsset?.assetPath}"`,
  });

  // 19. 210 -> 210a.jpg
  const doc210 = unitTypes.find((u) => u.typeCode === '210');
  results.push({
    itemNumber: 19,
    name: '210 -> 210a.jpg',
    passed: doc210?.sourceAsset?.assetPath === '/assets/plans/udong3/210a.jpg',
    details: `210 assetPath: "${doc210?.sourceAsset?.assetPath}"`,
  });

  // 20. 전체 asset 파일이 실제로 public/assets/plans/udong3/ 아래 존재하는지 (fs.existsSync 검증)
  const requiredFiles = [
    'site-plan.jpg',
    '59a.jpg',
    '74a.jpg',
    '74p.jpg',
    '84a.jpg',
    '84b.jpg',
    '84c.jpg',
    '84d1.jpg',
    '84d2.jpg',
    '84e.jpg',
    '96a.jpg',
    '96a1.jpg',
    '96b.jpg',
    '96c.jpg',
    '96d.jpg',
    '99p.jpg',
    '111a.jpg',
    '126a.jpg',
    '154-1.jpg',
    '154-2.jpg',
    '155-1.jpg',
    '155-2.jpg',
    '160a.jpg',
    '171t-1.jpg',
    '171t-2.jpg',
    '171t-b1.jpg',
    '197p.jpg',
    '200p.jpg',
    '210a.jpg',
  ];

  const missingFiles: string[] = [];
  for (const f of requiredFiles) {
    const fullPath = path.resolve(process.cwd(), 'public/assets/plans/udong3', f);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(f);
    }
  }

  results.push({
    itemNumber: 20,
    name: '전체 asset 파일이 실제로 public/assets/plans/udong3/ 아래 존재하는지 (fs.existsSync)',
    passed: missingFiles.length === 0,
    details: missingFiles.length === 0 ? 'All 29 assets physically exist on disk' : `Missing: ${missingFiles.join(', ')}`,
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    results,
  };
}
