/**
 * Phase 5D: 모집공고 Onboarding 유효성 검증 엔진 (AnnouncementValidator)
 * 
 * 검증 원칙:
 * 1. 미확인 수치 0 입력 금지 (null 유지 여부 전수 검사)
 * 2. 각 값의 evidenceSourceId 누락 여부 검증
 * 3. 특별공급 세부 세대수 합계 및 총 공급 세대수 정합성 검증
 * 4. 일반공급 가점/추첨 비율 합계 100% 및 85㎡ 초과 추첨제 100% 규칙 검증
 * 5. verified / unresolved / conflict 상태 분기 및 conflict 리포팅
 */

import {
  SubscriptionAnnouncement,
  AnnouncementValidationResult,
  AnnouncementVerificationStatus,
} from '../types/subscriptionAnnouncement.ts';

export function validateSubscriptionAnnouncement(
  announcement: SubscriptionAnnouncement
): AnnouncementValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const conflictReport: string[] = [];

  // 1. 기본 메타데이터 검증
  if (!announcement.announcementId || announcement.announcementId.trim() === '') {
    errors.push('announcementId가 누락되었습니다.');
  }
  if (!announcement.projectId || announcement.projectId.trim() === '') {
    errors.push('projectId가 누락되었습니다.');
  }
  if (!announcement.projectName || announcement.projectName.trim() === '') {
    errors.push('projectName이 누락되었습니다.');
  }
  if (!announcement.announcementDate || !/^\d{4}-\d{2}-\d{2}$/.test(announcement.announcementDate)) {
    errors.push(`announcementDate 형식이 올바르지 않습니다 (YYYY-MM-DD 필수): ${announcement.announcementDate}`);
  }
  if (!announcement.overallEvidenceSourceId || announcement.overallEvidenceSourceId.trim() === '') {
    errors.push('공고문 전체 증빙 evidenceSourceId가 누락되었습니다.');
  }

  // 2. 검증 상태 확인
  if (announcement.status === 'conflict') {
    conflictReport.push('공고 데이터 내 원자료 불일치(Conflict) 플래그가 지정되어 있습니다.');
  } else if (announcement.status === 'unresolved') {
    warnings.push('공고 데이터가 미해결(Unresolved) 상태입니다. 공식 공고 최종 확인이 필요합니다.');
  }

  // 3. 증빙(evidenceSourceId) 연계 전수 검증
  const req = announcement.residenceRequirement;
  if (!req || !req.evidenceSourceId) {
    errors.push('거주요건(residenceRequirement)의 evidenceSourceId가 누락되었습니다.');
  }
  const summary = announcement.totalSupplySummary;
  if (!summary || !summary.evidenceSourceId) {
    errors.push('총공급 세대수(totalSupplySummary)의 evidenceSourceId가 누락되었습니다.');
  }
  const genRatio = announcement.generalAllocationRatio;
  if (!genRatio || !genRatio.evidenceSourceId) {
    errors.push('일반공급 비율(generalAllocationRatio)의 evidenceSourceId가 누락되었습니다.');
  }
  const bankbook = announcement.bankbookRequirement;
  if (!bankbook || !bankbook.evidenceSourceId) {
    errors.push('청약통장 요건(bankbookRequirement)의 evidenceSourceId가 누락되었습니다.');
  }
  const income = announcement.incomeAssetRequirement;
  if (!income || !income.evidenceSourceId) {
    errors.push('소득/자산 요건(incomeAssetRequirement)의 evidenceSourceId가 누락되었습니다.');
  }

  // 4. 거주요건 정합성
  if (req && req.requirementMonths < 0) {
    errors.push(`거주기간 요건은 음수일 수 없습니다: ${req.requirementMonths}`);
  }

  // 5. 총 공급 세대수 정합성 (확인된 값일 때만 합산 검증)
  if (
    summary &&
    summary.totalSupplyUnits !== null &&
    summary.specialSupplyTotalUnits !== null &&
    summary.generalSupplyTotalUnits !== null
  ) {
    if (summary.specialSupplyTotalUnits + summary.generalSupplyTotalUnits !== summary.totalSupplyUnits) {
      errors.push(
        `총 세대수 불일치: 특별공급(${summary.specialSupplyTotalUnits}) + 일반공급(${summary.generalSupplyTotalUnits}) !== 총 공급(${summary.totalSupplyUnits})`
      );
    }
  }

  // 6. 일반공급 가점/추첨 비율 정합성
  if (genRatio) {
    const under = genRatio.under85;
    if (under) {
      if (under.pointsRatio + under.lotteryRatio !== 100) {
        errors.push(`85㎡ 이하 공급비율 합계가 100%가 아닙니다: ${under.pointsRatio} + ${under.lotteryRatio}`);
      }
    }
    const over = genRatio.over85;
    if (over) {
      if (over.pointsRatio + over.lotteryRatio !== 100) {
        errors.push(`85㎡ 초과 공급비율 합계가 100%가 아닙니다: ${over.pointsRatio} + ${over.lotteryRatio}`);
      }
      // 비규제 부산 지역 85㎡ 초과는 가점 0%, 추첨 100%
      if (over.pointsRatio !== 0 || over.lotteryRatio !== 100) {
        warnings.push(`부산 비규제지역 85㎡ 초과는 통상 추첨 100%가 적용됩니다 (현재: 가점 ${over.pointsRatio}%, 추첨 ${over.lotteryRatio}%)`);
      }
    }
  }

  // 7. 타입별 상세 공급 계획 검증
  if (!announcement.typeSupplies || announcement.typeSupplies.length === 0) {
    errors.push('타입별 공급 세부 계획(typeSupplies)이 1건 이상 등록되어야 합니다.');
  } else {
    for (const typePlan of announcement.typeSupplies) {
      if (!typePlan.typeCode || typePlan.typeCode.trim() === '') {
        errors.push('주택형 typeCode가 누락되었습니다.');
      }
      if (!typePlan.exclusiveArea || typePlan.exclusiveArea <= 0) {
        errors.push(`전용면적은 0보다 커야 합니다 (${typePlan.typeCode}): ${typePlan.exclusiveArea}`);
      }
      if (!typePlan.evidenceSourceId) {
        errors.push(`타입 ${typePlan.typeCode}의 evidenceSourceId가 누락되었습니다.`);
      }

      // 평형 구분 정합성
      const expectedCat = typePlan.exclusiveArea <= 85.0 ? 'under85' : 'over85';
      if (typePlan.supplyCategory !== expectedCat) {
        errors.push(
          `타입 ${typePlan.typeCode}의 전용면적(${typePlan.exclusiveArea}㎡)과 supplyCategory(${typePlan.supplyCategory})가 불일치합니다.`
        );
      }

      // 특별공급 세부 세대수 합계 정합성 (확인된 값일 때)
      const spec = typePlan.specialSupply;
      if (spec && spec.totalSpecialQuota !== null) {
        const sumParts = [
          spec.multiChildQuota ?? 0,
          spec.newlywedQuota ?? 0,
          spec.firstLifeQuota ?? 0,
          spec.newbornQuota ?? 0,
          spec.elderlyParentQuota ?? 0,
          spec.institutionQuota ?? 0,
        ];
        const allPartsProvided =
          spec.multiChildQuota !== null &&
          spec.newlywedQuota !== null &&
          spec.firstLifeQuota !== null &&
          spec.newbornQuota !== null &&
          spec.elderlyParentQuota !== null;

        if (allPartsProvided) {
          const calculatedSpecialSum = sumParts.reduce((a, b) => a + b, 0);
          if (calculatedSpecialSum !== spec.totalSpecialQuota) {
            errors.push(
              `타입 ${typePlan.typeCode} 특별공급 세부 배정 합계(${calculatedSpecialSum}) !== 특공 총배정(${spec.totalSpecialQuota})`
            );
          }
        }
      }

      // 타입 총 공급 세대수 정합성
      if (
        typePlan.totalSupplyUnits !== null &&
        typePlan.specialSupply.totalSpecialQuota !== null &&
        typePlan.generalSupply.quota !== null
      ) {
        if (typePlan.specialSupply.totalSpecialQuota + typePlan.generalSupply.quota !== typePlan.totalSupplyUnits) {
          errors.push(
            `타입 ${typePlan.typeCode} 총 공급 세대수(${typePlan.totalSupplyUnits}) !== 특공(${typePlan.specialSupply.totalSpecialQuota}) + 일반(${typePlan.generalSupply.quota})`
          );
        }
      }

      // 일반공급 가점/추첨 비율 합계
      const gen = typePlan.generalSupply;
      if (gen && gen.pointsRatio + gen.lotteryRatio !== 100) {
        errors.push(
          `타입 ${typePlan.typeCode} 일반공급 가점/추첨 비율 합계(${gen.pointsRatio + gen.lotteryRatio}%)가 100%가 아닙니다.`
        );
      }
    }
  }

  // 8. 청약통장 예치금 요건 검증
  if (bankbook) {
    if (bankbook.minSubscriptionMonths < 0) {
      errors.push('청약통장 최소 가입기간은 0 이상이어야 합니다.');
    }
    if (bankbook.depositByArea.under85 < 300) {
      warnings.push(`부산 85㎡ 이하 기준 예치금은 통상 300만원 이상입니다 (현재: ${bankbook.depositByArea.under85}만원)`);
    }
  }

  const isValid = errors.length === 0;
  const canOnboard = isValid && announcement.status === 'verified';

  return {
    isValid,
    canOnboard,
    status: announcement.status,
    errors,
    warnings,
    conflictReport: conflictReport.length > 0 ? conflictReport : undefined,
  };
}
