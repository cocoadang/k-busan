/**
 * 촉진3구역 단지계획 & 단위세대 평면 데이터 (Phase 4D-4 SSOT)
 *
 * 엄격한 준수 원칙:
 * 1. 유저 제공 및 원본 검증 기준 39개 타입 확정:
 *    - 59㎡ (956세대): 59A(174), 59B(300), 59C(197), 59D(46), 59E(114), 59F(125)
 *    - 69㎡ (36세대): 69W(9), 69X(9), 69Y(18) [원본 직접 판독 검증]
 *    - 72㎡ (64세대): 72B(64) [원본 직접 판독 검증]
 *    - 74㎡ (10세대): 74A(10)
 *    - 84㎡ (1,384세대): 84A1(232), 84A2(30), 84B(148), 84C(275), 84D(316), 84E(40), 84F(128), 84G(64), 84H(111), 84T1(20), 84T2(20)
 *    - 90㎡ (43세대): 90A(43)
 *    - 95㎡ (54세대): 95W(9), 95X(45)
 *    - 98㎡ (536세대): 98A1(27), 98A2(26), 98B(148), 98C(311), 98D(16, 복층), 98T(8, 테라스 복층)
 *    - 107㎡ (9세대): 107W(9)
 *    - 114㎡ (199세대): 114A(103), 114B(96)
 *    - 122㎡ (26세대): 122W(8), 122X(18)
 *    - 124㎡ (43세대): 124A(43)
 *    - 134㎡ (5세대): 134A(4, 펜트하우스), 134B(1, 펜트하우스)
 *    총 합계: 3,365세대 (39개 타입, 13개 면적군)
 * 2. 모든 데이터의 confirmationStatus = 'proposal', verificationStatus = 'verified'.
 *    - "verified"는 원본 조합자료에서 확인됨을 뜻하며 최종 확정안이 아님.
 *    - "proposal"은 조합원 총회/조합 배포자료 제안안 단계임을 의미.
 * 3. specialFeatures는 원본 명칭만 보존 ("테라스", "내부계단", "복층", "펜트하우스").
 * 4. 도면 우측 상단 위치도(동/호수 위치 표시 Key Plan)는 원본 중요 정보로 보존.
 */

import {
  FirestorePlanVersionDoc,
  FirestoreUnitTypeDoc,
  FirestorePlanAssetDoc,
  FirestoreSitePlanDoc,
  FirestoreBuildingDoc,
} from '../schema/firestoreSchema.ts';

export const CHOKJIN3_PLAN_VERSION: FirestorePlanVersionDoc = {
  planVersionId: 'chokjin-3-association-proposal-v1',
  projectId: 'chokjin-3',
  versionName: '촉진3구역 조합배포 평면안 (총회/조합자료)',
  sourceType: 'association',
  sourceName: '시민공원주변 촉진3구역 조합원 총회 및 조합 배포자료',
  documentTitle: '촉진3구역 단위세대 평면도(위치도)',
  publishedDate: null,
  sourceDate: null,
  confirmationStatus: 'proposal',
  verificationStatus: 'verified',
  isCurrentKnownVersion: true,
  supersededBy: null,
  totalUnitsInPlanSet: 3365,
  discrepancyNotice: '조합 평면자료 합계와 사업 총세대수 차이 원인 확인 필요',
  versionNotice: '본 평면 자료는 조합원 총회 및 조합 배포자료 기준 제안안이며 최종 확정 설계가 아닙니다. (변경 가능)',
  totalUnitTypesCount: 39,
  layoutPlanAssetId: 'asset-chokjin3-layout-master',
  sitePlanAssetId: 'chokjin-3-association-proposal-v1',
  evidenceSourceId: 'chokjin-3-assoc-plan-v1',
  excludedHousingTypes: [
    {
      typeCode: '36A',
      units: 90,
      housingCategory: 'rental',
      excludedFromUnitPlanUI: true,
    },
    {
      typeCode: '36B',
      units: 90,
      housingCategory: 'rental',
      excludedFromUnitPlanUI: true,
    },
  ],
  totalSupplySummary: {
    totalUnits: 3545,
    nonRentalUnits: 3365,
    rentalUnits: 180,
    memberUnits: 1727,
    reservedUnits: 20,
    generalSaleUnits: 1618,
    evidenceSourceId: 'chokjin-3-assoc-plan-v1',
  },
  createdAt: '2026-09-13T00:00:00Z',
  verifiedAt: '2026-09-13T00:00:00Z',
};

export const CHOKJIN3_LAYOUT_ASSET: FirestorePlanAssetDoc = {
  assetId: 'asset-chokjin3-layout-master',
  projectId: 'chokjin-3',
  planVersionId: 'chokjin-3-association-proposal-v1',
  assetType: 'site_layout',
  title: '촉진3구역 단지 전체 배치도',
  imageUrl: '/assets/plans/chokjin3_master_layout.jpg',
  hasLocationMapOverlay: true,
  aspectRatioNotice: '전체 동 배치 및 단지 중앙 시민공원 연계축 포함',
  originalFileName: '촉진3구역_단지배치도.jpg',
};

export interface AreaGroupDefinition {
  groupCode: string;
  name: string;
  totalUnits: number;
  types: string[];
}

