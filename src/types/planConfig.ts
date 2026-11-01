/**
 * Project Plan Engine - Common Plan Configuration & Capability Types
 * Phase 4E-2: Multi-Project Architectural Abstraction
 * 
 * 중요 원칙:
 * 1. 기존 Firestore 스키마(FirestorePlanVersionDoc, FirestoreUnitTypeDoc 등)를 재사용하며
 *    중복 데이터 모델을 생성하지 않음.
 * 2. sourceType('official' | 'association' | 'builder' | 'press')과
 *    confirmationStatus('proposal' | 'approved' | 'final' | 'unknown')는 엄격히 분리됨.
 *    - 공식문서(official)라 하더라도 인허가 이전 총회 자료면 'proposal'일 수 있으며 자동 'final' 판정 금지.
 * 3. 각 사업지별 자료 확보 수준(Capability)에 따라 UI가 적응형으로 동작하도록 지원함.
 */

import {
  FirestorePlanVersionDoc,
  FirestoreUnitTypeDoc,
  FirestoreSitePlanDoc,
  FirestoreBuildingDoc,
} from '../schema/firestoreSchema.ts';
import type {
  AreaGroupDefinition,
  SitePlanCoordinate,
} from '../data/chokjin3PlanData.ts';

export type {
  AreaGroupDefinition,
  SitePlanCoordinate,
};

/**
 * 사업계획 및 도면 문서의 인허가/확정 단계 상태 (Phase 4E-7)
 * - 'proposal': 조합 총회안 / 시공사 입찰제안안 / 조합원 배포안 (미확정 제안 단계)
 * - 'approved': 사업시행계획인가 등 공공 인허가를 득한 단계
 * - 'confirmed': 관리처분계획인가 등 최종 분양/착공 확정 단계
 * - 'final': confirmed와 동의어 (하위 호환)
 * - 'historical': 과거 효력 상실 또는 이전 버전 문서
 * - 'unknown': 인허가 단계 불명확 또는 정보 미확인
 */
export type PlanDocumentStatus =
  | 'proposal'
  | 'approved'
  | 'confirmed'
  | 'final'
  | 'historical'
  | 'unknown';

/** 기존 PlanConfirmationStatus 하위 호환 별칭 */
export type PlanConfirmationStatus = PlanDocumentStatus;

/**
 * 기능별 근거 원천 자료(Evidence)의 확보 및 정규화 상태 (Data Availability, Phase 4E-7)
 * - 'source_not_available': 원본 자료 자체가 아직 확보되지 않음
 * - 'source_available': 원본 자료는 확보했으나 구조화/정규화 작업이 아직 완료되지 않음
 * - 'normalized': 원본 Evidence를 근거로 구조화 데이터가 입력되고 검증됨
 */
export type PlanDataAvailability =
  | 'source_not_available'
  | 'source_available'
  | 'normalized';

/**
 * 기능 영역별 원본 자료 가용성 맵 (Phase 4E-7)
 */
export interface ProjectPlanAvailability {
  /** 전체 배치도 자료 가용성 */
  sitePlan: PlanDataAvailability;
  /** 단위세대 평면도 자료 가용성 */
  unitPlans: PlanDataAvailability;
  /** 주동-타입 매핑 자료 가용성 */
  buildingMappings: PlanDataAvailability;
  /** 공급계획 수치 가용성 */
  supplyAllocation: PlanDataAvailability;
  /** 단위세대 타입 비교 데이터 가용성 */
  unitComparison: PlanDataAvailability;
}

/**
 * 단지계획 및 도면 근거 원천 자료 참조 인터페이스 (Phase 4E-7)
 */
