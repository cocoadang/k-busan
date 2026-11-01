/**
 * Phase 4F-1: Plan Evidence Onboarding Pipeline
 *
 * 핵심 원칙:
 * 1. Evidence가 존재한다 ≠ 운영 데이터로 사용할 수 있다 (반드시 검증/정규화 단계 필요)
 * 2. Automatic Promotion 금지 (오직 normalized 상태만 명시적 승격 대상)
 * 3. Conflict 발생 시 임의 추정/최신일자 자동선택 금지 -> conflicted 상태로 격리
 * 4. Document Status와 Fact Status의 엄격한 분리
 */

import {
  PlanFactCandidate,
  PlanFactStatus,
  PlanFactField,
  PlanEvidenceLocation,
  PlanFactVerificationInput,
  PlanFactNormalizationInput,
  EvidenceValidationResult,
  EvidenceValidationIssue,
  FactPromotionResult,
} from '../types/planEvidence.ts';
import { PlanEvidenceReference, PlanDocumentStatus } from '../types/planConfig.ts';

const VALID_FACT_STATUSES: readonly PlanFactStatus[] = [
  'extracted',
  'pending_review',
  'verified',
  'normalized',
  'conflicted',
  'rejected',
] as const;

const DOCUMENT_STATUS_VALUES: readonly string[] = [
  'proposal',
  'approved',
  'confirmed',
  'final',
  'historical',
  'unknown',
];

/**
 * 두 값의 동등성 비교 (원시값 및 객체/배열 깊은 비교)
 */
export function areFactValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * 1. Extracted Fact 생성 (초기 추출 단계)
 */
export function createExtractedFact<T = unknown>(params: {
  factId: string;
  projectId: string;
  field: PlanFactField;
  value: T;
  sourceId: string;
  evidenceLocation?: PlanEvidenceLocation;
  auditNotes?: string;
}): PlanFactCandidate<T> {
  if (!params.factId || params.factId.trim() === '') {
    throw new Error('factId는 필수이며 비어있을 수 없습니다.');
  }
  if (!params.projectId || params.projectId.trim() === '') {
    throw new Error('projectId는 필수이며 비어있을 수 없습니다.');
  }
  if (!params.sourceId || params.sourceId.trim() === '') {
    throw new Error('sourceId는 필수입니다 (원천 Evidence 없는 Fact 생성 금지).');
  }

  return {
    factId: params.factId,
    projectId: params.projectId,
    field: params.field,
    value: params.value,
    sourceId: params.sourceId,
    status: 'extracted',
    evidenceLocation: params.evidenceLocation,
    extractedAt: new Date().toISOString(),
    auditNotes: params.auditNotes,
  };
}

/**
 * 2. Fact 검증 단계 (extracted / pending_review -> verified)
 */
export function verifyFact<T = unknown>(
  fact: PlanFactCandidate<T>,
  input?: PlanFactVerificationInput
): PlanFactCandidate<T> {
  if (fact.status === 'rejected') {
    throw new Error(`[V6_CANNOT_VERIFY_REJECTED] 기각된 Fact(${fact.factId})는 직접 검증할 수 없습니다.`);
  }
  if (fact.status === 'conflicted') {
    throw new Error(`[V5_CANNOT_VERIFY_CONFLICTED] 충돌 상태인 Fact(${fact.factId})는 충돌 해소 전 검증할 수 없습니다.`);
  }
  if (fact.status === 'normalized') {
    // 이미 normalized된 것은 verified 단계를 거친 것으로 간주
    return fact;
  }

  return {
    ...fact,
    status: 'verified',
    verifiedAt: new Date().toISOString(),
    verificationNote: input?.notes,
    evidenceLocation: input?.evidenceLocation ?? fact.evidenceLocation,
  };
}

/**
 * 3. Fact 정규화 단계 (verified -> normalized)
 * 반드시 verified 단계를 거친 팩트만 normalized로 전이 가능
 */
