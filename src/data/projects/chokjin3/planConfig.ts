/**
 * 촉진3구역 단지계획 설정 모듈 (ProjectPlanConfig Reference)
 * Phase 4E-2: SSOT Reference without Duplication
 * 
 * 중요 원칙:
 * - 기존 chokjin3PlanData.ts의 데이터를 복제하지 않고, 기존 SSOT를 import하여 참조(reference)만 제공함.
 * - 촉진3 비임대 3,365세대, 39개 타입, 18개 주동 좌표 원본 무결성 100% 보존.
 */

import {
  CHOKJIN3_PLAN_VERSION,
  CHOKJIN3_UNIT_TYPES,
  CHOKJIN3_SITE_PLAN,
  CHOKJIN3_BUILDINGS,
  CHOKJIN3_AREA_GROUPS,
  CHOKJIN3_SITE_PLAN_COORDINATES,
} from '../../chokjin3PlanData.ts';
import { ProjectPlanConfig } from '../../../types/planConfig.ts';

export const chokjin3PlanConfig: ProjectPlanConfig = {
  projectId: 'chokjin-3',
  projectName: '부산시민공원주변(촉진3구역) 재정비촉진구역',
  displayName: '촉진3구역',
  capabilities: {
    hasSitePlan: true,
    hasInteractiveCoordinates: true,
    hasUnitPlans: true,
    hasBuildingMappings: true,
    hasSupplyAllocation: true,
    hasUnitComparison: true,
  },
  /** Phase 4E-7: 기능별 원본 자료 가용성 */
  availability: {
    sitePlan: 'normalized',
    unitPlans: 'normalized',
    buildingMappings: 'normalized',
    supplyAllocation: 'normalized',
    unitComparison: 'normalized',
  },
  /** Phase 4E-7: 사업계획 상태 (반드시 proposal 유지) */
  documentStatus: 'proposal',
  /** Phase 4E-7: 원천 근거 자료 참조 목록 */
  evidenceSources: [
    {
      sourceId: 'chokjin-3-assoc-plan-v1',
      sourceType: 'association',
      title: '시민공원주변 촉진3구역 조합원 총회 및 조합 배포자료',
      issuer: '시민공원주변 촉진3구역 주택재개발정비사업조합',
      documentStatus: 'proposal',
      verificationStatus: 'unverified',
      assetVerificationStatus: 'verified',
      metadataVerificationStatus: 'unverified',
      evidenceNotes: '단위세대 평면도(위치도) 및 39개 타입 공급계획 (비임대 3,365 + 임대 180 = 총 3,545세대, 조합원 1,727 + 보류지 20 + 일반분양 1,618). 실물 평면도 이미지(39종) 확보되었으나 공식 책자 발행문서번호 및 발행일은 unverified 상태.',
      publishedAt: null,
    },
    {
      sourceId: 'chokjin-3-assoc-site-layout-v1',
      sourceType: 'association',
      title: '촉진3구역 단지 전체 배치도',
      issuer: '시민공원주변 촉진3구역 주택재개발정비사업조합',
      documentStatus: 'proposal',
      verificationStatus: 'unverified',
      assetVerificationStatus: 'verified',
      metadataVerificationStatus: 'unverified',
      evidenceNotes: '18개 주동 배치, 테라스동(116-T, 117-T, 118-T) 및 조경/공원 연계축. 배치도 그래픽 파일 실물 확보되었으나 공식 인허가 접수번호/발행일은 unverified 상태.',
      publishedAt: null,
    },
  ],
  planVersion: CHOKJIN3_PLAN_VERSION,
  areaGroups: CHOKJIN3_AREA_GROUPS,
  unitTypes: CHOKJIN3_UNIT_TYPES,
  sitePlan: CHOKJIN3_SITE_PLAN,
  buildings: CHOKJIN3_BUILDINGS,
  coordinates: CHOKJIN3_SITE_PLAN_COORDINATES,
  recommendedComparisons: [
    {
      id: '84a1-vs-98c',
      label: '84A1 vs 98C',
      typeCodes: ['84A1', '98C'],
      description: '세부배치 확인필요 타입과 일반동 확인 타입 대조',
    },
    {
      id: '84t1-vs-84t2',
      label: '84T1 vs 84T2',
      typeCodes: ['84T1', '84T2'],
      description: '테라스하우스 118-T동(후보) vs 117-T동(배치확인) 대조',
    },
    {
      id: '98c-vs-114a-vs-124a',
      label: '98C vs 114A vs 124A',
      typeCodes: ['98C', '114A', '124A'],
      description: '일반분양 물량 보유 타입(24세대, 5세대, 0세대) 공급계획 대조',
    },
    {
      id: '98d-vs-98t',
      label: '98D vs 98T',
      typeCodes: ['98D', '98T'],
      description: '복층 내부계단형 vs 테라스하우스 복층 평면 대조',
    },
  ],
  notices: [
    '본 평면 및 배치 자료는 조합원 총회 및 조합 배포자료 기준 제안안이며 최종 확정 설계가 아닙니다. (향후 인허가 과정에서 변경 가능)',
    '비임대 3,365세대(39개 타입) / 임대 180세대 / 사업총괄 3,545세대',
  ],
};

export const CHOKJIN3_PLAN_CONFIG = chokjin3PlanConfig;
