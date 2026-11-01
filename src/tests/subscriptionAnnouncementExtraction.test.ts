/**
 * Phase 5E: 모집공고 Evidence Extraction Pipeline 테스트 스위트
 * 
 * 검증 항목:
 * 1. 정상 추출: PDF Document로부터 8대 영역 정밀 추출 및 evidenceSourceId/page/rawValue 보존
 * 2. 누락값 null: 원본 미기재 항목 0 대입 없이 null 유지 확인 (추정 금지)
 * 3. 표 파싱 오류: OCR/비정형 텍스트("미정", "N/A", 손상문자) 안전 파싱 및 null 보존
 * 4. 상충값 conflict: 서로 다른 페이지 간 불일치 수치 감지 시 conflict 상태 전환 및 격리
 * 5. Evidence page 추적: 모든 필드의 페이지, 표/섹션, 증빙 ID 추적성 검증
 * 6. Premature promotion 차단: 사람 검토(human review) 없이 verified 승격 및 Registry 등록 시도 시 차단
 * 7. 5D 연동: Human Review 승인 -> Phase 5D Validator 통과 -> Registry 등록 및 청약엔진 연동
 */

import {
  RawPdfAnnouncementDocument,
  RawPdfPageEvidence,
} from '../types/announcementExtraction.ts';
import {
  extractAnnouncementFromPdfEvidence,
  performHumanReview,
  convertCandidateToSubscriptionAnnouncement,
  onboardCandidateToRegistry,
} from '../pipeline/announcementExtractionPipeline.ts';
import { subscriptionAnnouncementRegistry } from '../registry/subscriptionAnnouncementRegistry.ts';
import { evaluateSubscriptionEligibility } from '../utils/subscriptionCalculator.ts';
import { UserSubscriptionProfile } from '../types/subscription.ts';

export interface TestResultItem {
  name: string;
  passed: boolean;
  message: string;
}

/** 정규 Fixture PDF 공고 문서 (촉진3구역 시뮬레이션 원본 문서 구조체) */
export const FIXTURE_PDF_ANNOUNCEMENT_DOC: RawPdfAnnouncementDocument = {
  documentId: 'doc-chokjin3-official-2026-pdf',
  documentTitle: '촉진3구역 아크로 센티엘 입주자모집공고',
  projectId: 'chokjin-3-extracted-test',
  sourceFileName: 'chokjin3_announcement_official_202610.pdf',
  publishedAt: '2026-10-20',
  pages: [
    {
      pageNumber: 1,
      sectionName: '표제부 및 공고일정',
      textSnippets: [
        '입주자모집공고일: 2026년 10월 20일',
        '본 아파트는 부산광역시 수영구/부산진구 비규제지역 민영주택입니다.',
        '일반공급 85㎡ 이하 가점 40% 추첨 60% 적용, 85㎡ 초과 추첨 100% 적용',
      ],
    },
    {
      pageNumber: 2,
      sectionName: '신청자격 및 거주요건',
      textSnippets: [
        '부산광역시 1년 이상 계속 거주자에게 해당지역 우선공급(100%)을 적용합니다.',
        '청약통장 가입기간 6개월 이상 경과 및 지역별 예치금액 충족 필수',
        '청약통장 예치금액 기준: 85㎡ 이하 300만원, 102㎡ 이하 600만원, 135㎡ 이하 1000만원, 모든 면적 1500만원',
      ],
    },
    {
      pageNumber: 3,
      sectionName: '특별공급 소득 및 자산기준',
      textSnippets: [
        '신혼부부, 생애최초, 신생아 특별공급 신청자는 소득 및 자산기준을 충족하여야 합니다.',
        '부동산가액 33,100만원 이하, 차량가액 3,708만원 이하 기준 적용',
      ],
    },
    {
      pageNumber: 4,
      sectionName: '공급규모 및 내역',
      tables: [
        {
          tableName: '공급규모 총괄표',
          headers: ['구분', '총공급세대수', '특별공급', '일반공급'],
          rows: [
            ['합계', '500세대', '250세대', '250세대'],
          ],
        },
      ],
    },
    {
      pageNumber: 5,
      sectionName: '주택형별 세부 공급계획',
      tables: [
        {
          tableName: '주택형별 특별공급 및 일반공급 배정표',
          headers: ['주택형', '전용면적', '공급세대수', '다자녀', '신혼부부', '생애최초', '신생아', '노부모', '기관추천', '특별공급계', '일반공급'],
          rows: [
            ['59A', '59.95', '200세대', '20', '36', '18', '14', '6', '6', '100', '100'],
            ['84A', '84.92', '300세대', '30', '54', '27', '21', '9', '9', '150', '150'],
          ],
        },
      ],
    },
  ],
};