export interface PlanEvidenceReference {
  /** 원천 자료 식별자 (예: 'chokjin-3-assoc-plan-v1') */
  sourceId: string;
  /** 출처 유형 ('official' | 'association' | 'constructor' | 'press' | string) */
  sourceType?: 'official' | 'association' | 'constructor' | 'press' | string;
  /** 문서 제목 또는 자료명 */
  title?: string;
  /** 관리/문서 번호 (고시번호 등) */
  documentNumber?: string;
  /** 발행처 또는 제공 주체 */
  issuer?: string;
  /** 발행일자 또는 공고일자 (YYYY-MM-DD 또는 ISO 문자열) */
  publishedAt?: string | null;
  /** 문서 상태 (proposal, approved, confirmed, historical, unknown) */
  documentStatus?: PlanDocumentStatus;
  /** 원천 자료 종합 검증 상태 (Phase 4F-1 실재성 감사: verified, unverified) */
  verificationStatus?: 'verified' | 'unverified';
  /** Phase 4F-2: 원본 이미지/파일 에셋의 실물 존재 검증 상태 */
  assetVerificationStatus?: 'verified' | 'unverified';
  /** Phase 4F-2: 공문/책자 공식 메타데이터(발행주체/문서번호/일자) 검증 상태 */
  metadataVerificationStatus?: 'verified' | 'unverified';
  /** 근거 설명 또는 비고 */
  evidenceNotes?: string;
  /** 원본 확인 URL (있는 경우) */
  evidenceUrl?: string | null;
}

export * from './planEvidence.ts';

/**
 * 사업지별 단지계획 기능 지원 역량 (Capability Model)
 * - 모든 사업지가 촉진3처럼 39개 평면도와 조감 배치도를 전부 보유하고 있지 않으므로,
 *   실제 확보된 팩트에 따라 UI가 적응형으로 렌더링되도록 제어함.
 */
export interface ProjectPlanCapabilities {
  /** 조감도/배치도 원본 이미지 보유 여부 */
  hasSitePlan: boolean;
  /** 주동별 백분율 정규화 좌표(Interactive Markers) 보유 여부 */
  hasInteractiveCoordinates: boolean;
  /** 단위세대 평면도 원본 이미지 및 스펙 보유 여부 */
  hasUnitPlans: boolean;
  /** 주동-단위세대 간 배치 매핑 정보 보유 여부 */
  hasBuildingMappings: boolean;
  /** 조합원/일반분양/보류지 공급계획 수치 보유 여부 */
  hasSupplyAllocation: boolean;
  /** 단위세대 타입 간 다중 비교 기능 활성화 여부 */
  hasUnitComparison: boolean;
}

/**
 * 추천 비교 프리셋 정의
 */
export interface RecommendedComparisonPreset {
  id?: string;
  label?: string;
  title?: string;
  typeCodes: string[];
  description?: string;
}

/**
 * 단지계획 통합 프로젝트 설정 인터페이스
 */
export interface ProjectPlanConfig {
  /** 정비사업 고유 식별자 (예: 'chokjin-3', 'udong-3', 'samik-beach') */
  projectId: string;
  /** 정비사업 정식 표기 명칭 */
  projectName: string;
  /** 사용자 UI용 짧은 표시명 (예: '촉진3구역', '우동3구역', '삼익비치') */
  displayName?: string;
  /** 단지계획 기능 역량 플래그 */
  capabilities: ProjectPlanCapabilities;
  /** Phase 4E-7: 기능별 원본 자료 가용성 (Availability) */
  availability?: ProjectPlanAvailability;
  /** Phase 4E-7: 사업계획 문서 상태 (proposal, approved, confirmed, etc.) */
  documentStatus?: PlanDocumentStatus;
  /** Phase 4E-7: 원천 근거 자료(Evidence) 참조 목록 */
  evidenceSources?: PlanEvidenceReference[];
  /** 도면 계획안 버전 메타데이터 (미확보 시 null) */
  planVersion?: FirestorePlanVersionDoc | null;
  /** 면적군 정의 목록 (59㎡, 84㎡ 등) */
  areaGroups?: AreaGroupDefinition[];
  /** 단위세대 타입 마스터 목록 */
  unitTypes?: FirestoreUnitTypeDoc[];
  /** 배치도 메타데이터 (미확보 시 null) */
  sitePlan?: FirestoreSitePlanDoc | null;
  /** 주동 목록 */
  buildings?: FirestoreBuildingDoc[];
  /** 주동 정규화 좌표 목록 */
  coordinates?: SitePlanCoordinate[];
  /** 추천 비교 프리셋 목록 */
  recommendedComparisons?: RecommendedComparisonPreset[];
  /** 안내/고지 문구 목록 */
  notices?: string[];
}

/**
 * Plan Config 유효성 검증 결과
 */
