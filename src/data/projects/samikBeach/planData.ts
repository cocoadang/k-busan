/**
 * 남천2구역(삼익비치) 단지계획 및 단위세대 평면 데이터
 * Phase 4G-2: Samik Beach Real Site Plan & Unit Plan Mapping
 *
 * 엄격한 준수 원칙:
 * 1. 사용자가 직접 확인 및 업로드한 19개 타입 평면도 및 배치도 실물 에셋 매핑:
 *    - 60A (60a.jpg)
 *    - 84A (84a.jpg), 84B (84b.jpg), 84C (84c.jpg), 84D (84d.jpg)
 *    - 96A (96a.jpg), 96B (96b.jpg)
 *    - 114A (114a.jpg)
 *    - 119A (119a.jpg)
 *    - 145A (145a.png)
 *    - 158PA (158pa.png, 펜트하우스)
 *    - 169A (169a.png)
 *    - 175PA (175pa.png, 펜트하우스)
 *    - 182PA (182pa.png, 펜트하우스)
 *    - 188PA (188pa.png, 펜트하우스)
 *    - 208PA (208pa.png, 펜트하우스)
 *    - 219PA (219pa.png, 펜트하우스), 219PB (219pb.png, 펜트하우스)
 *    - 244PA (244pa.png, 펜트하우스)
 * 2. 배치도: site-plan.png 연결 (hasSitePlan: true, hasInteractiveCoordinates: false).
 * 3. 공급 세대수 추정 금지 (공식 인허가 자료 교차 검증 전까지 units: 0 유지).
 * 4. Evidence: assetVerificationStatus='verified', metadataVerificationStatus='unverified'.
 */

import {
  FirestorePlanVersionDoc,
  FirestoreUnitTypeDoc,
  FirestoreSitePlanDoc,
  FirestoreBuildingDoc,
} from '../../../schema/firestoreSchema.ts';
import type { AreaGroupDefinition, SitePlanCoordinate } from '../../chokjin3PlanData.ts';

export const SAMIK_BEACH_PLAN_VERSION: FirestorePlanVersionDoc = {
  planVersionId: 'samik-beach-plan-user-supplied-v1',
  projectId: 'samik-beach',
  versionName: '남천2구역(삼익비치) 그랑자이 더 비치 단위세대 평면 및 배치도 (사용자 제공안)',
  sourceType: 'user-supplied',
  sourceName: '남천2구역(삼익비치) 주택재건축정비사업 단위세대 도면 자료 (사용자 직접 확보)',
  documentTitle: '남천2구역(삼익비치) 단위세대 평면도 및 단지배치도',
  publishedDate: null,
  sourceDate: null,
  confirmationStatus: 'proposal',
  verificationStatus: 'unverified',
  isCurrentKnownVersion: true,
  supersededBy: null,
  totalUnitsInPlanSet: 0,
  discrepancyNotice:
    '공식 사업시행계획변경인가(수영구 고시 제2026-71호) 기준 단지 총 세대수는 3,060세대(1:1 재건축, 조합원 3,060세대, 임대 0세대, 일반분양 0세대)이나, 19개 신규 단위세대 평면도상 세부 공급 세대수는 관리처분계획인가 전 단계로 공식 미확인 상태입니다.',
  versionNotice:
    '수영구 고시 제2026-71호 기준 총 3,060세대 인가 완료. 19개 타입 세부 세대수는 관리처분계획인가 확정 전으로 미기재(0세대 표기) 상태입니다.',
  totalUnitTypesCount: 19,
  layoutPlanAssetId: 'asset-samikbeach-site-plan',
  sitePlanAssetId: 'samik-beach-site-plan-user-supplied-v1',
  evidenceSourceId: 'samikbeach-unit-plans-user-supplied-v1',
  excludedHousingTypes: [],
  totalSupplySummary: {
    totalUnits: 0,
    nonRentalUnits: 0,
    rentalUnits: 0,
    memberUnits: 0,
    reservedUnits: 0,
    generalSaleUnits: 0,
    evidenceSourceId: 'samikbeach-unit-plans-user-supplied-v1',
  },
  createdAt: '2026-09-18T00:00:00.000Z',
  verifiedAt: '2026-09-18T00:00:00.000Z',
};

