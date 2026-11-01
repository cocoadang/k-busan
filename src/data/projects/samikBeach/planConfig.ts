/**
 * 삼익비치(남천2구역) 단지계획 설정 모듈 (ProjectPlanConfig)
 * Phase 4G-2: Samik Beach Real Site Plan & Unit Plan Mapping
 * 
 * 원칙:
 * - 사용자가 직접 확인하여 업로드한 19개 타입 평면도 및 배치도 에셋을 직접 연결.
 * - hasSitePlan = true, hasUnitPlans = true, hasUnitComparison = true
 * - hasInteractiveCoordinates = false (좌표 임의 생성 금지)
 * - hasBuildingMappings = false (주동 매핑 임의 생성 금지)
 * - 공급 세대수 추정 금지
 */

import { ProjectPlanConfig } from '../../../types/planConfig.ts';
import {
  SAMIK_BEACH_PLAN_VERSION,
  SAMIK_BEACH_SITE_PLAN,
  SAMIK_BEACH_AREA_GROUPS,
  SAMIK_BEACH_UNIT_TYPES,
  SAMIK_BEACH_BUILDINGS,
  SAMIK_BEACH_SITE_PLAN_COORDINATES,
} from './planData.ts';

export const samikBeachPlanConfig: ProjectPlanConfig = {
  projectId: 'samik-beach',
  projectName: '남천2구역(삼익비치) 주택재건축정비사업',
  displayName: '삼익비치',
  capabilities: {
    hasSitePlan: true,
    hasInteractiveCoordinates: true,
    hasUnitPlans: true,
    hasBuildingMappings: true,
    hasSupplyAllocation: false,
    hasUnitComparison: true,
  },
  /** Phase 4G-5: 배치도, 주동 매핑 및 단위세대 평면도 정규화 완료 */
  availability: {
    sitePlan: 'normalized',
    unitPlans: 'normalized',
    buildingMappings: 'normalized',
    supplyAllocation: 'source_not_available',
    unitComparison: 'normalized',
  },
  /** Phase 4G-2: 사업계획 상태 (proposal 유지) */
  documentStatus: 'proposal',
  /** Phase 4G-2: 원천 근거 자료 참조 목록 */
  evidenceSources: [
    {
      sourceId: 'samikbeach-site-plan-user-supplied-v1',
      sourceType: 'user-supplied',
      title: '남천2구역(삼익비치) 단지 전체 배치도 (사용자 제공)',
      issuer: '남천2구역 재건축 조합/시공사 제안자료 (사용자 직접 확보)',
      documentStatus: 'proposal',
      verificationStatus: 'unverified',
      assetVerificationStatus: 'verified',
      metadataVerificationStatus: 'unverified',
      evidenceNotes: '사용자 직접 업로드 배치도 실물 에셋 (site-plan.png) 확보 완료. 공식 인허가 접수번호/발행일은 unverified 상태.',
      publishedAt: null,
    },
    {
      sourceId: 'samikbeach-unit-plans-user-supplied-v1',
      sourceType: 'user-supplied',
      title: '남천2구역(삼익비치) 단위세대 평면도 (19종, 사용자 제공)',
      issuer: '남천2구역 재건축 조합/시공사 제안자료 (사용자 직접 확보)',
      documentStatus: 'proposal',
      verificationStatus: 'unverified',
      assetVerificationStatus: 'verified',
      metadataVerificationStatus: 'unverified',
      evidenceNotes: '사용자 직접 업로드 단위세대 평면도 19종 실물 에셋 확보 완료. 공식 책자 번호 및 발행일은 unverified 상태.',
      publishedAt: null,
    },
  ],
  planVersion: SAMIK_BEACH_PLAN_VERSION,
  areaGroups: SAMIK_BEACH_AREA_GROUPS,
  unitTypes: SAMIK_BEACH_UNIT_TYPES,
  sitePlan: SAMIK_BEACH_SITE_PLAN,
  buildings: SAMIK_BEACH_BUILDINGS,
  coordinates: SAMIK_BEACH_SITE_PLAN_COORDINATES,
  recommendedComparisons: [],
  notices: [
    '남천2구역(삼익비치) 단지배치도 및 19개 타입 단위세대 평면도는 사용자 확보 자료 기준입니다.',
    '공식 사업시행계획변경인가(부산 수영구 고시 제2026-71호) 기준 총 3,060세대(1:1 재건축)이나, 19개 신규 타입별 세부 세대수는 관리처분계획인가 전 단계로 공식 미확인 상태(추정 금지)입니다.',
    '본 도면 및 배치도는 최종 관리처분계획인가 확정 도면이 아니며, 인허가 과정에서 변경될 수 있습니다.',
  ],
};

export const SAMIK_BEACH_PLAN_CONFIG = samikBeachPlanConfig;