export function runAnnouncementExtractionTestSuite(): {
  total: number;
  passed: number;
  results: TestResultItem[];
} {
  const results: TestResultItem[] = [];

  const addResult = (name: string, passed: boolean, message: string) => {
    results.push({ name, passed, message });
  };

  // Test 1: 정상 추출 및 Evidence Trace 메타데이터(evidenceSourceId, page, rawValue) 전수 검증
  {
    const candidate = extractAnnouncementFromPdfEvidence(FIXTURE_PDF_ANNOUNCEMENT_DOC);

    const hasDateTrace =
      candidate.announcementDate.value === '2026-10-20' &&
      candidate.announcementDate.page === 1 &&
      candidate.announcementDate.evidenceSourceId.includes('p1') &&
      Boolean(candidate.announcementDate.rawValue);

    const hasResTrace =
      candidate.residenceRequirement.requirementMonths.value === 12 &&
      candidate.residenceRequirement.requirementMonths.page === 2 &&
      candidate.residenceRequirement.requirementMonths.evidenceSourceId.includes('p2');

    const hasSummaryTrace =
      candidate.totalSupplySummary.totalSupplyUnits.value === 500 &&
      candidate.totalSupplySummary.specialSupplyTotalUnits.value === 250 &&
      candidate.totalSupplySummary.generalSupplyTotalUnits.value === 250 &&
      candidate.totalSupplySummary.totalSupplyUnits.page === 4;

    const hasTypeTrace =
      candidate.typeSupplies.length === 2 &&
      candidate.typeSupplies[0].typeCode.value === '59A' &&
      candidate.typeSupplies[0].exclusiveArea.value === 59.95 &&
      candidate.typeSupplies[0].specialSupply.newbornQuota.value === 14 &&
      candidate.typeSupplies[0].typeCode.page === 5;

    const initialLifecycle = candidate.lifecycleStatus === 'extracted';

    const passed =
      hasDateTrace &&
      hasResTrace &&
      hasSummaryTrace &&
      hasTypeTrace &&
      initialLifecycle;

    addResult(
      'Test 1: PDF Document로부터 정상 추출 및 evidenceSourceId/page/rawValue 전수 보존',
      passed,
      `공고일(${candidate.announcementDate.value}), 거주요건(${candidate.residenceRequirement.requirementMonths.value}개월), 총공급(${candidate.totalSupplySummary.totalSupplyUnits.value}세대), 타입수(${candidate.typeSupplies.length}개), 초기상태(${candidate.lifecycleStatus})`
    );
  }

  // Test 2: 원본 누락값 0 대입 없이 null 유지 검증 (추정 금지 원칙)
  {
    const incompleteDoc: RawPdfAnnouncementDocument = {
      ...FIXTURE_PDF_ANNOUNCEMENT_DOC,
      documentId: 'doc-incomplete-test',
      pages: [
        {
          pageNumber: 1,
          textSnippets: ['입주자모집공고일: 2026-11-01'],
        },
        {
          pageNumber: 2,
          tables: [
            {
              tableName: '일부 누락 표',
              headers: ['주택형', '전용면적', '공급세대수', '다자녀', '신혼부부', '생애최초', '신생아', '노부모', '기관추천', '특별공급계', '일반공급'],
              rows: [
                ['104A', '104.5', '100', '10', '-', '-', '-', '3', '-', '13', '87'], // 신혼, 생초, 신생아, 기관추천 대형평형 미기재
              ],
            },
          ],
        },
      ],
    };

    const candidate = extractAnnouncementFromPdfEvidence(incompleteDoc);
    const type104 = candidate.typeSupplies.find((t) => t.typeCode.value === '104A');

    const newlywedIsNull = type104?.specialSupply.newlywedQuota.value === null;
    const firstLifeIsNull = type104?.specialSupply.firstLifeQuota.value === null;
    const newbornIsNull = type104?.specialSupply.newbornQuota.value === null;
    const rawValuePreserved = type104?.specialSupply.newlywedQuota.rawValue === '-';

    const passed = newlywedIsNull && firstLifeIsNull && newbornIsNull && rawValuePreserved;

    addResult(
      'Test 2: 원본 표의 미기재/누락 항목 0 대입 없이 null 유지 (추정 금지 원칙)',
      passed,
      `신혼Quota=null(${newlywedIsNull}), 생초Quota=null(${firstLifeIsNull}), 신생아Quota=null(${newbornIsNull}), rawValue='-' 보존(${rawValuePreserved})`
    );
  }

  // Test 3: 표 파싱 오류 및 OCR 비정형 문자열("미정", "N/A", 손상문자) 안전 파싱
  {
    const malformedDoc: RawPdfAnnouncementDocument = {
      ...FIXTURE_PDF_ANNOUNCEMENT_DOC,
      documentId: 'doc-malformed-test',
      pages: [
        {
          pageNumber: 1,
          tables: [
            {
              tableName: '손상된 표',
              headers: ['주택형', '전용면적', '공급세대수'],
              rows: [
                ['59B', '오류-59㎡', '미정'],
                ['84B', '84.95', 'N/A'],
              ],
            },
          ],
        },
      ],
    };

    const candidate = extractAnnouncementFromPdfEvidence(malformedDoc);
    const type59B = candidate.typeSupplies.find((t) => t.typeCode.value === '59B');
    const type84B = candidate.typeSupplies.find((t) => t.typeCode.value === '84B');

    const areaNull = type59B?.exclusiveArea.value === null;
    const areaRaw = type59B?.exclusiveArea.rawValue === '오류-59㎡';
    const quota59Null = type59B?.totalSupplyUnits.value === null;
    const quota84Null = type84B?.totalSupplyUnits.value === null;

    const passed = areaNull && areaRaw && quota59Null && quota84Null;

    addResult(
      'Test 3: OCR/표 비정형 문자열("미정", "N/A", 손상 텍스트) 안전 파싱 및 null 보존',
      passed,
      `비정형 면적 null(${areaNull}, raw="${areaRaw}"), "미정" 세대수 null(${quota59Null}), "N/A" 세대수 null(${quota84Null})`
    );
  }

  // Test 4: 복수 페이지 간 상충값(Conflict) 감지 시 conflict 상태 전환 및 격리
  {
    const conflictingDoc: RawPdfAnnouncementDocument = {
      ...FIXTURE_PDF_ANNOUNCEMENT_DOC,
      documentId: 'doc-conflict-test',
      pages: [
        {
          pageNumber: 1,
          tables: [
            {
              tableName: '1페이지 총괄표',
              headers: ['구분', '총 세대수', '특별공급', '일반공급'],
              rows: [['합계', '500', '250', '250']],
            },
          ],
        },
        {
          pageNumber: 3,
          tables: [
            {
              tableName: '3페이지 총괄표',
              headers: ['구분', '총 세대수', '특별공급', '일반공급'],
              rows: [['합계', '550', '275', '275']], // 500과 550 상충!
            },
          ],
        },
      ],
    };

    const candidate = extractAnnouncementFromPdfEvidence(conflictingDoc);

    const isConflict =
      candidate.lifecycleStatus === 'conflict' &&
      candidate.totalSupplySummary.totalSupplyUnits.status === 'conflict' &&
      candidate.extractionLogs.some((l) => l.includes('상충 발생'));

    const passed = isConflict;

    addResult(
      'Test 4: 서로 다른 페이지 간 불일치 수치 감지 시 conflict 상태 전환 및 격리',
      passed,
      `후보 상태: ${candidate.lifecycleStatus}, 총세대수 필드 상태: ${candidate.totalSupplySummary.totalSupplyUnits.status}`
    );
  }

  // Test 5: Premature Promotion 차단 (사람 검토 없는 승격/등록 엄격 거부)
  {
    const candidate = extractAnnouncementFromPdfEvidence(FIXTURE_PDF_ANNOUNCEMENT_DOC);

    let convertBlocked = false;
    try {
      // verified 상태가 아닌 candidate를 convert 시도 -> throw 확인
      convertCandidateToSubscriptionAnnouncement(candidate);
    } catch (err: any) {
      if (err.message.includes('Premature promotion blocked')) {
        convertBlocked = true;
      }
    }

    // Registry 등록 시도 -> 등록 실패 확인
    const regResult = onboardCandidateToRegistry(candidate);
    const onboardBlocked =
      regResult.success === false &&
      regResult.errors.some((e) => e.includes('Premature promotion blocked'));

    const passed = convertBlocked && onboardBlocked;

    addResult(
      'Test 5: 사람 검토(human review) 없는 premature promotion 및 Registry 등록 전면 차단',
      passed,
      `변환 차단 예외 발생(${convertBlocked}), Registry 온보딩 차단(${onboardBlocked})`
    );
  }

  // Test 6: Human Review 승인 -> Verified 승격 정상 동작
  {
    const candidate = extractAnnouncementFromPdfEvidence(FIXTURE_PDF_ANNOUNCEMENT_DOC);

    // 사람 검토 수행 (Reviewer 승인)
    const reviewedCandidate = performHumanReview(candidate, {
      reviewerId: 'auditor-kim-01',
      decision: 'approve',
      comments: 'PDF 1~5페이지 대조 완료. 오탈자 없음 확인.',
    });

    const passed =
      reviewedCandidate.lifecycleStatus === 'verified' &&
      reviewedCandidate.humanReviewRecord?.reviewerId === 'auditor-kim-01' &&
      reviewedCandidate.humanReviewRecord?.decision === 'approved';

    addResult(
      'Test 6: 사람 검토(Human Review) 완료 후 정식 verified 상태 전이',
      passed,
      `전이된 상태: ${reviewedCandidate.lifecycleStatus}, 검토자: ${reviewedCandidate.humanReviewRecord?.reviewerId}`
    );
  }

  // Test 7: Phase 5D Validator & Registry 연동 및 청약엔진 자격판정 직결
  {
    subscriptionAnnouncementRegistry.clearForTesting();

    const candidate = extractAnnouncementFromPdfEvidence(FIXTURE_PDF_ANNOUNCEMENT_DOC);
    const reviewedCandidate = performHumanReview(candidate, {
      reviewerId: 'lead-engineer-01',
      decision: 'approve',
      comments: '정규 Fixture 온보딩 승인',
    });

    // 온보딩 파이프라인 실행
    const onboardResult = onboardCandidateToRegistry(reviewedCandidate);

    // Phase 5D Registry 등록 확인
    const isRegistered = subscriptionAnnouncementRegistry.hasVerifiedAnnouncement('chokjin-3-extracted-test');
    const storedAnn = subscriptionAnnouncementRegistry.getAnnouncement('chokjin-3-extracted-test');

    // Rule Engine 어댑터 변환
    const rule = subscriptionAnnouncementRegistry.toEngineAnnouncementRule(storedAnn!);

    // Rule Engine 자격평가 실행 (2026 공고이므로 2024-11 출생 자녀 신생아 특공 충족)
    const testProfile: UserSubscriptionProfile = {
      residenceRegion: 'busan',
      busanTransferDate: '2023-01-01',
      isHouseholder: true,
      isHomeless: true,
      homelessYears: 4,
      homelessSince: '2022-01-01',
      ownedHouseCount: 0,
      marriageStatus: 'married',
      marriageYears: 2,
      marriageDate: '2024-05-10',
      minorChildrenCount: 1,
      childrenBirthDates: ['2024-11-20'],
      hasNewborn: true,
      newbornBirthDate: '2024-11-20',
      isFirstLifeEver: false,
      taxPaid5Years: true,
      bankbookMonths: 36,
      depositAmount: 300,
      dependentCount: 2,
      supportsElderlyOver65: false,
      elderlySupportYears: 0,
      incomeTier: 'under_140',
      assetSatisfied: true,
    };

    const evaluation = evaluateSubscriptionEligibility(testProfile, rule);

    const passed =
      onboardResult.success &&
      isRegistered &&
      storedAnn !== undefined &&
      rule.projectName.includes('촉진3구역') &&
      evaluation.residenceAnalysis.meetsLocalRequirement === true &&
      evaluation.newborn.status === 'applicable' &&
      evaluation.newborn.eligible === true;

    addResult(
      'Test 7: Phase 5D Validator 검증 통과, Registry 등록 및 기존 청약엔진 연동 성공',
      passed,
      `온보딩 성공(${onboardResult.success}), Registry 등록(${isRegistered}), 청약엔진 신생아특공 적격(${evaluation.newborn.eligible})`
    );
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    results,
  };
}
