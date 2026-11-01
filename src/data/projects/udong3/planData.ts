/**
 * 우동3구역(udong-3) 단지계획 및 단위세대 평면 데이터 (Phase 4G-1)
 *
 * 엄격한 준수 원칙:
 * 1. 사용자가 직접 확인 및 업로드한 24개 타입 평면도 실물 에셋 매핑:
 *    - 59 (59.jpg)
 *    - 74 (74.jpg), 74P (74p.jpg / 74p.png)
 *    - 84A (84a.png), 84B (84b.png), 84C (84c.png), 84D1 (84d1.png), 84D2 (84d2.png), 84E (84e.png)
 *    - 96A (96a.png), 96A1 (96a1.png), 96B (96b.png), 96C (96c.png), 96D (96d.png)
 *    - 99P (99p.png)
 *    - 111 (111.png)
 *    - 126 (126.png)
 *    - 154복A (1F: 154-1.jpg, 2F: 154-2.jpg), 155복B (1F: 155-1.jpg, 2F: 155-2.jpg)
 *    - 160 (160.png)
 *    - 171T (171.png / 171t.png)
 *    - 197P (197p.jpg), 200P (200p.jpg), 210 (210.jpg)
 * 2. 39㎡ 임대세대(121세대) 제외 원칙:
 *    - 전체 사업계획 factual data에는 포함(planVersion.excludedHousingTypes)하되
 *      사용자용 평면도 UI (selector, viewer, comparison)에서는 제외.
 * 3. 배치도: site-plan.png 연결 (hasSitePlan: true, hasInteractiveCoordinates: false).
 */

import {
  FirestorePlanVersionDoc,
  FirestoreUnitTypeDoc,
  FirestoreSitePlanDoc,
  FirestoreBuildingDoc,
} from '../../../schema/firestoreSchema.ts';
import type { AreaGroupDefinition, SitePlanCoordinate } from '../../chokjin3PlanData.ts';

export const UDONG3_PLAN_VERSION: FirestorePlanVersionDoc = {
  planVersionId: 'udong-3-plan-user-supplied-v1',
  projectId: 'udong-3',
  versionName: '우동3구역 디에이치 아센테르 단위세대 평면 및 배치도 (사용자 제공안)',
  sourceType: 'user-supplied',
  sourceName: '우동3구역 주택재개발정비사업 단위세대 도면 자료 (사용자 직접 확보)',
  documentTitle: '우동3구역 단위세대 평면도 및 단지배치도',
  publishedDate: null,
  sourceDate: null,
  confirmationStatus: 'proposal',
  verificationStatus: 'unverified',
  isCurrentKnownVersion: true,
  supersededBy: null,
  totalUnitsInPlanSet: 2274,
  discrepancyNotice: null,
  versionNotice: '본 도면 및 배치도는 사용자 확보 자료 기준이며 인허가 및 관리처분 확정안이 아닙니다. (변경 가능)',
  totalUnitTypesCount: 24,
  layoutPlanAssetId: 'asset-udong3-site-plan',
  sitePlanAssetId: 'udong-3-site-plan-user-supplied-v1',
  evidenceSourceId: 'udong3-mgmt-plan-official-notice-2026-68',
  excludedHousingTypes: [
    {
      typeCode: '39',
      units: 121,
      housingCategory: 'rental',
      excludedFromUnitPlanUI: true,
    },
  ],
  totalSupplySummary: {
    totalUnits: 2395,
    nonRentalUnits: 2274,
    rentalUnits: 121,
    memberUnits: 1095,
    reservedUnits: 23,
    generalSaleUnits: 1156,
    evidenceSourceId: 'udong3-mgmt-plan-official-notice-2026-68',
  },
  createdAt: '2026-09-18T00:00:00.000Z',
  verifiedAt: '2026-09-18T00:00:00.000Z',
};