export const SAMIK_BEACH_SITE_PLAN: FirestoreSitePlanDoc = {
  sitePlanId: 'samik-beach-site-plan-user-supplied-v1',
  projectId: 'samik-beach',
  assetPath: '/assets/plans/samikBeach/site-plan.png',
  sourceType: 'user-supplied',
  confirmationStatus: 'proposal',
  verificationStatus: 'unverified',
  isCurrentKnownVersion: true,
  title: '남천2구역(삼익비치) 재건축 단지 전체 배치도',
  versionNotice: '사용자 제공 배치도 기준이며 공식 사업시행계획인가 자료 교차 검증 전까지 세부 배치는 미확정 상태입니다.',
  totalBuildingsCount: 8,
  totalUnitTypesMapped: 0,
  evidenceSourceId: 'samikbeach-site-plan-user-supplied-v1',
  uploadedAt: '2026-09-18T00:00:00Z',
  verifiedAt: '2026-09-18T00:00:00Z',
};

export const SAMIK_BEACH_AREA_GROUPS: AreaGroupDefinition[] = [
  { groupCode: '60', name: '60㎡', totalUnits: 1, types: ['60A'] },
  { groupCode: '84', name: '84㎡', totalUnits: 4, types: ['84A', '84B', '84C', '84D'] },
  { groupCode: '96', name: '96㎡', totalUnits: 2, types: ['96A', '96B'] },
  { groupCode: '114', name: '114㎡', totalUnits: 1, types: ['114A'] },
  { groupCode: '119', name: '119㎡', totalUnits: 1, types: ['119A'] },
  { groupCode: '145', name: '145㎡', totalUnits: 1, types: ['145A'] },
  { groupCode: '158', name: '158㎡', totalUnits: 1, types: ['158PA'] },
  { groupCode: '169', name: '169㎡', totalUnits: 1, types: ['169A'] },
  { groupCode: '175', name: '175㎡', totalUnits: 1, types: ['175PA'] },
  { groupCode: '182', name: '182㎡', totalUnits: 1, types: ['182PA'] },
  { groupCode: '188', name: '188㎡', totalUnits: 1, types: ['188PA'] },
  { groupCode: '208', name: '208㎡', totalUnits: 1, types: ['208PA'] },
  { groupCode: '219', name: '219㎡', totalUnits: 2, types: ['219PA', '219PB'] },
  { groupCode: '244', name: '244㎡', totalUnits: 1, types: ['244PA'] },
];

interface SamikBeachRawType {
  typeCode: string;
  areaGroup: string;
  fileName: string;
  secondaryFileName?: string;
  tertiaryFileName?: string;
  floor1Label?: string;
  floor2Label?: string;
  floor3Label?: string;
  floors?: Array<{
    floorId: string;
    label: string;
    fileName: string;
    assetPath: string;
  }>;
  specialFeatures?: string[];
  isDuplex?: boolean;
}

const RAW_SAMIK_BEACH_TYPES: SamikBeachRawType[] = [
  { typeCode: '60A', areaGroup: '60', fileName: '60a.jpg' },
  { typeCode: '84A', areaGroup: '84', fileName: '84a.jpg' },
  { typeCode: '84B', areaGroup: '84', fileName: '84b.jpg' },
  { typeCode: '84C', areaGroup: '84', fileName: '84c.jpg' },
  { typeCode: '84D', areaGroup: '84', fileName: '84d.jpg' },
  { typeCode: '96A', areaGroup: '96', fileName: '96a.jpg' },
  { typeCode: '96B', areaGroup: '96', fileName: '96b.jpg' },
  { typeCode: '114A', areaGroup: '114', fileName: '114a.jpg' },
  { typeCode: '119A', areaGroup: '119', fileName: '119a.jpg' },
  { typeCode: '145A', areaGroup: '145', fileName: '145a.png' },
  { typeCode: '158PA', areaGroup: '158', fileName: '158pa.png', specialFeatures: ['펜트하우스'] },
  { typeCode: '169A', areaGroup: '169', fileName: '169a.png' },
  { typeCode: '175PA', areaGroup: '175', fileName: '175pa.png', specialFeatures: ['펜트하우스'] },
  { typeCode: '182PA', areaGroup: '182', fileName: '182pa.png', specialFeatures: ['펜트하우스'] },
  { typeCode: '188PA', areaGroup: '188', fileName: '188pa.png', specialFeatures: ['펜트하우스'] },
  { typeCode: '208PA', areaGroup: '208', fileName: '208pa.png', specialFeatures: ['펜트하우스'] },
  { typeCode: '219PA', areaGroup: '219', fileName: '219pa.png', specialFeatures: ['펜트하우스'] },
  { typeCode: '219PB', areaGroup: '219', fileName: '219pb.png', specialFeatures: ['펜트하우스'] },
  { typeCode: '244PA', areaGroup: '244', fileName: '244pa.png', specialFeatures: ['펜트하우스'] },
];