export const CHOKJIN3_AREA_GROUPS: AreaGroupDefinition[] = [
  { groupCode: '59', name: '59㎡', totalUnits: 956, types: ['59A', '59B', '59C', '59D', '59E', '59F'] },
  { groupCode: '69', name: '69㎡', totalUnits: 36, types: ['69W', '69X', '69Y'] },
  { groupCode: '72', name: '72㎡', totalUnits: 64, types: ['72B'] },
  { groupCode: '74', name: '74㎡', totalUnits: 10, types: ['74A'] },
  {
    groupCode: '84',
    name: '84㎡',
    totalUnits: 1384,
    types: ['84A1', '84A2', '84B', '84C', '84D', '84E', '84F', '84G', '84H', '84T1', '84T2'],
  },
  { groupCode: '90', name: '90㎡', totalUnits: 43, types: ['90A'] },
  { groupCode: '95', name: '95㎡', totalUnits: 54, types: ['95W', '95X'] },
  { groupCode: '98', name: '98㎡', totalUnits: 536, types: ['98A1', '98A2', '98B', '98C', '98D', '98T'] },
  { groupCode: '107', name: '107㎡', totalUnits: 9, types: ['107W'] },
  { groupCode: '114', name: '114㎡', totalUnits: 199, types: ['114A', '114B'] },
  { groupCode: '122', name: '122㎡', totalUnits: 26, types: ['122W', '122X'] },
  { groupCode: '124', name: '124㎡', totalUnits: 43, types: ['124A'] },
  { groupCode: '134', name: '134㎡', totalUnits: 5, types: ['134A', '134B'] },
];

interface RawTypeSpec {
  typeCode: string;
  areaGroup: string;
  units: number;
  netAreaM2: number;
  specialFeatures: string[];
  evidence?: string;
  sourceAlias?: string;
  provenanceNote?: string;
  isDuplex?: boolean;
  allocation?: {
    totalUnits: number;
    memberUnits: number;
    reservedUnits: number;
    generalSaleUnits: number;
    rentalUnits: number;
    isArithmeticMatch?: boolean;
    isConflict?: boolean;
    statusNotice?: string;
  };
}