export const UDONG3_SITE_PLAN: FirestoreSitePlanDoc = {
  sitePlanId: 'udong-3-site-plan-user-supplied-v1',
  projectId: 'udong-3',
  assetPath: '/assets/plans/udong3/site-plan.jpg',
  sourceType: 'user-supplied',
  confirmationStatus: 'proposal',
  verificationStatus: 'unverified',
  isCurrentKnownVersion: true,
  title: '우동3구역 단지 전체 배치도',
  versionNotice: '사용자 제공 배치도 기준이며 공식 사업시행계획인가 자료 교차 검증 전까지 세부 배치는 미확정 상태입니다.',
  totalBuildingsCount: 18,
  totalUnitTypesMapped: 0,
  evidenceSourceId: 'udong3-site-plan-user-supplied-v1',
  uploadedAt: '2026-09-18T00:00:00Z',
  verifiedAt: '2026-09-18T00:00:00Z',
};

export const UDONG3_AREA_GROUPS: AreaGroupDefinition[] = [
  { groupCode: '59', name: '59㎡', totalUnits: 251, types: ['59'] },
  { groupCode: '74', name: '74㎡', totalUnits: 43, types: ['74', '74P'] },
  { groupCode: '84', name: '84㎡', totalUnits: 898, types: ['84A', '84B', '84C', '84D1', '84D2', '84E'] },
  { groupCode: '96', name: '96㎡', totalUnits: 669, types: ['96A', '96A1', '96B', '96C', '96D'] },
  { groupCode: '99', name: '99㎡', totalUnits: 3, types: ['99P'] },
  { groupCode: '111', name: '111㎡', totalUnits: 160, types: ['111'] },
  { groupCode: '126', name: '126㎡', totalUnits: 66, types: ['126'] },
  { groupCode: '154', name: '154㎡', totalUnits: 16, types: ['154복A'] },
  { groupCode: '155', name: '155㎡', totalUnits: 16, types: ['155복B'] },
  { groupCode: '160', name: '160㎡', totalUnits: 66, types: ['160'] },
  { groupCode: '171', name: '171㎡', totalUnits: 16, types: ['171T'] },
  { groupCode: '197', name: '197㎡', totalUnits: 2, types: ['197P'] },
  { groupCode: '200', name: '200㎡', totalUnits: 2, types: ['200P'] },
  { groupCode: '210', name: '210㎡', totalUnits: 66, types: ['210'] },
];

interface Udong3RawType {
  typeCode: string;
  areaGroup: string;
  fileName: string;
  units: number;
  memberUnits: number;
  reservedUnits: number;
  generalSaleUnits: number;
  rentalUnits: number;
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
  statusNotice?: string;
  isConflict?: boolean;
  sourceAlias?: string;
}