/**
 * 삼익비치(남천2구역) 실제 단지배치도(site-plan.png) 표기 기준 동별 주택형 매핑
 * - 원칙: 배치도에 명확히 확인되는 타입만 등록 (세대수, 방향, 층수 임의 추정 금지)
 * - 101동 ~ 108동 총 8개 주동 전수 매핑
 */
export const SAMIK_BEACH_BUILDING_TYPES_MAP: Record<string, string[]> = {
  '101동': ['84A', '84C', '84D', '158PA'],
  '102동': ['84A', '84B', '96B', '119A', '169A', '175PA', '182PA'],
  '103동': ['84A', '84B', '96B', '119A', '175PA', '182PA', '219PA'],
  '104동': ['84A', '84B', '96B', '145A', '219PB'],
  '105동': ['96A', '96B', '145A', '188PA'],
  '106동': ['96A', '96B', '114A', '169A', '188PA', '244PA'],
  '107동': ['96A', '96B', '114A', '169A', '188PA', '208PA'],
  '108동': ['60A', '84A', '84B', '84C'],
};

export const SAMIK_BEACH_UNIT_TYPES: FirestoreUnitTypeDoc[] = RAW_SAMIK_BEACH_TYPES.map((t) => {
  const assetPath = `/assets/plans/samikBeach/${t.fileName}`;
  const secondaryAssetPath = t.secondaryFileName ? `/assets/plans/samikBeach/${t.secondaryFileName}` : undefined;
  const tertiaryAssetPath = t.tertiaryFileName ? `/assets/plans/samikBeach/${t.tertiaryFileName}` : undefined;
  const floorList = t.floors || [
    {
      floorId: '1F',
      label: t.floor1Label || (t.isDuplex ? '1F (하층 도면)' : '1F (평면도)'),
      fileName: t.fileName,
      assetPath: assetPath,
    },
  ];

  const dongsForType = Object.entries(SAMIK_BEACH_BUILDING_TYPES_MAP)
    .filter(([_, types]) => types.includes(t.typeCode))
    .map(([dong]) => dong);

  return {
    unitTypeId: `samik-beach-proposal-${t.typeCode}`,
    typeName: t.typeCode,
    typeCode: t.typeCode,
    units: 0, // 세부 세대수는 사용자 업로드 도면 및 공식 고시 기준 미확인 (임의 추정 금지)
    projectId: 'samik-beach',
    planVersionId: 'samik-beach-plan-user-supplied-v1',
    areaGroup: t.areaGroup,
    netAreaM2: null,
    floorPlanAssetId: `asset-samikbeach-plan-${t.typeCode}`,
    locationMapIncludedInOriginal: false,
    specialFeatures: t.specialFeatures || [],
    sourceAlias: null,
    verificationStatus: 'unverified',
    confirmationStatus: 'proposal',
    evidenceSourceId: 'samikbeach-unit-plans-user-supplied-v1',
    allocation: {
      totalUnits: 0,
      memberUnits: 0,
      reservedUnits: 0,
      generalSaleUnits: 0,
      rentalUnits: 0,
      isArithmeticMatch: false,
      statusNotice:
        '공식 사업시행계획변경인가(수영구 고시 제2026-71호) 및 사용자 확보 도면상 타입별 세부 세대수 미기재. 관리처분계획인가 고시 전까지 임의 추정 금지 (미확인)',
    },
    verifiedFacts: {
      typeName: t.typeCode,
      units: 0,
      areaGroup: t.areaGroup,
      sourceType: 'user-supplied',
      evidence: `samikbeach-unit-plans-user-supplied-v1 (${t.fileName}${t.secondaryFileName ? `, ${t.secondaryFileName}` : ''}${t.tertiaryFileName ? `, ${t.tertiaryFileName}` : ''})`,
      hasLocationMap: false,
      verificationStatus: 'verified',
      confirmationStatus: 'proposal',
    },
    sourceAsset: {
      assetId: `asset-samikbeach-plan-${t.typeCode}`,
      originalFileName: t.fileName,
      servedFileName: t.fileName,
      secondaryFileName: t.secondaryFileName || null,
      tertiaryFileName: t.tertiaryFileName || null,
      assetType: 'floor_plan',
      imageUrl: assetPath,
      secondaryImageUrl: secondaryAssetPath || null,
      tertiaryImageUrl: tertiaryAssetPath || null,
      assetPath: assetPath,
      primaryAssetPath: assetPath,
      secondaryAssetPath: secondaryAssetPath,
      tertiaryAssetPath: tertiaryAssetPath,
      isDuplex: t.isDuplex || false,
      isMultiLevel: t.isDuplex || false,
      floor1Label: t.floor1Label || (t.isDuplex ? '1F (하층 도면)' : undefined),
      floor2Label: t.floor2Label || (t.isDuplex ? '2F (상층 도면)' : undefined),
      floor3Label: t.floor3Label,
      floors: floorList,
      sourceAssetVerified: true,
      fileExists: true,
    },
    provenance: {
      sourceType: 'user-supplied',
      sourceName: '남천2구역(삼익비치) 재건축 단위세대 평면도 (사용자 제공)',
      documentTitle: '남천2구역(삼익비치) 재건축 단위세대 평면도',
      publishedDate: null,
    },
    buildingNumbers: dongsForType,
    candidateBuildingNumbers: [],
    mappingStatus: dongsForType.length > 0 ? 'verified' : 'unresolved',
    keyPlanMatched: false,
    unverifiedAttributesNotice:
      '삼익비치 도면은 사용자 제공 자료 기준이며, 공식 사업시행계획인가 자료 교차 검증 전까지 세부 속성은 미확정 상태입니다.',
    createdAt: '2026-09-18T00:00:00Z',
  };
});

