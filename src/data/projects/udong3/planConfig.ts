/**
 * 우동3구역 단지계획 설정 모듈 (ProjectPlanConfig)
 * Phase 4G-1: Udong3 Real Site Plan & Unit Plan Mapping
 * 
 * 원칙:
 * - 사용자가 직접 확인하여 업로드한 24개 타입 평면도 및 배치도 에셋을 직접 연결.
 * - hasSitePlan = true, hasUnitPlans = true, hasUnitComparison = true
 * - hasInteractiveCoordinates = false (좌표 임의 생성 금지)
 * - 39㎡ 임대(121세대)는 canonical factual data에 유지하되 평면도 UI(selector/viewer/comparison)에서 제외.
 */

import { ProjectPlanConfig } from '../../../types/planConfig.ts';
import {
  UDONG3_PLAN_VERSION,
  UDONG3_SITE_PLAN,
  UDONG3_AREA_GROUPS,
  UDONG3_UNIT_TYPES,
  UDONG3_BUILDINGS,
  UDONG3_SITE_PLAN_COORDINATES,
} from './planData.ts';

export const udong3PlanConfig: ProjectPlanConfig = {
  projectId: 'udong-3',
  projectName: '해운대 우동3구역 주택재개발정비사업',
  displayName: '우동3구역',
  capabilities: {
    hasSitePlan: true,
    hasInteractiveCoordinates: true,
    hasUnitPlans: true,
    hasBuildingMappings: true,
    hasSupplyAllocation: true,
    hasUnitComparison: true,
  },
  /** Phase 4H-1: 배치도, 주동 매핑, 단위세대 평면도 및 공급계획 연결 완료 */
  availability: {
    sitePlan: 'normalized',
    unitPlans: 'normalized',
    buildingMappings: 'normalized',
    supplyAllocation: 'normalized',
    unitComparison: 'normalized',
  },
  /** Phase 4G-1: 사업계획 상태 (proposal 유지) */
  documentStatus: 'proposal',
  /** Phase 4H-1: 원천 근거 자료 참조 목록 */
  evidenceSources: [
    {
      sourceId: 'udong3-mgmt-plan-official-notice-2026-68',
      sourceType: 'official',
      title: '우동3구역 주택재개발정비사업 관리처분계획인가 고시',
      issuer: '부산광역시 해운대구청 (해운대구 고시 제2026-68호 / 정정고시 제2026-73호)',
      documentStatus: 'confirmed',
      verificationStatus: 'verified',
      assetVerificationStatus: 'verified',
      metadataVerificationStatus: 'verified',
      evidenceNotes:
        '해운대구 고시 제2026-68호(인가일: 2026-05-14, 고시일: 2026-06-03) 기준 총 2,395세대(조합원 1,095세대, 일반분양 1,156세대, 보류지 23세대, 임대 121세대).',
      publishedAt: '2026-06-03',
    },
    {
      sourceId: 'udong3-site-plan-user-supplied-v1',
      sourceType: 'user-supplied',
      title: '우동3구역 단지 전체 배치도 (사용자 제공)',
      issuer: '우동3구역 재개발 조합/협력사 자료 (사용자 직접 확보)',
      documentStatus: 'proposal',
      verificationStatus: 'unverified',
      assetVerificationStatus: 'verified',
      metadataVerificationStatus: 'unverified',
      evidenceNotes: '사용자 직접 업로드 배치도 실물 에셋 (site-plan.png) 확보 완료. 공식 인허가 접수번호/발행일은 unverified 상태.',
      publishedAt: null,
    },
    {
      sourceId: 'udong3-unit-plans-user-supplied-v1',
      sourceType: 'user-supplied',
      title: '우동3구역 단위세대 평면도 (24종, 사용자 제공)',
      issuer: '우동3구역 재개발 조합/시공사(디에이치) 제안자료 (사용자 직접 확보)',
      documentStatus: 'proposal',
      verificationStatus: 'unverified',
      assetVerificationStatus: 'verified',
      metadataVerificationStatus: 'unverified',
      evidenceNotes: '사용자 직접 업로드 단위세대 평면도 24종 실물 에셋 확보 완료. 39㎡ 임대(121세대) 제외. 공식 책자 번호 및 발행일은 unverified 상태.',
      publishedAt: null,
    },
  ],
  planVersion: UDONG3_PLAN_VERSION,
  areaGroups: UDONG3_AREA_GROUPS,
  unitTypes: UDONG3_UNIT_TYPES,
  sitePlan: UDONG3_SITE_PLAN,
  buildings: UDONG3_BUILDINGS,
  coordinates: UDONG3_SITE_PLAN_COORDINATES,
  recommendedComparisons: [],
  notices: [
    '우동3구역 단지배치도 및 24개 타입 단위세대 평면도는 사용자 확보 자료 기준입니다.',
    '39㎡ 임대(121세대)는 전체 사업계획에 반영되어 있으나 단위세대 평면도 UI 선택 대상에서는 제외됩니다.',
    '본 도면 및 배치도는 최종 관리처분계획인가 확정 도면이 아니며, 인허가 과정에서 변경될 수 있습니다.',
  ],
};

export const UDONG3_PLAN_CONFIG = udong3PlanConfig;