const RAW_UDONG3_TYPES: Udong3RawType[] = [
  { typeCode: '59', areaGroup: '59', fileName: '59a.jpg', units: 251, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '74', areaGroup: '74', fileName: '74a.jpg', units: 39, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '74P', areaGroup: '74', fileName: '74p.jpg', units: 4, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0, specialFeatures: ['펜트하우스'] },
  { typeCode: '84A', areaGroup: '84', fileName: '84a.jpg', units: 94, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '84B', areaGroup: '84', fileName: '84b.jpg', units: 277, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '84C', areaGroup: '84', fileName: '84c.jpg', units: 224, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '84D1', areaGroup: '84', fileName: '84d1.jpg', units: 58, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '84D2', areaGroup: '84', fileName: '84d2.jpg', units: 56, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '84E', areaGroup: '84', fileName: '84e.jpg', units: 189, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '96A', areaGroup: '96', fileName: '96a.jpg', units: 121, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '96A1', areaGroup: '96', fileName: '96a1.jpg', units: 77, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '96B', areaGroup: '96', fileName: '96b.jpg', units: 283, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '96C', areaGroup: '96', fileName: '96c.jpg', units: 74, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '96D', areaGroup: '96', fileName: '96d.jpg', units: 114, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '99P', areaGroup: '99', fileName: '99p.jpg', units: 3, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0, specialFeatures: ['펜트하우스'] },
  { typeCode: '111', areaGroup: '111', fileName: '111a.jpg', units: 160, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  { typeCode: '126', areaGroup: '126', fileName: '126a.jpg', units: 66, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  {
    typeCode: '154복A',
    areaGroup: '154',
    fileName: '154-1.jpg',
    secondaryFileName: '154-2.jpg',
    units: 16,
    memberUnits: 0,
    reservedUnits: 0,
    generalSaleUnits: 0,
    rentalUnits: 0,
    floor1Label: '1F (하층 도면)',
    floor2Label: '2F (상층 도면)',
    specialFeatures: ['복층'],
    isDuplex: true,
    floors: [
      { floorId: '1F', label: '1F (하층 도면)', fileName: '154-1.jpg', assetPath: '/assets/plans/udong3/154-1.jpg' },
      { floorId: '2F', label: '2F (상층 도면)', fileName: '154-2.jpg', assetPath: '/assets/plans/udong3/154-2.jpg' },
    ],
  },
  {
    typeCode: '155복B',
    areaGroup: '155',
    fileName: '155-1.jpg',
    secondaryFileName: '155-2.jpg',
    units: 16,
    memberUnits: 0,
    reservedUnits: 0,
    generalSaleUnits: 0,
    rentalUnits: 0,
    floor1Label: '1F (하층 도면)',
    floor2Label: '2F (상층 도면)',
    specialFeatures: ['복층'],
    isDuplex: true,
    isConflict: true,
    sourceAlias: '154B',
    statusNotice:
      '공식 관리처분계획 고시상 154B(16세대)에 해당하나, 도면 표제부 미기재 및 기존 코드베이스 식별자(155복B)로 보존(conflict/unresolved). 타입별 조합원/일반분양 세부 배분은 미확인',
    floors: [
      { floorId: '1F', label: '1F (하층 도면)', fileName: '155-1.jpg', assetPath: '/assets/plans/udong3/155-1.jpg' },
      { floorId: '2F', label: '2F (상층 도면)', fileName: '155-2.jpg', assetPath: '/assets/plans/udong3/155-2.jpg' },
    ],
  },
  { typeCode: '160', areaGroup: '160', fileName: '160a.jpg', units: 66, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
  {
    typeCode: '171T',
    areaGroup: '171',
    fileName: '171t-1.jpg',
    secondaryFileName: '171t-2.jpg',
    tertiaryFileName: '171t-b1.jpg',
    units: 16,
    memberUnits: 0,
    reservedUnits: 0,
    generalSaleUnits: 0,
    rentalUnits: 0,
    floor1Label: '1F (1층 도면)',
    floor2Label: '2F (2층 도면)',
    floor3Label: 'B1 (지하1층 도면)',
    specialFeatures: ['테라스', '다층/복층'],
    isDuplex: true,
    floors: [
      { floorId: '1F', label: '1F (1층 도면)', fileName: '171t-1.jpg', assetPath: '/assets/plans/udong3/171t-1.jpg' },
      { floorId: '2F', label: '2F (2층 도면)', fileName: '171t-2.jpg', assetPath: '/assets/plans/udong3/171t-2.jpg' },
      { floorId: 'B1', label: 'B1 (지하1층 도면)', fileName: '171t-b1.jpg', assetPath: '/assets/plans/udong3/171t-b1.jpg' },
    ],
  },
  { typeCode: '197P', areaGroup: '197', fileName: '197p.jpg', units: 2, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0, specialFeatures: ['펜트하우스'] },
  { typeCode: '200P', areaGroup: '200', fileName: '200p.jpg', units: 2, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0, specialFeatures: ['펜트하우스'] },
  { typeCode: '210', areaGroup: '210', fileName: '210a.jpg', units: 66, memberUnits: 0, reservedUnits: 0, generalSaleUnits: 0, rentalUnits: 0 },
];

/**
 * 우동3구역 실제 단지배치도(site-plan.jpg) 표기 기준 동별 주택형 매핑
 * - 원칙: 배치도에 명확히 확인되는 타입만 등록 (세대수, 방향, 층수 임의 추정 금지)
 * - 기존 24개 우동3 typeCode만 사용
 * - 101동 ~ 118동 총 18개 주동 전수 매핑
 */
export const UDONG3_BUILDING_TYPES_MAP: Record<string, string[]> = {
  '101동': ['59'],
  '102동': ['84A', '84B', '96A', '96B'],
  '103동': ['84A', '84B', '96A', '96B'],
  '104동': ['84A', '84B', '96A', '96B'],
  '105동': ['74', '74P', '84A', '84B', '96A', '96B'],
  '106동': ['84A', '84B', '96A', '96B'],
  '107동': ['84A', '84B', '96A'],
  '108동': ['84A', '84B', '96A', '96B'],
  '109동': ['84A', '84B', '96A'],
  '110동': ['96A', '96B', '111', '126'],
  '111동': ['96A', '96B', '111', '126', '160', '210'],
  '112동': ['84A', '84B', '96A', '96B'],
  '113동': ['84A', '84B', '96A', '96B'],
  '114동': ['96A', '96B', '111', '126', '160', '210'],
  '115동': ['84A', '84B', '96A'],
  '116동': ['84A', '84B', '96A'],
  '117동': ['96A', '96B', '111', '126', '160'],
  '118동': ['111', '126', '154복A', '155복B', '160'],
};

export const UDONG3_UNIT_TYPES: FirestoreUnitTypeDoc[] = RAW_UDONG3_TYPES.map((t) => {
  const assetPath = `/assets/plans/udong3/${t.fileName}`;
  const secondaryAssetPath = t.secondaryFileName ? `/assets/plans/udong3/${t.secondaryFileName}` : undefined;
  const tertiaryAssetPath = t.tertiaryFileName ? `/assets/plans/udong3/${t.tertiaryFileName}` : undefined;

  const dongsForType = Object.entries(UDONG3_BUILDING_TYPES_MAP)
    .filter(([_, types]) => types.includes(t.typeCode))
    .map(([dong]) => dong);

  return {
    unitTypeId: `udong-3-proposal-${t.typeCode}`,
    typeName: t.typeCode,
    typeCode: t.typeCode,
    units: t.units,
    projectId: 'udong-3',
    planVersionId: 'udong-3-plan-user-supplied-v1',
    areaGroup: t.areaGroup,
    netAreaM2: null,
    floorPlanAssetId: `asset-udong3-plan-${t.typeCode}`,
    locationMapIncludedInOriginal: false,
    specialFeatures: t.specialFeatures || [],
    sourceAlias: t.sourceAlias || null,
    verificationStatus: 'verified',
    confirmationStatus: 'proposal',
    evidenceSourceId: 'udong3-mgmt-plan-official-notice-2026-68',
    allocation: {
      totalUnits: t.units,
      memberUnits: t.memberUnits,
      reservedUnits: t.reservedUnits,
      generalSaleUnits: t.generalSaleUnits,
      rentalUnits: t.rentalUnits,
      isArithmeticMatch: false,
      isConflict: t.isConflict || false,
      statusNotice:
        t.statusNotice ||
        '도면/배치도 표기 세대수 확인 완료. 조합원/일반분양/보류지 세부 배분은 관리처분인가 총괄(조합원 1,095, 일반분양 1,156, 보류지 23)로 고시되었으며, 타입별 세부 내역은 공식 자료 미확인으로 추정 금지',
    },
    verifiedFacts: {
      typeName: t.typeCode,
      units: t.units,
      areaGroup: t.areaGroup,
      sourceType: 'official',
      evidence: `해운대구 고시 제2026-68호 및 단위세대 평면도 (${t.fileName}${t.secondaryFileName ? `, ${t.secondaryFileName}` : ''}${t.tertiaryFileName ? `, ${t.tertiaryFileName}` : ''})`,
      hasLocationMap: false,
      verificationStatus: 'verified',
      confirmationStatus: 'proposal',
    },
    sourceAsset: {
      assetId: `asset-udong3-plan-${t.typeCode}`,
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
      floors: t.floors,
      sourceAssetVerified: true,
      fileExists: true,
    },
    provenance: {
      sourceType: 'user-supplied',
      sourceName: '우동3구역 단위세대 평면도 (사용자 제공)',
      documentTitle: '우동3구역 단위세대 평면도',
      publishedDate: null,
    },
    buildingNumbers: dongsForType,
    candidateBuildingNumbers: [],
    mappingStatus: dongsForType.length > 0 ? 'verified' : 'unresolved',
    keyPlanMatched: false,
    unverifiedAttributesNotice:
      '우동3구역 도면은 사용자 제공 자료 기준이며, 공식 사업시행계획인가 자료 교차 검증 전까지 세부 속성은 미확정 상태입니다.',
    createdAt: '2026-09-18T00:00:00Z',
  };
});

/**
 * 우동3구역 주동 목록 (101동 ~ 118동 총 18개 주동)
 * - Phase 4G-6: 실제 배치도(site-plan.jpg) 표기 기준 주동별 주택형 매핑
 */
export const UDONG3_BUILDINGS: FirestoreBuildingDoc[] = [
  '101', '102', '103', '104', '105', '106', '107', '108', '109',
  '110', '111', '112', '113', '114', '115', '116', '117', '118'
].map((num) => {
  const dong = `${num}동`;
  const types = UDONG3_BUILDING_TYPES_MAP[dong] || [];
  return {
    buildingId: `udong-3-bldg-${num}`,
    projectId: 'udong-3',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    buildingNumber: dong,
    displayName: dong,
    unitTypesShown: types,
    isTerraceHouse: false,
    notes: `우동3구역 실제 배치도 표기 기준: ${types.join(', ')}`,
  };
});

/**
 * 우동3구역 주동 정규화 좌표 목록 (101동 ~ 118동 총 18개 주동)
 * - 원본 이미지: public/assets/plans/udong3/site-plan.jpg (966 x 596 px)
 * - normalizedX = centerX / 966, normalizedY = centerY / 596
 */
export const UDONG3_SITE_PLAN_COORDINATES: SitePlanCoordinate[] = [
  {
    buildingNumber: '101동',
    normalizedX: 0.2614,
    normalizedY: 0.4723,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '101',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '102동',
    normalizedX: 0.3494,
    normalizedY: 0.4581,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '102',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '103동',
    normalizedX: 0.4581,
    normalizedY: 0.4614,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '103',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '104동',
    normalizedX: 0.4829,
    normalizedY: 0.3599,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '104',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '105동',
    normalizedX: 0.5657,
    normalizedY: 0.3154,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '105',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '106동',
    normalizedX: 0.6372,
    normalizedY: 0.2819,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '106',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '107동',
    normalizedX: 0.7531,
    normalizedY: 0.2970,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '107',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '108동',
    normalizedX: 0.7076,
    normalizedY: 0.3658,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '108',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '109동',
    normalizedX: 0.7034,
    normalizedY: 0.4480,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '109',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '110동',
    normalizedX: 0.6232,
    normalizedY: 0.4941,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '110',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '111동',
    normalizedX: 0.5968,
    normalizedY: 0.5570,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '111',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '112동',
    normalizedX: 0.5357,
    normalizedY: 0.6300,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '112',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '113동',
    normalizedX: 0.6113,
    normalizedY: 0.7282,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '113',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '114동',
    normalizedX: 0.4788,
    normalizedY: 0.6812,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '114',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '115동',
    normalizedX: 0.3835,
    normalizedY: 0.6753,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '115',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '116동',
    normalizedX: 0.3142,
    normalizedY: 0.6711,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '116',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '117동',
    normalizedX: 0.2562,
    normalizedY: 0.6208,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '117',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '118동',
    normalizedX: 0.6703,
    normalizedY: 0.6275,
    coordinateStatus: 'verified',
    sitePlanId: 'udong-3-site-plan-user-supplied-v1',
    confirmationStatus: 'proposal',
    label: '118',
    isTerraceHouse: false,
  },
];