export function normalizeFact<TInput = unknown, TOutput = TInput>(
  fact: PlanFactCandidate<TInput>,
  input?: PlanFactNormalizationInput<TOutput>
): PlanFactCandidate<TOutput> {
  if (fact.status === 'extracted') {
    throw new Error(
      `[V7_PREMATURE_NORMALIZATION] extracted 상태인 Fact(${fact.factId})를 직접 normalized로 전이할 수 없습니다. 먼저 verified 단계를 거쳐야 합니다.`
    );
  }
  if (fact.status === 'rejected') {
    throw new Error(`[V6_CANNOT_NORMALIZE_REJECTED] 기각된 Fact(${fact.factId})는 정규화할 수 없습니다.`);
  }
  if (fact.status === 'conflicted') {
    throw new Error(`[V5_CANNOT_NORMALIZE_CONFLICTED] 충돌 상태인 Fact(${fact.factId})는 정규화할 수 없습니다.`);
  }
  if (fact.status !== 'verified' && fact.status !== 'normalized') {
    throw new Error(`Fact(${fact.factId})의 현재 상태(${fact.status})는 정규화 대상이 아닙니다.`);
  }

  const normalizedValue =
    input?.normalizedValue !== undefined
      ? input.normalizedValue
      : (fact.value as unknown as TOutput);

  return {
    ...fact,
    value: normalizedValue,
    status: 'normalized',
    normalizedAt: new Date().toISOString(),
    normalizationNote: input?.notes,
  };
}

/**
 * 4. Fact 기각 (extracted / verified / conflicted -> rejected)
 */
export function rejectFact<T = unknown>(
  fact: PlanFactCandidate<T>,
  reason: string
): PlanFactCandidate<T> {
  if (!reason || reason.trim() === '') {
    throw new Error('기각 사유(reason)를 반드시 명시해야 합니다.');
  }

  return {
    ...fact,
    status: 'rejected',
    rejectedReason: reason,
  };
}

/**
 * 5. Evidence Conflict Detection (충돌 감지기)
 *
 * 규칙:
 * - 동일 projectId + field에 대해, 서로 다른 값을 가진 복수의 활성 사실(verified 또는 normalized)이 존재할 때
 * - 날짜나 출처 등급에 따라 자동으로 하나를 선택하지 않는다 ("최신자료 우선" / "점수제" 절대 금지)
 * - 두 사실 모두 status: 'conflicted'로 격리하고 경합 세부정보를 기록한다.
 */
export function detectFactConflicts(facts: PlanFactCandidate[]): {
  hasConflict: boolean;
  resolvedFacts: PlanFactCandidate[];
  conflictedGroupCount: number;
} {
  // projectId + ":" + field 별로 그룹화
  const groups = new Map<string, PlanFactCandidate[]>();
  for (const f of facts) {
    const key = `${f.projectId}:${f.field}`;
    const list = groups.get(key) || [];
    list.push(f);
    groups.set(key, list);
  }

  let hasConflict = false;
  let conflictedGroupCount = 0;
  const result: PlanFactCandidate[] = [];

  for (const [key, group] of groups.entries()) {
    // rejected 및 extracted는 conflict 판정 대상에서 제외 (단, 이미 conflicted인 것도 재평가)
    const activeCandidates = group.filter(
      (f) => f.status === 'verified' || f.status === 'normalized' || f.status === 'conflicted'
    );

    if (activeCandidates.length <= 1) {
      result.push(...group);
      continue;
    }

    // 값들이 모두 같은지 검사
    const firstVal = activeCandidates[0].value;
    const isAllEqual = activeCandidates.every((c) => areFactValuesEqual(c.value, firstVal));

    if (isAllEqual) {
      // 값이 일치하면 충돌 아님
      result.push(...group);
    } else {
      // 충돌 발생!
      hasConflict = true;
      conflictedGroupCount += 1;
      const detectedAt = new Date().toISOString();

      for (const item of group) {
        if (item.status === 'rejected') {
          result.push(item);
          continue;
        }

        const otherCompetitors = activeCandidates.filter((o) => o.factId !== item.factId);
        const competingValues = otherCompetitors.map((o) => o.value);

        const conflictedItem: PlanFactCandidate = {
          ...item,
          status: 'conflicted',
          conflictDetails: {
            conflictingFactIds: otherCompetitors.map((o) => o.factId),
            competingValues,
            detectedAt,
            note: `동일 필드(${key})에 대해 상충하는 사실값(${JSON.stringify(item.value)} vs ${competingValues.map((v) => JSON.stringify(v)).join(', ')}) 감지. 자동 우선순위 결정 없이 보존됨.`,
          },
        };
        result.push(conflictedItem);
      }
    }
  }

  return {
    hasConflict,
    resolvedFacts: result,
    conflictedGroupCount,
  };
}

/**
 * 6. V1 ~ V8 무결성 검증 (validateFactsAgainstRegistry)
 */
