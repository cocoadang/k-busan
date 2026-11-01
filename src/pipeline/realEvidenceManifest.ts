/**
 * Phase 4F-2: Real Plan Evidence Manifest & E2E Ingestion Traceability
 *
 * 목적:
 * 실제 파일시스템에 존재하는 Raw Asset(도면 이미지 등)으로부터
 * 정식 EvidenceReference, Fact Candidate, 검증(verified), 정규화(normalized),
 * 그리고 기존 Canonical Data와의 비교(MATCH / CONFLICT)까지의 E2E 추적성을 보장함.
 *
 * 엄격 원칙:
 * 1. 실제 존재하는 파일만 등록 (가짜 경로 금지)
 * 2. 이미지에서 명확하게 확인된 값만 Fact candidate로 추출 (No OCR Fabrication)
 * 3. Asset 존재 여부, Fact 검증 여부, Document 메타데이터 검증 여부를 명확히 분리
 * 4. Existing Data와 불일치 시 자동 덮어쓰기 금지 (CONFLICT 보고)
 * 5. 3,545세대 및 3,365세대 전체를 근거 없이 verified로 임의 승격하지 않음
 */

import {
  PlanFactCandidate,
  PlanEvidenceLocation,
  PlanFactField,
} from '../types/planEvidence.ts';
import { PlanEvidenceReference } from '../types/planConfig.ts';
import {
  createExtractedFact,
  verifyFact,
  normalizeFact,
} from './planEvidencePipeline.ts';

/**
 * 실물 Evidence 매니페스트 레코드 인터페이스
 */
export interface RealPlanEvidenceManifestItem {
  /** 사업지 식별자 */
  projectId: string;
  /** 상위 Document-level Evidence 식별자 */
  sourceId: string;
  /** 실제 웹 서빙 상대 경로 */
  assetPath: string;
  /** 파일시스템 원본 파일명 */
  fileName: string;
  /** 실물 파일 존재 검증 상태 */
  assetVerificationStatus: 'verified' | 'unverified';
  /** 공식 책자/고시 메타데이터 검증 상태 */
  metadataVerificationStatus: 'verified' | 'unverified';
  /** 문서 상태 */
  documentStatus: 'proposal' | 'approved' | 'confirmed' | 'historical' | 'unknown';
  /** 비고 또는 감사 메모 */
  auditNotes: string;
  /** 실제 확인된 Fact 목록 */
  facts: PlanFactCandidate[];
}

/**
 * 기존 Canonical 데이터와의 비교 결과
 */
export type FactComparisonResult = 'MATCH' | 'CONFLICT' | 'UNVERIFIED';

export interface FactComparisonReport {
  factId: string;
  field: PlanFactField;
  rawEvidenceValue: unknown;
  existingDataValue: unknown;
  result: FactComparisonResult;
  details: string;
}

/**
 * 84A1 실물 평면도 이미지(/assets/plans/chokjin3/84a1.jfif)로부터 추출된
 * 정식 E2E Fact 수명주기 데이터 생성
 */
