/**
 * 단지계획 프로젝트 레지스트리 (Plan Config Registry)
 * Phase 4E-2: Multi-Project Plan Config Management
 * 
 * 기능:
 * - chokjin-3, udong-3, samik-beach 3개 프로젝트의 Plan Config 등록 및 관리
 * - getProjectPlanConfig(projectId): 안전한 단일 프로젝트 조회 (미등록 id는 null 반환)
 * - getAllProjectPlanConfigs(): 등록된 전체 config 목록 조회
 */

import { ProjectPlanConfig } from '../../types/planConfig.ts';
import { chokjin3PlanConfig } from './chokjin3/planConfig.ts';
import { udong3PlanConfig } from './udong3/planConfig.ts';
import { gwacheon5PlanConfig } from './gwacheon5/planConfig.ts';
import { gwacheon10PlanConfig } from './gwacheon10/planConfig.ts';
import { gwacheon89PlanConfig } from './gwacheon89/planConfig.ts';
import { samikBeachPlanConfig } from './samikBeach/planConfig.ts';

const PLAN_CONFIG_REGISTRY: Record<string, ProjectPlanConfig> = {
  'chokjin-3': chokjin3PlanConfig,
  'udong-3': udong3PlanConfig,
  'samik-beach': samikBeachPlanConfig,
  'gwacheon-89': gwacheon89PlanConfig,
  'gwacheon-10': gwacheon10PlanConfig,
  'gwacheon-5': gwacheon5PlanConfig,
};

/**
 * 프로젝트 ID로 Plan Config를 안전하게 조회합니다.
 * @param projectId 조회할 정비사업 식별자 ('chokjin-3', 'udong-3', 'samik-beach' 등)
 * @returns 등록된 ProjectPlanConfig 객체 또는 null
 */
export function getProjectPlanConfig(projectId: string): ProjectPlanConfig | null {
  if (!projectId || typeof projectId !== 'string') {
    return null;
  }
  return PLAN_CONFIG_REGISTRY[projectId] || null;
}

/**
 * 등록된 모든 프로젝트의 Plan Config 목록을 반환합니다.
 */
export function getAllProjectPlanConfigs(): ProjectPlanConfig[] {
  return Object.values(PLAN_CONFIG_REGISTRY);
}