export const SAMIK_BEACH_BUILDINGS: FirestoreBuildingDoc[] = [
  '101', '102', '103', '104', '105', '106', '107', '108'
].map((num) => {
  const dong = `${num}동`;
  const types = SAMIK_BEACH_BUILDING_TYPES_MAP[dong] || [];
  return {
    buildingId: `samik-beach-bldg-${num}`,
    projectId: 'samik-beach',
    sitePlanId: 'samik-beach-site-plan-user-supplied-v1',
    buildingNumber: dong,
    displayName: dong,
    unitTypesShown: types,
    isTerraceHouse: false,
    notes: `남천2구역(삼익비치) 실제 배치도 표기 기준: ${types.join(', ')}`,
  };
});

/**
 * 삼익비치(남천2구역) 주동 정규화 좌표 목록 (101동 ~ 108동 총 8개 주동)
 * - 원본 이미지: public/assets/plans/samikBeach/site-plan.png (966 x 365 px)
 * - normalizedX = centerX / 966, normalizedY = centerY / 365
 */
export const SAMIK_BEACH_SITE_PLAN_COORDINATES: SitePlanCoordinate[] = [
  {
    buildingNumber: '101동',
    normalizedX: 0.1636,
    normalizedY: 0.4274,
    coordinateStatus: 'verified',
    sitePlanId: 'samik-beach-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '101',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '102동',
    normalizedX: 0.1915,
    normalizedY: 0.5274,
    coordinateStatus: 'verified',
    sitePlanId: 'samik-beach-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '102',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '103동',
    normalizedX: 0.3085,
    normalizedY: 0.5274,
    coordinateStatus: 'verified',
    sitePlanId: 'samik-beach-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '103',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '104동',
    normalizedX: 0.4286,
    normalizedY: 0.5247,
    coordinateStatus: 'verified',
    sitePlanId: 'samik-beach-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '104',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '105동',
    normalizedX: 0.5549,
    normalizedY: 0.5219,
    coordinateStatus: 'verified',
    sitePlanId: 'samik-beach-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '105',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '106동',
    normalizedX: 0.6801,
    normalizedY: 0.5233,
    coordinateStatus: 'verified',
    sitePlanId: 'samik-beach-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '106',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '107동',
    normalizedX: 0.8018,
    normalizedY: 0.5233,
    coordinateStatus: 'verified',
    sitePlanId: 'samik-beach-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '107',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '108동',
    normalizedX: 0.7008,
    normalizedY: 0.4205,
    coordinateStatus: 'verified',
    sitePlanId: 'samik-beach-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '108',
    isTerraceHouse: false,
  },
];