function createChokjin3_84A1_Facts(): PlanFactCandidate[] {
  const assetPath = '/assets/plans/chokjin3/84a1.jfif';
  const fileName = '84a1.jfif';
  const sourceId = 'chokjin-3-assoc-plan-v1';
  const projectId = 'chokjin-3';

  // 1. 타입명 팩트 (unitType)
  // [Extracted]: 이미지 도면 표제부 텍스트 "84A1" 추출
  const rawUnitType = createExtractedFact<string>({
    factId: 'fact-chokjin3-84a1-typeCode',
    projectId,
    field: 'unitType',
    value: '84A1',
    sourceId,
    evidenceLocation: {
      assetPath,
      fileName,
      note: '도면 표제부 타입 식별 문자열 "84A1"',
    },
    auditNotes: '실물 이미지 84a1.jfif 도면 상단 타이틀에서 추출',
  });

  // [Verified]: 실물 파일 존재 및 육안/도면 표제 대조 확인
  const verifiedUnitType = verifyFact(rawUnitType, {
    verifiedBy: 'plan-engine-audit',
    notes: '84a1.jfif 이미지 내 84A1 문자열 실재 확인',
    evidenceLocation: rawUnitType.evidenceLocation,
  });

  // [Normalized]: Canonical typeCode '84A1'로 정규화
  const normalizedUnitType = normalizeFact<string, string>(verifiedUnitType, {
    normalizedValue: '84A1',
    notes: '대문자 정규화 타입코드 매핑 완료',
  });

  // 2. 세대수 팩트 (unitCount)
  // [Extracted]: 도면 상단 표기 "232세대" 추출
  const rawUnitCount = createExtractedFact<string>({
    factId: 'fact-chokjin3-84a1-units',
    projectId,
    field: 'unitCount',
    value: '232세대',
    sourceId,
    evidenceLocation: {
      assetPath,
      fileName,
      note: '도면 상단 총 건립 세대수 표기란',
    },
    auditNotes: '실물 이미지 84a1.jfif 상단 헤더 표기에서 추출',
  });

  // [Verified]: 실물 수치 232세대 확인
  const verifiedUnitCount = verifyFact(rawUnitCount, {
    verifiedBy: 'plan-engine-audit',
    notes: '84a1.jfif 이미지 내 "232" 숫자 실재 확인',
    evidenceLocation: rawUnitCount.evidenceLocation,
  });

  // [Normalized]: 정수형 number (232)로 정규화
  const normalizedUnitCount = normalizeFact<string, number>(verifiedUnitCount, {
    normalizedValue: 232,
    notes: '문자열("232세대")에서 단위 분리 후 정수 232로 정규화 완료',
  });

  return [normalizedUnitType, normalizedUnitCount];
}

/**
 * 촉진3 구역 실물 Evidence Ingestion 매니페스트
 */
export const REAL_PLAN_EVIDENCE_MANIFEST: RealPlanEvidenceManifestItem[] = [
  {
    projectId: 'chokjin-3',
    sourceId: 'chokjin-3-assoc-plan-v1',
    assetPath: '/assets/plans/chokjin3/84a1.jfif',
    fileName: '84a1.jfif',
    assetVerificationStatus: 'verified', // 실제 파일 크기 508,534 bytes, 2976x2105 JFIF 실재 확인
    metadataVerificationStatus: 'unverified', // 책자 정식 발간번호 및 총회 결의 공문 일자는 unverified
    documentStatus: 'proposal',
    auditNotes: '촉진3구역 84A1 단위세대 평면도 실물 에셋 (2976x2105 해상도). 타입명 84A1 및 232세대 실물 검증.',
    facts: createChokjin3_84A1_Facts(),
  },
];

/**
 * 실물 Evidence Fact와 기존 Canonical Data 비교기
 */
export function compareRealFactWithCanonicalData(
  fact: PlanFactCandidate,
  canonicalValue: unknown
): FactComparisonReport {
  if (canonicalValue === undefined || canonicalValue === null) {
    return {
      factId: fact.factId,
      field: fact.field,
      rawEvidenceValue: fact.value,
      existingDataValue: canonicalValue,
      result: 'UNVERIFIED',
      details: `기존 데이터베이스에 해당 필드(${fact.field}) 값이 존재하지 않습니다.`,
    };
  }

  // 동등성 비교
  const isMatch =
    fact.value === canonicalValue ||
    JSON.stringify(fact.value) === JSON.stringify(canonicalValue);

  if (isMatch) {
    return {
      factId: fact.factId,
      field: fact.field,
      rawEvidenceValue: fact.value,
      existingDataValue: canonicalValue,
      result: 'MATCH',
      details: `실물 Evidence 값(${JSON.stringify(fact.value)})과 기존 데이터(${JSON.stringify(canonicalValue)})가 정확히 일치합니다.`,
    };
  } else {
    return {
      factId: fact.factId,
      field: fact.field,
      rawEvidenceValue: fact.value,
      existingDataValue: canonicalValue,
      result: 'CONFLICT',
      details: `[상충 감지] 실물 Evidence 값(${JSON.stringify(fact.value)})과 기존 데이터(${JSON.stringify(canonicalValue)})가 불일치합니다. 자동 덮어쓰기가 엄격히 차단되었습니다.`,
    };
  }
}
