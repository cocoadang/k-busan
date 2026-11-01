/**
 * Phase 5D: 입주자모집공고 데이터 온보딩 레지스트리 (SubscriptionAnnouncementRegistry)
 * 
 * 역할:
 * 1. 신규 입주자모집공고(촉진3·우동3 등)의 데이터 등록(Onboarding) 및 유효성 검증
 * 2. 공고 미등록 시 기존 "공고 확인 필요" 상태 유지
 * 3. 공고 등록 시 기존 Phase 5A~5C Rule Engine(evaluateSubscriptionEligibility 등)과
 *    자동 연동되는 AnnouncementRule 및 TypeComparisonRow 어댑터 제공
 */

import {
  SubscriptionAnnouncement,
  AnnouncementTypeSupplyPlan,
} from '../types/subscriptionAnnouncement.ts';
import {
  AnnouncementRule,
  TypeComparisonRow,
} from '../types/subscription.ts';
import { validateSubscriptionAnnouncement } from '../utils/announcementValidator.ts';

class SubscriptionAnnouncementRegistryService {
  private announcements: Map<string, SubscriptionAnnouncement> = new Map();

  /**
   * 신규 입주자모집공고 데이터 등록 및 온보딩
   */
  public registerAnnouncement(
    announcement: SubscriptionAnnouncement
  ): { success: boolean; errors: string[]; warnings: string[] } {
    const validation = validateSubscriptionAnnouncement(announcement);

    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    // 사업지 ID 기준으로 저장
    this.announcements.set(announcement.projectId, announcement);

    return {
      success: true,
      errors: [],
      warnings: validation.warnings,
    };
  }

  /** 사업지별 등록된 공고 조회 */
  public getAnnouncement(projectId: string): SubscriptionAnnouncement | undefined {
    return this.announcements.get(projectId);
  }

  /** 특정 사업지의 검증 완료된 공식 공고 등록 여부 확인 */
  public hasVerifiedAnnouncement(projectId: string): boolean {
    const ann = this.announcements.get(projectId);
    return ann !== undefined && ann.status === 'verified';
  }

  /** 모든 등록된 공고 목록 반환 */
  public getAllAnnouncements(): SubscriptionAnnouncement[] {
    return Array.from(this.announcements.values());
  }

  /**
   * SubscriptionAnnouncement 모델을 기존 Phase 5A~5C 청약엔진 규격(AnnouncementRule)으로 변환
   */
  public toEngineAnnouncementRule(announcement: SubscriptionAnnouncement): AnnouncementRule & { isOfficialRegistered?: boolean } {
    return {
      ruleId: `rule-${announcement.projectId}-official-${announcement.announcementDate}`,
      projectName: announcement.projectName,
      announcementDate: announcement.announcementDate,
      busanResidenceRequirementMonths: announcement.residenceRequirement.requirementMonths,
      isRestrictedArea: announcement.residenceRequirement.isRestrictedArea,
      generalAllocationRatio: {
        under85: announcement.generalAllocationRatio.under85,
        over85: announcement.generalAllocationRatio.over85,
      },
      specialSupplyRatios: {
        multiChildRatio: 10,
        newlywedRatio: 18,
        firstLifeRatio: 9,
        elderlyParentRatio: 3,
        institutionRatio: 10,
      },
      note: `공식 입주자모집공고 등록본 (공고일: ${announcement.announcementDate}, 증빙 ID: ${announcement.overallEvidenceSourceId})`,
      isOfficialRegistered: announcement.status === 'verified',
    };
  }

  /**
   * 온보딩된 공고의 타입 공급 계획을 Phase 5A 비교 행 규격(TypeComparisonRow)으로 변환
   */
  public toEngineTypeComparisonRows(announcement: SubscriptionAnnouncement): TypeComparisonRow[] {
    return announcement.typeSupplies.map((t) => {
      const isUnder85 = t.exclusiveArea <= 85.0;
      const supplyMethod = isUnder85
        ? `일반(가점 ${t.generalSupply.pointsRatio}% + 추첨 ${t.generalSupply.lotteryRatio}%)`
        : '일반(추첨 100%)';

      return {
        projectName: announcement.projectName,
        typeCode: t.typeCode,
        exclusiveArea: t.exclusiveArea,
        supplyMethod,
        quota: t.totalSupplyUnits ?? t.generalSupply.quota ?? '미정',
        eligibilityStatus: {
          canApplySpecial: (t.specialSupply.totalSpecialQuota ?? 0) > 0,
          specialTypes: isUnder85 ? ['신혼', '생초', '다자녀', '신생아', '노부모'] : ['다자녀'],
          canApplyGeneral: true,
          generalMethod: isUnder85 ? '가점제+추첨제' : '추첨제(100%)',
        },
      };
    });
  }

  /** 테스트용 레지스트리 초기화 */
  public clearForTesting(): void {
    this.announcements.clear();
  }
}

export const subscriptionAnnouncementRegistry = new SubscriptionAnnouncementRegistryService();