const RAW_39_TYPES: RawTypeSpec[] = [
  // 59㎡ (956)
  {
    typeCode: '59A',
    areaGroup: '59',
    units: 174,
    netAreaM2: 59.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 174,
      memberUnits: 25,
      reservedUnits: 2,
      generalSaleUnits: 147,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 25세대, 일반분양 147세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '59B',
    areaGroup: '59',
    units: 300,
    netAreaM2: 59.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 300,
      memberUnits: 2,
      reservedUnits: 2,
      generalSaleUnits: 296,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 2세대, 일반분양 296세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '59C',
    areaGroup: '59',
    units: 197,
    netAreaM2: 59.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 197,
      memberUnits: 4,
      reservedUnits: 1,
      generalSaleUnits: 192,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 4세대, 일반분양 192세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '59D',
    areaGroup: '59',
    units: 46,
    netAreaM2: 59.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 46,
      memberUnits: 3,
      reservedUnits: 1,
      generalSaleUnits: 42,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 3세대, 일반분양 42세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '59E',
    areaGroup: '59',
    units: 114,
    netAreaM2: 59.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 114,
      memberUnits: 2,
      reservedUnits: 2,
      generalSaleUnits: 110,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 2세대, 일반분양 110세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '59F',
    areaGroup: '59',
    units: 125,
    netAreaM2: 59.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 125,
      memberUnits: 1,
      reservedUnits: 2,
      generalSaleUnits: 122,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 1세대, 일반분양 122세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },

  // 69㎡ (36)
  {
    typeCode: '69W',
    areaGroup: '69',
    units: 9,
    netAreaM2: 69.9,
    specialFeatures: [],
    evidence: '조합 배포도면 좌상단 세대수 "9세대" 직접 판독 확인',
    allocation: {
      totalUnits: 9,
      memberUnits: 0,
      reservedUnits: 0,
      generalSaleUnits: 9,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 0세대, 일반분양 9세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '69X',
    areaGroup: '69',
    units: 9,
    netAreaM2: 69.9,
    specialFeatures: [],
    evidence: '조합 배포도면 좌상단 세대수 "9세대" 직접 판독 확인',
    allocation: {
      totalUnits: 9,
      memberUnits: 0,
      reservedUnits: 0,
      generalSaleUnits: 9,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 0세대, 일반분양 9세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '69Y',
    areaGroup: '69',
    units: 18,
    netAreaM2: 69.9,
    specialFeatures: [],
    evidence: '조합 배포도면 좌상단 세대수 "18세대" 직접 판독 확인',
    allocation: {
      totalUnits: 18,
      memberUnits: 0,
      reservedUnits: 0,
      generalSaleUnits: 18,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 0세대, 일반분양 18세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },

  // 72㎡ (64)
  {
    typeCode: '72B',
    areaGroup: '72',
    units: 64,
    netAreaM2: 72.9,
    specialFeatures: [],
    evidence: '조합 배포도면 좌상단 세대수 "64세대" 직접 판독 확인',
    allocation: {
      totalUnits: 64,
      memberUnits: 0,
      reservedUnits: 0,
      generalSaleUnits: 64,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 0세대, 일반분양 64세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },

  // 74㎡ (10)
  {
    typeCode: '74A',
    areaGroup: '74',
    units: 10,
    netAreaM2: 74.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 10,
      memberUnits: 2,
      reservedUnits: 0,
      generalSaleUnits: 8,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 2세대, 일반분양 8세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },

  // 84㎡ (1,384)
  {
    typeCode: '84A1',
    areaGroup: '84',
    units: 232,
    netAreaM2: 84.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 232,
      memberUnits: 70,
      reservedUnits: 3,
      generalSaleUnits: 159,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 70세대, 일반분양 159세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '84A2',
    areaGroup: '84',
    units: 30,
    netAreaM2: 84.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 30,
      memberUnits: 15,
      reservedUnits: 0,
      generalSaleUnits: 15,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 15세대, 일반분양 15세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '84B',
    areaGroup: '84',
    units: 148,
    netAreaM2: 84.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 148,
      memberUnits: 37,
      reservedUnits: 3,
      generalSaleUnits: 108,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 37세대, 일반분양 108세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '84C',
    areaGroup: '84',
    units: 275,
    netAreaM2: 84.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 275,
      memberUnits: 255,
      reservedUnits: 0,
      generalSaleUnits: 20,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 255세대, 일반분양 20세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '84D',
    areaGroup: '84',
    units: 316,
    netAreaM2: 84.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 316,
      memberUnits: 290,
      reservedUnits: 0,
      generalSaleUnits: 26,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 290세대, 일반분양 26세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '84E',
    areaGroup: '84',
    units: 40,
    netAreaM2: 84.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 40,
      memberUnits: 17,
      reservedUnits: 1,
      generalSaleUnits: 22,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 17세대, 일반분양 22세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '84F',
    areaGroup: '84',
    units: 128,
    netAreaM2: 84.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 128,
      memberUnits: 121,
      reservedUnits: 0,
      generalSaleUnits: 7,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 121세대, 일반분양 7세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '84G',
    areaGroup: '84',
    units: 64,
    netAreaM2: 84.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 64,
      memberUnits: 60,
      reservedUnits: 0,
      generalSaleUnits: 4,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 60세대, 일반분양 4세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '84H',
    areaGroup: '84',
    units: 111,
    netAreaM2: 84.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 111,
      memberUnits: 5,
      reservedUnits: 3,
      generalSaleUnits: 103,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 5세대, 일반분양 103세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '84T1',
    areaGroup: '84',
    units: 20,
    netAreaM2: 84.9,
    specialFeatures: ['테라스'],
    allocation: {
      totalUnits: 20,
      memberUnits: 1,
      reservedUnits: 0,
      generalSaleUnits: 19,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 1세대, 일반분양 19세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '84T2',
    areaGroup: '84',
    units: 20,
    netAreaM2: 84.9,
    specialFeatures: ['테라스'],
    allocation: {
      totalUnits: 20,
      memberUnits: 13,
      reservedUnits: 0,
      generalSaleUnits: 7,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 13세대, 일반분양 7세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },

  // 90㎡ (43)
  {
    typeCode: '90A',
    areaGroup: '90',
    units: 43,
    netAreaM2: 90.5,
    specialFeatures: [],
    allocation: {
      totalUnits: 43,
      memberUnits: 43,
      reservedUnits: 0,
      generalSaleUnits: 0,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '현재 조합자료상 일반분양 배정 0세대',
    },
  },

  // 95㎡ (54)
  {
    typeCode: '95W',
    areaGroup: '95',
    units: 9,
    netAreaM2: 95.5,
    specialFeatures: [],
    allocation: {
      totalUnits: 9,
      memberUnits: 1,
      reservedUnits: 0,
      generalSaleUnits: 8,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 1세대, 일반분양 8세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '95X',
    areaGroup: '95',
    units: 45,
    netAreaM2: 95.5,
    specialFeatures: [],
    allocation: {
      totalUnits: 45,
      memberUnits: 3,
      reservedUnits: 0,
      generalSaleUnits: 42,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 3세대, 일반분양 42세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },

  // 98㎡ (536)
  {
    typeCode: '98A1',
    areaGroup: '98',
    units: 27,
    netAreaM2: 98.8,
    specialFeatures: [],
    allocation: {
      totalUnits: 27,
      memberUnits: 27,
      reservedUnits: 0,
      generalSaleUnits: 0,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '현재 조합자료상 일반분양 배정 0세대',
    },
  },
  {
    typeCode: '98A2',
    areaGroup: '98',
    units: 26,
    netAreaM2: 98.8,
    specialFeatures: [],
    allocation: {
      totalUnits: 26,
      memberUnits: 23,
      reservedUnits: 0,
      generalSaleUnits: 3,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 23세대, 일반분양 3세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '98B',
    areaGroup: '98',
    units: 148,
    netAreaM2: 98.8,
    specialFeatures: [],
    allocation: {
      totalUnits: 148,
      memberUnits: 138,
      reservedUnits: 0,
      generalSaleUnits: 10,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 138세대, 일반분양 10세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '98C',
    areaGroup: '98',
    units: 311,
    netAreaM2: 98.8,
    specialFeatures: [],
    allocation: {
      totalUnits: 311,
      memberUnits: 287,
      reservedUnits: 0,
      generalSaleUnits: 24,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 287세대, 일반분양 24세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '98D',
    areaGroup: '98',
    units: 16,
    netAreaM2: 98.8,
    specialFeatures: ['복층', '내부계단'],
    isDuplex: true,
    allocation: {
      totalUnits: 16,
      memberUnits: 6,
      reservedUnits: 0,
      generalSaleUnits: 10,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 6세대, 일반분양 10세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '98T',
    areaGroup: '98',
    units: 8,
    netAreaM2: 98.8,
    specialFeatures: ['테라스', '복층', '내부계단'],
    isDuplex: true,
    allocation: {
      totalUnits: 8,
      memberUnits: 7,
      reservedUnits: 0,
      generalSaleUnits: 1,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 7세대, 일반분양 1세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },

  // 107㎡ (9)
  {
    typeCode: '107W',
    areaGroup: '107',
    units: 9,
    netAreaM2: 107.5,
    specialFeatures: [],
    allocation: {
      totalUnits: 9,
      memberUnits: 8,
      reservedUnits: 0,
      generalSaleUnits: 1,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 8세대, 일반분양 1세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },

  // 114㎡ (199)
  {
    typeCode: '114A',
    areaGroup: '114',
    units: 103,
    netAreaM2: 114.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 103,
      memberUnits: 98,
      reservedUnits: 0,
      generalSaleUnits: 5,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 98세대, 일반분양 5세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '114B',
    areaGroup: '114',
    units: 96,
    netAreaM2: 114.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 96,
      memberUnits: 92,
      reservedUnits: 0,
      generalSaleUnits: 4,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 92세대, 일반분양 4세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },

  // 122㎡ (26)
  {
    typeCode: '122W',
    areaGroup: '122',
    units: 8,
    netAreaM2: 122.5,
    specialFeatures: [],
    allocation: {
      totalUnits: 8,
      memberUnits: 7,
      reservedUnits: 0,
      generalSaleUnits: 1,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 7세대, 일반분양 1세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },
  {
    typeCode: '122X',
    areaGroup: '122',
    units: 18,
    netAreaM2: 122.5,
    specialFeatures: [],
    allocation: {
      totalUnits: 18,
      memberUnits: 16,
      reservedUnits: 0,
      generalSaleUnits: 2,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '조합자료상 공급계획: 조합원 16세대, 일반분양 2세대 [조합자료 기준] [변경 가능] [최종 확정안 아님]',
    },
  },

  // 124㎡ (43)
  {
    typeCode: '124A',
    areaGroup: '124',
    units: 43,
    netAreaM2: 124.9,
    specialFeatures: [],
    allocation: {
      totalUnits: 43,
      memberUnits: 43,
      reservedUnits: 0,
      generalSaleUnits: 0,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '현재 조합자료상 일반분양 배정 0세대',
    },
  },

  // 134㎡ (5) - 원본 공급계획표상 134PA, 134PB 표기 보존
  {
    typeCode: '134A',
    areaGroup: '134',
    units: 4,
    netAreaM2: 134.9,
    specialFeatures: ['펜트하우스'],
    sourceAlias: '134PA',
    provenanceNote: '상세 분양계획표 원본상 134PA로 표기됨',
    allocation: {
      totalUnits: 4,
      memberUnits: 4,
      reservedUnits: 0,
      generalSaleUnits: 0,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '현재 조합자료상 일반분양 배정 0세대',
    },
  },
  {
    typeCode: '134B',
    areaGroup: '134',
    units: 1,
    netAreaM2: 134.9,
    specialFeatures: ['펜트하우스'],
    sourceAlias: '134PB',
    provenanceNote: '상세 분양계획표 원본상 134PB로 표기됨',
    allocation: {
      totalUnits: 1,
      memberUnits: 1,
      reservedUnits: 0,
      generalSaleUnits: 0,
      rentalUnits: 0,
      isArithmeticMatch: true,
      isConflict: false,
      statusNotice: '현재 조합자료상 일반분양 배정 0세대',
    },
  },
];

/**
 * Phase 4D-4C 원본 평면 Asset Batch 1 매핑 정의 (10개 타입)
 * 59A, 59B, 59C, 59D, 59E, 59F, 69W, 69X, 69Y, 72B
 */
export interface BatchAssetItem {
  typeName: string;
  originalFileName: string;
  servedFileName: string;
  assetPath: string;
  secondaryFileName?: string;
  secondaryAssetPath?: string;
  primaryAssetPath?: string;
  isDuplex?: boolean;
  isMultiLevel?: boolean;
}

export const CHOKJIN3_BATCH1_ASSETS: Record<string, BatchAssetItem> = {
  '59A': { typeName: '59A', originalFileName: '59a.jfif', servedFileName: '59a.jfif', assetPath: '/assets/plans/chokjin3/59a.jfif' },
  '59B': { typeName: '59B', originalFileName: '59b.jfif', servedFileName: '59b.jfif', assetPath: '/assets/plans/chokjin3/59b.jfif' },
  '59C': { typeName: '59C', originalFileName: '59c.jfif', servedFileName: '59c.jfif', assetPath: '/assets/plans/chokjin3/59c.jfif' },
  '59D': { typeName: '59D', originalFileName: '59d.jfif', servedFileName: '59d.jfif', assetPath: '/assets/plans/chokjin3/59d.jfif' },
  '59E': { typeName: '59E', originalFileName: '59e.jfif', servedFileName: '59e.jfif', assetPath: '/assets/plans/chokjin3/59e.jfif' },
  '59F': { typeName: '59F', originalFileName: '59f.jfif', servedFileName: '59f.jfif', assetPath: '/assets/plans/chokjin3/59f.jfif' },
  '69W': { typeName: '69W', originalFileName: '69w.jfif', servedFileName: '69w.jfif', assetPath: '/assets/plans/chokjin3/69w.jfif' },
  '69X': { typeName: '69X', originalFileName: '69x.jfif', servedFileName: '69x.jfif', assetPath: '/assets/plans/chokjin3/69x.jfif' },
  '69Y': { typeName: '69Y', originalFileName: '69y.jfif', servedFileName: '69y.jfif', assetPath: '/assets/plans/chokjin3/69y.jfif' },
  '72B': { typeName: '72B', originalFileName: '72b.jfif', servedFileName: '72b.jfif', assetPath: '/assets/plans/chokjin3/72b.jfif' },
  '74A': { typeName: '74A', originalFileName: '74a.jfif', servedFileName: '74a.jfif', assetPath: '/assets/plans/chokjin3/74a.jfif' },
  '84A1': { typeName: '84A1', originalFileName: '84a1.jfif', servedFileName: '84a1.jfif', assetPath: '/assets/plans/chokjin3/84a1.jfif' },
  '84A2': { typeName: '84A2', originalFileName: '84a2.jfif', servedFileName: '84a2.jfif', assetPath: '/assets/plans/chokjin3/84a2.jfif' },
  '84B': { typeName: '84B', originalFileName: '84b.jfif', servedFileName: '84b.jfif', assetPath: '/assets/plans/chokjin3/84b.jfif' },
  '84C': { typeName: '84C', originalFileName: '84c.jfif', servedFileName: '84c.jfif', assetPath: '/assets/plans/chokjin3/84c.jfif' },
  '84D': { typeName: '84D', originalFileName: '84d.jfif', servedFileName: '84d.jfif', assetPath: '/assets/plans/chokjin3/84d.jfif' },
  '84E': { typeName: '84E', originalFileName: '84e.jfif', servedFileName: '84e.jfif', assetPath: '/assets/plans/chokjin3/84e.jfif' },
  '84F': { typeName: '84F', originalFileName: '84f.jfif', servedFileName: '84f.jfif', assetPath: '/assets/plans/chokjin3/84f.jfif' },
  '84G': { typeName: '84G', originalFileName: '84g.jfif', servedFileName: '84g.jfif', assetPath: '/assets/plans/chokjin3/84g.jfif' },
  '84H': { typeName: '84H', originalFileName: '84h.jfif', servedFileName: '84h.jfif', assetPath: '/assets/plans/chokjin3/84h.jfif' },
  '84T1': { typeName: '84T1', originalFileName: '84t1.jfif', servedFileName: '84t1.jfif', assetPath: '/assets/plans/chokjin3/84t1.jfif' },
  '84T2': { typeName: '84T2', originalFileName: '84t2.jfif', servedFileName: '84t2.jfif', assetPath: '/assets/plans/chokjin3/84t2.jfif' },
  '90A': { typeName: '90A', originalFileName: '90a.jfif', servedFileName: '90a.jfif', assetPath: '/assets/plans/chokjin3/90a.jfif' },
  '95W': { typeName: '95W', originalFileName: '95w.jfif', servedFileName: '95w.jfif', assetPath: '/assets/plans/chokjin3/95w.jfif' },
  '95X': { typeName: '95X', originalFileName: '95x.jfif', servedFileName: '95x.jfif', assetPath: '/assets/plans/chokjin3/95x.jfif' },
  '98A1': { typeName: '98A1', originalFileName: '98a1.jfif', servedFileName: '98a1.jfif', assetPath: '/assets/plans/chokjin3/98a1.jfif' },
  '98A2': { typeName: '98A2', originalFileName: '98a2.jfif', servedFileName: '98a2.jfif', assetPath: '/assets/plans/chokjin3/98a2.jfif' },
  '98B': { typeName: '98B', originalFileName: '98b.jfif', servedFileName: '98b.jfif', assetPath: '/assets/plans/chokjin3/98b.jfif' },
  '98C': { typeName: '98C', originalFileName: '98c.jfif', servedFileName: '98c.jfif', assetPath: '/assets/plans/chokjin3/98c.jfif' },
  '98D': {
    typeName: '98D',
    originalFileName: '98d-1층.jfif',
    servedFileName: '98d-1층.jfif',
    assetPath: '/assets/plans/chokjin3/98d-1층.jfif',
    primaryAssetPath: '/assets/plans/chokjin3/98d-1층.jfif',
    secondaryFileName: '98d-2층.jfif',
    secondaryAssetPath: '/assets/plans/chokjin3/98d-2층.jfif',
    isDuplex: true,
    isMultiLevel: true,
  },
  '98T': {
    typeName: '98T',
    originalFileName: '98t-1층.jfif',
    servedFileName: '98t-1층.jfif',
    assetPath: '/assets/plans/chokjin3/98t-1층.jfif',
    primaryAssetPath: '/assets/plans/chokjin3/98t-1층.jfif',
    secondaryFileName: '98t-2층.jfif',
    secondaryAssetPath: '/assets/plans/chokjin3/98t-2층.jfif',
    isDuplex: true,
    isMultiLevel: true,
  },
  '107W': { typeName: '107W', originalFileName: '107w.jfif', servedFileName: '107w.jfif', assetPath: '/assets/plans/chokjin3/107w.jfif' },
  '114A': { typeName: '114A', originalFileName: '114a.jfif', servedFileName: '114a.jfif', assetPath: '/assets/plans/chokjin3/114a.jfif' },
  '114B': { typeName: '114B', originalFileName: '114b.jfif', servedFileName: '114b.jfif', assetPath: '/assets/plans/chokjin3/114b.jfif' },
  '122W': { typeName: '122W', originalFileName: '122w.jfif', servedFileName: '122w.jfif', assetPath: '/assets/plans/chokjin3/122w.jfif' },
  '122X': { typeName: '122X', originalFileName: '122x.jfif', servedFileName: '122x.jfif', assetPath: '/assets/plans/chokjin3/122x.jfif' },
  '124A': { typeName: '124A', originalFileName: '124a.jfif', servedFileName: '124a.jfif', assetPath: '/assets/plans/chokjin3/124a.jfif' },
  '134A': { typeName: '134A', originalFileName: '134a.jfif', servedFileName: '134a.jfif', assetPath: '/assets/plans/chokjin3/134a.jfif' },
  '134B': { typeName: '134B', originalFileName: '134b.jfif', servedFileName: '134b.jfif', assetPath: '/assets/plans/chokjin3/134b.jfif' },
};

/**
 * Phase 4D-5D: 촉진3구역 배치도 버전 SSOT
 */
export const CHOKJIN3_SITE_PLAN: FirestoreSitePlanDoc = {
  sitePlanId: 'chokjin-3-association-proposal-v1',
  projectId: 'chokjin-3',
  assetPath: '/assets/plans/chokjin3/배치도.jpg',
  sourceType: 'association',
  confirmationStatus: 'proposal',
  verificationStatus: 'verified-from-image',
  isCurrentKnownVersion: true,
  title: '촉진3구역 단지 전체 배치도 (조합안)',
  versionNotice: '본 배치도는 조합자료 기준 배치안이며 최종 확정 배치가 아닙니다. (변경 가능)',
  totalBuildingsCount: 18,
  totalUnitTypesMapped: 39,
  evidenceSourceId: 'chokjin-3-assoc-site-layout-v1',
  uploadedAt: '2026-09-14T00:00:00Z',
  verifiedAt: '2026-09-14T00:00:00Z',
};

/**
 * Phase 4D-5D: 18개 주동 원본 판독 데이터 SSOT
 */
export const CHOKJIN3_BUILDINGS: FirestoreBuildingDoc[] = [
  {
    buildingId: 'chokjin-3-bldg-101',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '101동',
    displayName: '101동',
    unitTypesShown: ['59A', '59B', '59C', '59E'],
    isTerraceHouse: false,
    notes: '소형 평형 위주 주동',
  },
  {
    buildingId: 'chokjin-3-bldg-102',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '102동',
    displayName: '102동',
    unitTypesShown: ['59A', '59B', '59C', '59E'],
    isTerraceHouse: false,
    notes: '소형 평형 위주 주동',
  },
  {
    buildingId: 'chokjin-3-bldg-103',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '103동',
    displayName: '103동',
    unitTypesShown: ['59B', '59C', '59D', '59F'],
    isTerraceHouse: false,
    notes: '소형 평형 위주 주동',
  },
  {
    buildingId: 'chokjin-3-bldg-104',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '104동',
    displayName: '104동',
    unitTypesShown: ['59B', '59C', '59D', '59F'],
    isTerraceHouse: false,
    notes: '소형 평형 위주 주동',
  },
  {
    buildingId: 'chokjin-3-bldg-105',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '105동',
    displayName: '105동',
    unitTypesShown: ['84B', '84C', '84D', '98C', '134A'],
    isTerraceHouse: false,
    notes: '84/98 중대형 및 최상층 펜트하우스(134A) 1세대 배치',
  },
  {
    buildingId: 'chokjin-3-bldg-106',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '106동',
    displayName: '106동',
    unitTypesShown: ['84C', '84D', '84F', '114A', '134A'],
    isTerraceHouse: false,
    notes: '84/114 대형 및 최상층 펜트하우스(134A) 1세대 배치',
  },
  {
    buildingId: 'chokjin-3-bldg-107',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '107동',
    displayName: '107동',
    unitTypesShown: ['84C', '84D', '84F', '114A', '134A'],
    isTerraceHouse: false,
    notes: '84/114 대형 및 최상층 펜트하우스(134A) 1세대 배치',
  },
  {
    buildingId: 'chokjin-3-bldg-108',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '108동',
    displayName: '108동',
    unitTypesShown: ['84C', '84D', '84F', '114A'],
    isTerraceHouse: false,
    notes: '84/114 중대형 판상형/타워형 혼합 주동',
  },
  {
    buildingId: 'chokjin-3-bldg-109',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '109동',
    displayName: '109동',
    unitTypesShown: ['84B', '84C', '84D', '98C'],
    isTerraceHouse: false,
    notes: '84/98 중대형 주동',
  },
  {
    buildingId: 'chokjin-3-bldg-110',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '110동',
    displayName: '110동',
    unitTypesShown: ['84C', '84D', '84F', '114B', '134B'],
    isTerraceHouse: false,
    notes: '84/114 대형 및 134B(단독 1세대) 펜트하우스 배치 주동',
  },
  {
    buildingId: 'chokjin-3-bldg-111',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '111동',
    displayName: '111동',
    unitTypesShown: ['84C', '84D', '84F', '114B'],
    isTerraceHouse: false,
    notes: '84/114 중대형 주동',
  },
  {
    buildingId: 'chokjin-3-bldg-112',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '112동',
    displayName: '112동',
    unitTypesShown: ['84B', '84C', '84D', '98C'],
    isTerraceHouse: false,
    notes: '84/98 중대형 주동',
  },
  {
    buildingId: 'chokjin-3-bldg-113',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '113동',
    displayName: '113동',
    unitTypesShown: ['84B', '84C', '84D', '98C'],
    isTerraceHouse: false,
    notes: '84/98 중대형 주동',
  },
  {
    buildingId: 'chokjin-3-bldg-114',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '114동',
    displayName: '114동',
    unitTypesShown: ['84C', '84D', '84F', '114A'],
    isTerraceHouse: false,
    notes: '84/114 중대형 주동',
  },
  {
    buildingId: 'chokjin-3-bldg-115',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '115동',
    displayName: '115동',
    unitTypesShown: ['84C', '84D', '84F', '114B', '134A'],
    isTerraceHouse: false,
    notes: '84/114 대형 및 최상층 펜트하우스(134A) 1세대 배치',
  },
  {
    buildingId: 'chokjin-3-bldg-116-t',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '116-T동',
    displayName: '116-T동 (테라스동)',
    unitTypesShown: ['98T'],
    isTerraceHouse: true,
    notes: '남향/공원 방면 테라스 특화동 (배치도 98T-4F 명시)',
  },
  {
    buildingId: 'chokjin-3-bldg-117-t',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '117-T동',
    displayName: '117-T동 (테라스동)',
    unitTypesShown: ['84T2'],
    isTerraceHouse: true,
    notes: '남향/공원 방면 테라스 특화동 (배치도 84T2-3F, 84T2-2F 명시)',
  },
  {
    buildingId: 'chokjin-3-bldg-118-t',
    projectId: 'chokjin-3',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    buildingNumber: '118-T동',
    displayName: '118-T동 (테라스동)',
    unitTypesShown: [],
    isTerraceHouse: true,
    notes: '테라스 복층 및 특화동 (84T1, 107W는 후보동으로 미확정 분류)',
  },
];

/**
 * 39개 타입별 배치도 감사 결과 매핑 데이터 (Cross Audit 검증 완료)
 */
interface UnitTypeMappingAudit {
  buildingNumbers: string[];
  mappingStatus: 'verified' | 'supported' | 'unresolved';
  candidateBuildingNumbers?: string[];
  keyPlanMatched: boolean;
  evidenceNotes: string;
}

export const CHOKJIN3_TYPE_MAPPINGS: Record<string, UnitTypeMappingAudit> = {
  // 59㎡ (956)
  '59A': {
    buildingNumbers: ['101동', '102동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 101동, 102동 표기 및 평면도 Key Plan 101, 102동 음영 일치',
  },
  '59B': {
    buildingNumbers: ['101동', '102동', '103동', '104동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 101, 102, 103, 104동 표기 및 평면도 Key Plan 4개동 음영 일치',
  },
  '59C': {
    buildingNumbers: ['101동', '102동', '103동', '104동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 101, 102, 103, 104동 표기 및 평면도 Key Plan 4개동 음영 일치',
  },
  '59D': {
    buildingNumbers: ['103동', '104동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 103동, 104동 표기 및 평면도 Key Plan 일치',
  },
  '59E': {
    buildingNumbers: ['101동', '102동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 101동, 102동 표기 및 평면도 Key Plan 일치',
  },
  '59F': {
    buildingNumbers: ['103동', '104동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 103동, 104동 표기 및 평면도 Key Plan 일치',
  },

  // 69㎡ (36)
  '69W': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },
  '69X': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },
  '69Y': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },

  // 72㎡ (64)
  '72B': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },

  // 74㎡ (10)
  '74A': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },

  // 84㎡ (1,384)
  '84A1': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도에는 84A로 통합 표기되어 있어 A1/A2 세부 동 배치를 확정할 수 없음 (세부 배치 확인 필요)',
  },
  '84A2': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도에는 84A로 통합 표기되어 있어 A1/A2 세부 동 배치를 확정할 수 없음 (세부 배치 확인 필요)',
  },
  '84B': {
    buildingNumbers: ['105동', '109동', '112동', '113동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 105, 109, 112, 113동 표기 및 평면도 Key Plan 4개동 음영 일치',
  },
  '84C': {
    buildingNumbers: ['105동', '106동', '107동', '108동', '109동', '110동', '111동', '112동', '113동', '114동', '115동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 105~115동(11개 주동) 표기 및 평면도 Key Plan 음영 일치',
  },
  '84D': {
    buildingNumbers: ['105동', '106동', '107동', '108동', '109동', '110동', '111동', '112동', '113동', '114동', '115동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 105~115동(11개 주동) 표기 및 평면도 Key Plan 음영 일치',
  },
  '84E': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },
  '84F': {
    buildingNumbers: ['106동', '107동', '108동', '110동', '111동', '114동', '115동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 106, 107, 108, 110, 111, 114, 115동(7개 주동) 표기 및 Key Plan 일치',
  },
  '84G': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },
  '84H': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },
  '84T1': {
    buildingNumbers: [],
    candidateBuildingNumbers: ['118-T동'],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도에는 84T2만 명시되어 84T1 문자열 미표기. 118-T동 후보군 추정이나 확정하지 않음 (미확정)',
  },
  '84T2': {
    buildingNumbers: ['117-T동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 117-T동 "84T2-3F", "84T2-2F" 직접 표기 확인',
  },

  // 90㎡ (43)
  '90A': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },

  // 95㎡ (54)
  '95W': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },
  '95X': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },

  // 98㎡ (536)
  '98A1': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },
  '98A2': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },
  '98B': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },
  '98C': {
    buildingNumbers: ['105동', '109동', '112동', '113동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 105, 109, 112, 113동 표기 및 평면도 Key Plan 4개동 음영 일치',
  },
  '98D': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },
  '98T': {
    buildingNumbers: ['116-T동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 116-T동 "98T-4F" 직접 표기 확인',
  },

  // 107㎡ (9)
  '107W': {
    buildingNumbers: [],
    candidateBuildingNumbers: ['118-T동'],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 107W 문자열 미표기. 테라스/특화동(118-T동) 후보 추정이나 공식 배치 미확정',
  },

  // 114㎡ (199)
  '114A': {
    buildingNumbers: ['106동', '107동', '108동', '114동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 106, 107, 108, 114동 표기 및 Key Plan 4개동 음영 일치',
  },
  '114B': {
    buildingNumbers: ['110동', '111동', '115동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '배치도 110, 111, 115동 표기 및 Key Plan 3개동 음영 일치',
  },

  // 122㎡ (26)
  '122W': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },
  '122X': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },

  // 124㎡ (43)
  '124A': {
    buildingNumbers: [],
    mappingStatus: 'unresolved',
    keyPlanMatched: false,
    evidenceNotes: '배치도상 테라스동 직접 표기 미확인 (세부 배치 확인 필요)',
  },

  // 134㎡ (5)
  '134A': {
    buildingNumbers: ['105동', '106동', '107동', '115동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '펜트하우스 4세대: 105, 106, 107, 115동 최상층 배치 확인 (104동은 오인식 배제, 총괄표 4세대와 완벽 일치)',
  },
  '134B': {
    buildingNumbers: ['110동'],
    mappingStatus: 'verified',
    keyPlanMatched: true,
    evidenceNotes: '펜트하우스 1세대: 110동 최상층 단독 1세대 배치 확인 (총괄표 1세대와 완벽 일치)',
  },
};

function buildUnitTypeDoc(spec: RawTypeSpec): FirestoreUnitTypeDoc {
  const isDuplex = !!spec.isDuplex;
  const fileNameBase = spec.typeCode.toLowerCase();
  const batchAsset = CHOKJIN3_BATCH1_ASSETS[spec.typeCode];
  const mappingAudit = CHOKJIN3_TYPE_MAPPINGS[spec.typeCode];

  const originalFileName = batchAsset
    ? batchAsset.originalFileName
    : (isDuplex ? `${fileNameBase}-1층.jfif` : `${fileNameBase}.jfif`);
  const servedFileName = batchAsset ? batchAsset.servedFileName : originalFileName;
  const assetPath = batchAsset ? batchAsset.assetPath : `/assets/plans/chokjin3/${servedFileName}`;
  const imageUrl = assetPath;

  const secondaryFileName = batchAsset?.secondaryFileName || (isDuplex ? `${fileNameBase}-2층.jfif` : null);
  const secondaryAssetPath = batchAsset?.secondaryAssetPath || (isDuplex ? `/assets/plans/chokjin3/${fileNameBase}-2층.jfif` : null);
  const secondaryImageUrl = secondaryAssetPath;

  return {
    unitTypeId: `chokjin-3-proposal-${spec.typeCode}`,
    typeName: spec.typeCode,
    typeCode: spec.typeCode,
    units: spec.units,
    projectId: 'chokjin-3',
    planVersionId: 'chokjin-3-association-proposal-v1',
    areaGroup: spec.areaGroup,
    netAreaM2: spec.netAreaM2,
    floorPlanAssetId: `asset-chokjin3-${spec.typeCode}`,
    locationMapIncludedInOriginal: true,
    specialFeatures: spec.specialFeatures,
    sourceAlias: spec.sourceAlias || null,
    verificationStatus: 'verified',
    confirmationStatus: 'proposal',
    allocation: spec.allocation,
    verifiedFacts: {
      typeName: spec.typeCode,
      units: spec.units,
      areaGroup: `${spec.areaGroup}㎡`,
      sourceType: 'association (조합원 총회/조합 배포자료)',
      evidence: spec.evidence || `조합 배포 세대수 설계안 표기 기준 (${spec.units}세대)`,
      hasLocationMap: true,
      verificationStatus: 'verified',
      confirmationStatus: 'proposal',
    },
    derivedAnalysis: {
      orientation: '미확정 (관리처분계획 및 동호수 배치 확정 시 산출)',
      view: '미확정 (시민공원 조망 등 배치도 기반 추후 분석)',
      bayCount: '미확정 (정식 건축도면 확인 후 확정)',
      roomsBaths: '미확정 (단위세대 상세 치수도면 확인 후 확정)',
      generalSaleAllocation: '미확정 (조합원 분양신청 결과 반영 후 확정)',
      notice: 'AI 임의 추정치 배제 원칙에 따라 정식 인가 문서 교차 검증 전까지 임의 생성하지 않습니다.',
    },
    sourceAsset: {
      assetId: `asset-chokjin3-${spec.typeCode}`,
      originalFileName,
      servedFileName,
      assetPath,
      secondaryFileName,
      assetType: 'floor_plan',
      imageUrl,
      secondaryImageUrl,
      isDuplex,
      isMultiLevel: isDuplex,
      primaryAssetPath: assetPath,
      secondaryAssetPath: secondaryAssetPath || undefined,
      floor1Label: isDuplex ? '1F (하층 도면)' : undefined,
      floor2Label: isDuplex ? '2F (상층 도면)' : undefined,
      sourceAssetVerified: true,
      fileExists: true,
    },
    provenance: {
      sourceType: '조합/사업주체 자료 (association)',
      sourceName: spec.provenanceNote
        ? `시민공원주변 촉진3구역 조합원 총회/조합 배포자료 (${spec.provenanceNote})`
        : '시민공원주변 촉진3구역 조합원 총회/조합 배포자료',
      documentTitle: '촉진3구역 단위세대 평면도(위치도) 및 상세 분양계획',
      publishedDate: null,
    },
    buildingNumbers: mappingAudit ? mappingAudit.buildingNumbers : [],
    mappingStatus: mappingAudit ? mappingAudit.mappingStatus : 'unresolved',
    candidateBuildingNumbers: mappingAudit ? mappingAudit.candidateBuildingNumbers : undefined,
    keyPlanMatched: mappingAudit ? mappingAudit.keyPlanMatched : false,
    evidenceNotes: mappingAudit ? mappingAudit.evidenceNotes : undefined,
    evidenceSourceId: 'chokjin-3-assoc-plan-v1',
    unverifiedAttributesNotice:
      '향, 조망, Bay 수, 방/욕실 수, 일반분양 여부는 공식 인가 후속 검증 예정 (현재 미확정)',
    createdAt: '2026-09-13T00:00:00Z',
  };
}

/**
 * 촉진3구역 39개 타입 확정 SSOT
 */
export const CHOKJIN3_UNIT_TYPES: FirestoreUnitTypeDoc[] = RAW_39_TYPES.map(buildUnitTypeDoc);

/**
 * Phase 4D-7B: 18개 주동 원본 배치도(2048x1422) 검증 Anchor 좌표 SSOT
 * - 기준 이미지: 2048 x 1422
 * - Phase 4D-7A 원본 배치도 및 overlay 시각검증 완료 좌표 (수정/재계산 금지)
 * - confirmationStatus: "proposal"
 */
export interface SitePlanCoordinate {
  buildingNumber: string;
  normalizedX: number;
  normalizedY: number;
  coordinateStatus: 'verified' | 'unverified';
  sitePlanId: string;
  confirmationStatus: 'proposal' | 'confirmed';
  label: string;
  isTerraceHouse: boolean;
}

export const CHOKJIN3_SITE_PLAN_COORDINATES: SitePlanCoordinate[] = [
  {
    buildingNumber: '101동',
    normalizedX: 0.0830,
    normalizedY: 0.7103,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '101',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '102동',
    normalizedX: 0.1611,
    normalizedY: 0.6610,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '102',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '103동',
    normalizedX: 0.2598,
    normalizedY: 0.5591,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '103',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '104동',
    normalizedX: 0.3491,
    normalizedY: 0.3657,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '104',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '105동',
    normalizedX: 0.4272,
    normalizedY: 0.4360,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '105',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '106동',
    normalizedX: 0.3457,
    normalizedY: 0.5802,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '106',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '107동',
    normalizedX: 0.4932,
    normalizedY: 0.6083,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '107',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '108동',
    normalizedX: 0.5786,
    normalizedY: 0.3868,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '108',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '109동',
    normalizedX: 0.6812,
    normalizedY: 0.4852,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '109',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '110동',
    normalizedX: 0.5737,
    normalizedY: 0.7630,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '110',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '111동',
    normalizedX: 0.7251,
    normalizedY: 0.7314,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '111',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '112동',
    normalizedX: 0.7935,
    normalizedY: 0.4747,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '112',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '113동',
    normalizedX: 0.8506,
    normalizedY: 0.6273,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '113',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '114동',
    normalizedX: 0.9404,
    normalizedY: 0.7954,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '114',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '115동',
    normalizedX: 0.8379,
    normalizedY: 0.8214,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '115',
    isTerraceHouse: false,
  },
  {
    buildingNumber: '116-T동',
    normalizedX: 0.3809,
    normalizedY: 0.7138,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '116-T',
    isTerraceHouse: true,
  },
  {
    buildingNumber: '117-T동',
    normalizedX: 0.8984,
    normalizedY: 0.6329,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '117-T',
    isTerraceHouse: true,
  },
  {
    buildingNumber: '118-T동',
    normalizedX: 0.7935,
    normalizedY: 0.2250,
    coordinateStatus: 'verified',
    sitePlanId: 'chokjin-3-association-proposal-v1',
    confirmationStatus: 'proposal',
    label: '118-T',
    isTerraceHouse: true,
  },
];