export function validateFactsAgainstRegistry(
  facts: PlanFactCandidate[],
  registeredSources: PlanEvidenceReference[]
): EvidenceValidationResult {
  const errors: EvidenceValidationIssue[] = [];
  const warnings: EvidenceValidationIssue[] = [];
  const registeredSourceMap = new Map(registeredSources.map((s) => [s.sourceId, s]));

  for (const fact of facts) {
    // V8: documentStatus와 factStatus 혼용 방지 검증
    if (DOCUMENT_STATUS_VALUES.includes(fact.status as unknown as string)) {
      errors.push({
        code: 'V8_STATUS_TYPE_CONFUSION',
        level: 'error',
        message: `Fact(${fact.factId})의 status가 DocumentStatus 값("${fact.status}")으로 오지정되었습니다. factStatus는 extracted, verified, normalized 등이어야 합니다.`,
        factId: fact.factId,
        field: fact.field,
      });
    }

    if (!VALID_FACT_STATUSES.includes(fact.status)) {
      errors.push({
        code: 'V8_STATUS_TYPE_CONFUSION',
        level: 'error',
        message: `Fact(${fact.factId})의 status("${fact.status}")는 유효한 PlanFactStatus가 아닙니다.`,
        factId: fact.factId,
        field: fact.field,
      });
    }

    // V2: status = normalized인데 sourceId 없음
    if (fact.status === 'normalized' && (!fact.sourceId || fact.sourceId.trim() === '')) {
      errors.push({
        code: 'V2_NORMALIZED_WITHOUT_SOURCE',
        level: 'error',
        message: `Fact(${fact.factId})는 status가 normalized이나 근거 sourceId가 누락되었습니다.`,
        factId: fact.factId,
        field: fact.field,
      });
    }

    // V1: Fact의 sourceId가 registeredSources에 존재하지 않음
    if (fact.sourceId && !registeredSourceMap.has(fact.sourceId)) {
      errors.push({
        code: 'V1_MISSING_SOURCE_REGISTRATION',
        level: 'error',
        message: `Fact(${fact.factId})의 sourceId("${fact.sourceId}")가 프로젝트의 evidenceSources에 등록되어 있지 않습니다.`,
        factId: fact.factId,
        field: fact.field,
        sourceId: fact.sourceId,
      });
    }

    // V3: status = normalized인데 evidenceLocation 등 근거 추적 정보가 전혀 없음
    if (fact.status === 'normalized') {
      const loc = fact.evidenceLocation;
      const hasLocation =
        loc &&
        (loc.page !== undefined ||
          (loc.section && loc.section.trim() !== '') ||
          (loc.table && loc.table.trim() !== '') ||
          (loc.note && loc.note.trim() !== ''));

      if (!hasLocation) {
        warnings.push({
          code: 'V3_NO_EVIDENCE_LOCATION',
          level: 'warning',
          message: `Fact(${fact.factId})는 normalized 상태이나 구체적인 evidenceLocation(page, section, table 등)이 지정되지 않았습니다.`,
          factId: fact.factId,
          field: fact.field,
          sourceId: fact.sourceId,
        });
      }
    }
  }

  // V4: 동일 project + field에 서로 다른 normalized/verified 값 충돌 검증
  const conflictCheck = detectFactConflicts(facts);
  if (conflictCheck.hasConflict) {
    errors.push({
      code: 'V4_FACT_VALUE_CONFLICT',
      level: 'error',
      message: `${conflictCheck.conflictedGroupCount}개 필드에서 상충하는 사실값이 감지되었습니다. 충돌 해소 전까지 운영 데이터로 승격할 수 없습니다.`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 7. Promotion Guard (승격 자격 심사)
 *
 * 규칙:
 * - 오직 status === 'normalized' 인 Fact만 승격 가능
 * - extracted, pending_review, conflicted, rejected 상태는 무조건 승격 거부
 * - V5, V6, V7 위반 검증
 */
export function canPromoteFactToConfig<T = unknown>(
  fact: PlanFactCandidate<T>,
  allFactsForField?: PlanFactCandidate[]
): FactPromotionResult<T> {
  // V7: extracted 승격 시도 차단
  if (fact.status === 'extracted') {
    return {
      eligible: false,
      error: `[V7_CANNOT_PROMOTE_EXTRACTED] Fact(${fact.factId})의 status가 "extracted"입니다. 검증(verified) 및 정규화(normalized) 단계를 완료해야 합니다.`,
      fact,
    };
  }

  // pending_review 승격 차단
  if (fact.status === 'pending_review') {
    return {
      eligible: false,
      error: `[CANNOT_PROMOTE_PENDING_REVIEW] Fact(${fact.factId})의 status가 "pending_review"입니다.`,
      fact,
    };
  }

  // verified 승격 차단 (normalized 전 단계)
  if (fact.status === 'verified') {
    return {
      eligible: false,
      error: `[CANNOT_PROMOTE_VERIFIED_DIRECTLY] Fact(${fact.factId})는 verified 상태이나, 데이터 모델 정규화(normalized)가 완료되지 않았습니다.`,
      fact,
    };
  }

  // V5: conflicted 승격 시도 차단
  if (fact.status === 'conflicted') {
    return {
      eligible: false,
      error: `[V5_CANNOT_PROMOTE_CONFLICTED] Fact(${fact.factId})는 충돌(conflicted) 상태입니다. 경합 중인 사실은 자동으로 운영 데이터에 반영할 수 없습니다.`,
      fact,
    };
  }

  // V6: rejected 승격 시도 차단
  if (fact.status === 'rejected') {
    return {
      eligible: false,
      error: `[V6_CANNOT_PROMOTE_REJECTED] Fact(${fact.factId})는 기각(rejected)된 사실이므로 승격할 수 없습니다. (사유: ${fact.rejectedReason || '미기재'})`,
      fact,
    };
  }

  // allFactsForField가 주어진 경우, 활성 경쟁 팩트와의 충돌 유무 검사
  if (allFactsForField && allFactsForField.length > 1) {
    const competing = allFactsForField.filter(
      (f) =>
        f.factId !== fact.factId &&
        (f.status === 'normalized' || f.status === 'verified' || f.status === 'conflicted')
    );
    for (const c of competing) {
      if (!areFactValuesEqual(c.value, fact.value)) {
        return {
          eligible: false,
          error: `[V4_FACT_VALUE_CONFLICT] 다른 Fact(${c.factId}, 값: ${JSON.stringify(c.value)})와 상충합니다.`,
          fact,
        };
      }
    }
  }

  if (fact.status === 'normalized') {
    return {
      eligible: true,
      fact,
    };
  }

  return {
    eligible: false,
    error: `알 수 없는 상태("${fact.status}")이므로 승격할 수 없습니다.`,
    fact,
  };
}

/**
 * 8. Explicit Promotion Applier (명시적 수치 반영 함수)
 *
 * 주의: 절대 자동 실행되지 않으며, 개발자 또는 명시적 온보딩 트랜잭션에서만 호출됨.
 */
export function applyFactToTotalUnitsSummary(
  currentSummary: {
    totalUnits: number;
    nonRentalUnits: number;
    rentalUnits: number;
    memberUnits: number;
    reservedUnits: number;
    generalSaleUnits: number;
    evidenceSourceId?: string;
  },
  fact: PlanFactCandidate<number>,
  allFactsForField?: PlanFactCandidate[]
): {
  totalUnits: number;
  nonRentalUnits: number;
  rentalUnits: number;
  memberUnits: number;
  reservedUnits: number;
  generalSaleUnits: number;
  evidenceSourceId?: string;
} {
  const guard = canPromoteFactToConfig(fact, allFactsForField);
  if (!guard.eligible) {
    throw new Error(`[PROMOTION_GUARD_VIOLATION] ${guard.error}`);
  }

  if (fact.field === 'totalUnits') {
    return {
      ...currentSummary,
      totalUnits: fact.value,
      evidenceSourceId: fact.sourceId,
    };
  }
  if (fact.field === 'nonRentalUnits') {
    return {
      ...currentSummary,
      nonRentalUnits: fact.value,
      evidenceSourceId: fact.sourceId,
    };
  }
  if (fact.field === 'rentalUnits') {
    return {
      ...currentSummary,
      rentalUnits: fact.value,
      evidenceSourceId: fact.sourceId,
    };
  }
  if (fact.field === 'memberUnits') {
    return {
      ...currentSummary,
      memberUnits: fact.value,
      evidenceSourceId: fact.sourceId,
    };
  }
  if (fact.field === 'reservedUnits') {
    return {
      ...currentSummary,
      reservedUnits: fact.value,
      evidenceSourceId: fact.sourceId,
    };
  }
  if (fact.field === 'generalSaleUnits') {
    return {
      ...currentSummary,
      generalSaleUnits: fact.value,
      evidenceSourceId: fact.sourceId,
    };
  }

  throw new Error(`지원하지 않는 summary 필드("${fact.field}")입니다.`);
}