export interface PlanConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * ProjectPlanConfig 무결성 검증 함수
 * 
 * 최소 검증 규칙:
 * 1. hasSitePlan === true인데 sitePlan 객체 또는 assetPath가 없는 경우 -> invalid
 * 2. hasInteractiveCoordinates === true인데 hasSitePlan이 false이거나 coordinates가 비어있거나 없는 경우 -> invalid
 * 3. hasUnitPlans === true인데 unitTypes가 비어있거나 없는 경우 -> invalid
 * 4. hasBuildingMappings === true인데 buildings 또는 unitTypes가 비어있거나 없는 경우 -> invalid
 * 5. hasSupplyAllocation === true인데 unitTypes가 없거나 allocation이 없는 경우 -> invalid
 * 6. hasUnitComparison === true인데 unitTypes가 2개 미만인 경우 -> invalid
 * 7. partial-data project (capabilities가 false이고 데이터가 null/빈배열인 경우) -> 정상 허용 (valid)
 * 8. 데이터 수정(mutation)을 절대 수행하지 않고 읽기 전용 검증만 수행.
 */
export function validateProjectPlanConfig(config: ProjectPlanConfig): PlanConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config) {
    return { isValid: false, errors: ['ProjectPlanConfig 객체가 null 또는 undefined입니다.'], warnings: [] };
  }

  if (!config.projectId || typeof config.projectId !== 'string') {
    errors.push('projectId는 필수 문자열이어야 합니다.');
  }

  if (!config.projectName || typeof config.projectName !== 'string') {
    errors.push('projectName은 필수 문자열이어야 합니다.');
  }

  if (!config.capabilities) {
    errors.push('capabilities 객체는 필수입니다.');
    return { isValid: false, errors, warnings };
  }

  const { capabilities } = config;

  // 1. 배치도 검증
  if (capabilities.hasSitePlan) {
    if (!config.sitePlan || !config.sitePlan.assetPath) {
      errors.push('hasSitePlan=true이나 유효한 sitePlan(또는 assetPath)이 제공되지 않았습니다.');
    }
  }

  // 2. 인터랙티브 좌표 검증
  if (capabilities.hasInteractiveCoordinates) {
    // Dependency: hasInteractiveCoordinates requires hasSitePlan=true
    if (!capabilities.hasSitePlan) {
      errors.push('hasInteractiveCoordinates=true이나 hasSitePlan=false입니다 (좌표는 배치도 기반이어야 합니다).');
    }
    if (!config.coordinates || config.coordinates.length === 0) {
      errors.push('hasInteractiveCoordinates=true이나 coordinates 배열이 비어있습니다.');
    }
  }

  // 3. 단위세대 평면 검증
  if (capabilities.hasUnitPlans) {
    if (!config.unitTypes || config.unitTypes.length === 0) {
      errors.push('hasUnitPlans=true이나 unitTypes 배열이 비어있습니다.');
    }
  }

  // 4. 주동 매핑 검증
  if (capabilities.hasBuildingMappings) {
    // Dependency: hasBuildingMappings requires buildings and unitTypes
    if (!config.buildings || config.buildings.length === 0) {
      errors.push('hasBuildingMappings=true이나 buildings 배열이 비어있습니다.');
    }
    if (!config.unitTypes || config.unitTypes.length === 0) {
      errors.push('hasBuildingMappings=true이나 매핑 대상 unitTypes 배열이 비어있습니다.');
    }
  }

  // 5. 공급계획 검증
  if (capabilities.hasSupplyAllocation) {
    // Dependency: hasSupplyAllocation requires unitTypes with allocation
    if (!config.unitTypes || config.unitTypes.length === 0 || !config.unitTypes.some((u) => u.allocation)) {
      errors.push('hasSupplyAllocation=true이나 단위세대 공급계획(allocation) 정보가 없습니다.');
    }
  }

  // 6. 타입 비교 검증
  if (capabilities.hasUnitComparison) {
    // Dependency: hasUnitComparison requires at least 2 unitTypes
    if (!config.unitTypes || config.unitTypes.length < 2) {
      errors.push('hasUnitComparison=true이나 비교할 단위세대(unitTypes)가 2개 미만입니다.');
    }
  }

  // 7. Phase 4E-7: Capability와 Availability 간 모순 검증 (Case A & Integrity)
  if (config.availability) {
    const { availability } = config;
    if (capabilities.hasSitePlan && availability.sitePlan === 'source_not_available') {
      errors.push('hasSitePlan=true이나 sitePlan availability가 "source_not_available"입니다 (자료 미확보 상태에서 기능 활성화 불가).');
    }
    if (capabilities.hasUnitPlans && availability.unitPlans === 'source_not_available') {
      errors.push('hasUnitPlans=true이나 unitPlans availability가 "source_not_available"입니다 (도면 미확보 상태에서 기능 활성화 불가).');
    }
    if (capabilities.hasBuildingMappings && availability.buildingMappings === 'source_not_available') {
      errors.push('hasBuildingMappings=true이나 buildingMappings availability가 "source_not_available"입니다 (매핑 자료 미확보).');
    }
    if (capabilities.hasSupplyAllocation && availability.supplyAllocation === 'source_not_available') {
      errors.push('hasSupplyAllocation=true이나 supplyAllocation availability가 "source_not_available"입니다 (공급계획 미확보).');
    }
    if (capabilities.hasUnitComparison && availability.unitComparison === 'source_not_available') {
      errors.push('hasUnitComparison=true이나 unitComparison availability가 "source_not_available"입니다.');
    }
  }

  // 8. Phase 4E-7: Evidence Reference 무결성 검증 (Case E: Unresolved sourceId 탐지)
  const referencedSourceIds: Array<{ id: string; location: string }> = [];
  if (config.planVersion?.evidenceSourceId) {
    referencedSourceIds.push({ id: config.planVersion.evidenceSourceId, location: 'planVersion.evidenceSourceId' });
  }
  if (config.planVersion?.totalSupplySummary?.evidenceSourceId) {
    referencedSourceIds.push({ id: config.planVersion.totalSupplySummary.evidenceSourceId, location: 'planVersion.totalSupplySummary.evidenceSourceId' });
  }
  if (config.sitePlan?.evidenceSourceId) {
    referencedSourceIds.push({ id: config.sitePlan.evidenceSourceId, location: 'sitePlan.evidenceSourceId' });
  }
  if (config.unitTypes && config.unitTypes.length > 0) {
    for (const u of config.unitTypes) {
      if (u.evidenceSourceId) {
        referencedSourceIds.push({ id: u.evidenceSourceId, location: `unitType[${u.typeCode}].evidenceSourceId` });
      }
    }
  }

  if (referencedSourceIds.length > 0) {
    const registeredSourceIds = new Set((config.evidenceSources || []).map((s) => s.sourceId));
    for (const ref of referencedSourceIds) {
      if (!registeredSourceIds.has(ref.id)) {
        errors.push(`존재하지 않는 원천 근거 자료(sourceId: "${ref.id}")를 참조하고 있습니다 (${ref.location} -> evidenceSources 미등록).`);
      }
    }
  }

  // 9. Phase 4E-7: Document Status 일관성 검증 (촉진3 제안안 상태 보존)
  if (config.documentStatus === 'proposal' && config.planVersion) {
    if (config.planVersion.confirmationStatus && config.planVersion.confirmationStatus !== 'proposal') {
      errors.push('documentStatus="proposal"이나 planVersion.confirmationStatus가 proposal이 아닙니다.');
    }
  }

  // 10. Capability와 데이터 간 모순 검사 (Warning 레벨 감지)
  if (!capabilities.hasSitePlan && config.sitePlan && config.sitePlan.assetPath) {
    warnings.push('hasSitePlan=false이나 sitePlan 데이터가 정의되어 있습니다.');
  }
  if (!capabilities.hasInteractiveCoordinates && config.coordinates && config.coordinates.length > 0) {
    warnings.push('hasInteractiveCoordinates=false이나 coordinates 데이터가 존재합니다.');
  }
  if (!capabilities.hasUnitPlans && config.unitTypes && config.unitTypes.length > 0) {
    warnings.push('hasUnitPlans=false이나 unitTypes 데이터가 존재합니다.');
  }
  if (!capabilities.hasBuildingMappings && config.buildings && config.buildings.length > 0) {
    const hasAnyTypeMappings = config.buildings.some((b) => b.unitTypesShown && b.unitTypesShown.length > 0);
    if (hasAnyTypeMappings) {
      warnings.push('hasBuildingMappings=false이나 buildings 데이터에 unitTypesShown 매핑이 존재합니다.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
