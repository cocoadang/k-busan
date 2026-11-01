/**
 * Phase 5B: 다중 청약 프로필 병렬 비교 테스트 스위트
 * 
 * 검증 항목:
 * 1. 프로필 추가 / 수정 / 삭제 및 별칭('프로필 A/B/C...') 고정 규칙
 * 2. 프로필별 조건 저장 무결성 (전입일, 혼인, 자녀/신생아, 무주택, 생초, 부양, 노부모, 통장)
 * 3. 선택한 모집공고 기준 병렬 자격 판정 (신혼/생초/신생아/다자녀/노부모/일반공급)
 * 4. 일반공급 가점 총점 및 분해(무주택, 부양가족, 청약통장)
 * 5. 부산 전입일 기준 공고일 계속 거주기간 자동 계산
 * 6. 미래 촉진3/우동3 등 미등록 공고의 '공고 확인 필요' 분기 처리
 * 7. 베뉴브 84B canonical 경쟁률 32.90:1 일치 검증
 */

import { ANNOUNCEMENT_RULES, VENUEVE_HAEUNDAE_BENCHMARK } from '../data/subscriptionBenchmarkData.ts';
import {
  DEFAULT_MULTI_PROFILES,
  createNewSubscriptionProfile,
  evaluateMultiProfiles,
  getNextProfileAlias,
  isDraftAnnouncementRule,
} from '../utils/multiProfileHelper.ts';

export interface TestResultItem {
  name: string;
  passed: boolean;
  message: string;
}

export function runMultiProfileTestSuite(): {
  total: number;
  passed: number;
  results: TestResultItem[];
} {
  const results: TestResultItem[] = [];

  const addResult = (name: string, passed: boolean, message: string) => {
    results.push({ name, passed, message });
  };

  // 1. 베뉴브 84B canonical 경쟁률 32.90:1 검증
  {
    const v84b = VENUEVE_HAEUNDAE_BENCHMARK.types.find((t) => t.typeCode === '84B')!;
    const passed =
      v84b.generalSupply.quota === 41 &&
      v84b.generalSupply.compRatio === 32.90;

    addResult(
      'Phase 5B Test 1: 베뉴브 84B canonical 경쟁률 32.90:1 일치 검증',
      passed,
      `84B: 일반공급 ${v84b.generalSupply.quota}세대, 경쟁률 ${v84b.generalSupply.compRatio}:1 (원자료 1,349건 / 41 = 32.90:1)`
    );
  }

  // 2. 프로필 추가 / 삭제 / 별칭 고정 규칙 검증
  {
    const initialAliases = DEFAULT_MULTI_PROFILES.map((p) => p.alias);
    const nextAlias1 = getNextProfileAlias(initialAliases); // should be '프로필 D'
    const newProfile = createNewSubscriptionProfile(nextAlias1);

    const testProfiles = [...DEFAULT_MULTI_PROFILES, newProfile];
    const nextAlias2 = getNextProfileAlias(testProfiles.map((p) => p.alias)); // should be '프로필 E'

    // 삭제 후 다시 중간 문자 재할당 확인
    const deletedList = testProfiles.filter((p) => p.alias !== '프로필 B');
    const recycledAlias = getNextProfileAlias(deletedList.map((p) => p.alias)); // should reuse '프로필 B'

    const passed =
      initialAliases.join(',') === '프로필 A,프로필 B,프로필 C' &&
      nextAlias1 === '프로필 D' &&
      nextAlias2 === '프로필 E' &&
      recycledAlias === '프로필 B' &&
      newProfile.alias.startsWith('프로필 ');

    addResult(
      'Phase 5B Test 2: 프로필 추가/삭제 및 별칭(프로필 A/B/C/D...) 순차 부여 검증',
      passed,
      `초기: [${initialAliases.join(', ')}] -> 추가: ${nextAlias1} -> 추가: ${nextAlias2} -> B삭제후: ${recycledAlias}`
    );
  }

  // 3. 프로필별 조건 저장 무결성 검증
  {
    const pA = DEFAULT_MULTI_PROFILES.find((p) => p.alias === '프로필 A')!;
    const pB = DEFAULT_MULTI_PROFILES.find((p) => p.alias === '프로필 B')!;
    const pC = DEFAULT_MULTI_PROFILES.find((p) => p.alias === '프로필 C')!;

    const passedA =
      pA.profile.busanTransferDate === '2023-01-10' &&
      pA.profile.marriageYears === 3 &&
      pA.profile.minorChildrenCount === 1 &&
      pA.profile.isHomeless === true &&
      pA.profile.homelessYears === 3 &&
      pA.profile.bankbookMonths === 48;

    const passedB =
      pB.profile.busanTransferDate === '2020-03-01' &&
      pB.profile.marriageYears === 6 &&
      pB.profile.minorChildrenCount === 3 &&
      pB.profile.hasNewborn === true &&
      pB.profile.homelessYears === 7 &&
      pB.profile.bankbookMonths === 84;

    const passedC =
      pC.profile.busanTransferDate === '2015-05-20' &&
      pC.profile.supportsElderlyOver65 === true &&
      pC.profile.elderlySupportYears === 4 &&
      pC.profile.homelessYears === 12 &&
      pC.profile.dependentCount === 4 &&
      pC.profile.bankbookMonths === 144;

    const passed = passedA && passedB && passedC;
    addResult(
      'Phase 5B Test 3: 프로필별 조건 저장 무결성 (전입일, 혼인, 자녀/신생아, 무주택, 부양가족, 통장)',
      passed,
      `A(혼인3년, 자녀1, 무주택3년), B(자녀3, 신생아, 무주택7년), C(노부모4년, 무주택12년, 통장144개월)`
    );
  }

  // 4. 선택한 모집공고(써밋 남천 2025) 기준 병렬 자격 판정 & 부산 거주기간 자동 계산
  {
    const summitRule = ANNOUNCEMENT_RULES['rule-summit-namcheon-2025']; // 2025-07-31 공고
    const evaluated = evaluateMultiProfiles(DEFAULT_MULTI_PROFILES, summitRule);

    const rA = evaluated.find((e) => e.alias === '프로필 A')!;
    const rB = evaluated.find((e) => e.alias === '프로필 B')!;
    const rC = evaluated.find((e) => e.alias === '프로필 C')!;

    // 거주기간 계산:
    // A: 2023-01-10 -> 2025-07-31 = 2년 6개월 (30개월) >= 12개월 충족
    // B: 2020-03-01 -> 2025-07-31 = 5년 4개월 (64개월) >= 12개월 충족
    // C: 2015-05-20 -> 2025-07-31 = 10년 2개월 (122개월) >= 12개월 충족
    const residencePassed =
      rA.residenceMonths === 30 &&
      rA.meetsLocalRequirement === true &&
      rB.residenceMonths === 64 &&
      rB.meetsLocalRequirement === true &&
      rC.residenceMonths === 122 &&
      rC.meetsLocalRequirement === true;

    // 특공 자격 판정:
    // A: 신혼부부 가능, 다자녀 불가(자녀1명), 노부모 불가
    // B: 다자녀 가능(자녀3명), 신혼부부 가능(혼인6년), 신생아는 2025 공고이므로 not_applicable
    // C: 노부모부양 가능(부양4년, 세대주), 신혼 불가(혼인15년)
    const specialPassed =
      rA.analysis.newlywed.eligible === true &&
      rA.analysis.multiChild.eligible === false &&
      rB.analysis.multiChild.eligible === true &&
      rB.analysis.newlywed.eligible === true &&
      rB.analysis.newborn.status === 'not_applicable' &&
      rC.analysis.elderlyParent.eligible === true &&
      rC.analysis.newlywed.eligible === false;

    const passed = residencePassed && specialPassed;
    addResult(
      'Phase 5B Test 4: 선택 공고 기준 거주기간 자동 계산 및 5대 특공 병렬 판정 검증',
      passed,
      `A 거주:${rA.residenceText}(신혼특공 가능), B 거주:${rB.residenceText}(다자녀 가능), C 거주:${rC.residenceText}(노부모특공 가능)`
    );
  }

  // 5. 일반공급 가점 총점 및 분해 검증 (84점 만점 체계)
  {
    const summitRule = ANNOUNCEMENT_RULES['rule-summit-namcheon-2025'];
    const evaluated = evaluateMultiProfiles(DEFAULT_MULTI_PROFILES, summitRule);

    const rA = evaluated.find((e) => e.alias === '프로필 A')!;
    const rB = evaluated.find((e) => e.alias === '프로필 B')!;
    const rC = evaluated.find((e) => e.alias === '프로필 C')!;

    // A: 무주택3년(8점) + 부양2명(15점) + 통장48개월(6점: 4+2) = 29점
    // B: 무주택7년(16점) + 부양4명(25점) + 통장84개월(9점: 7+2) = 50점
    // C: 무주택12년(26점) + 부양4명(25점) + 통장144개월(14점: 12+2) = 65점
    const passedA =
      rA.scoreBreakdown.homelessScore === 8 &&
      rA.scoreBreakdown.dependentScore === 15 &&
      rA.scoreBreakdown.bankbookScore === 6 &&
      rA.scoreBreakdown.totalScore === 29;

    const passedB =
      rB.scoreBreakdown.homelessScore === 16 &&
      rB.scoreBreakdown.dependentScore === 25 &&
      rB.scoreBreakdown.bankbookScore === 9 &&
      rB.scoreBreakdown.totalScore === 50;

    const passedC =
      rC.scoreBreakdown.homelessScore === 26 &&
      rC.scoreBreakdown.dependentScore === 25 &&
      rC.scoreBreakdown.bankbookScore === 14 &&
      rC.scoreBreakdown.totalScore === 65;

    const passed = passedA && passedB && passedC;
    addResult(
      'Phase 5B Test 5: 일반공급 가점 총점 및 3대 항목(무주택/부양/통장) 분해 정밀도',
      passed,
      `A: ${rA.scoreBreakdown.totalScore}점(8+15+6), B: ${rB.scoreBreakdown.totalScore}점(16+25+9), C: ${rC.scoreBreakdown.totalScore}점(26+25+14)`
    );
  }

  // 6. 미래 촉진3/우동3 등 미등록 공고의 '공고 확인 필요' 분기 처리 검증
  {
    const chokjinDraftRule = ANNOUNCEMENT_RULES['rule-chokjin-3-draft'];
    const udongDraftRule = ANNOUNCEMENT_RULES['rule-udong-3-draft'];
    const summitRule = ANNOUNCEMENT_RULES['rule-summit-namcheon-2025'];

    const isChokjinDraft = isDraftAnnouncementRule(chokjinDraftRule);
    const isUdongDraft = isDraftAnnouncementRule(udongDraftRule);
    const isSummitDraft = isDraftAnnouncementRule(summitRule);

    const evaluatedChokjin = evaluateMultiProfiles(DEFAULT_MULTI_PROFILES, chokjinDraftRule);
    const allItemsHaveDraftFlag = evaluatedChokjin.every((item) => item.isDraftNotice === true);

    const passed =
      isChokjinDraft === true &&
      isUdongDraft === true &&
      isSummitDraft === false &&
      allItemsHaveDraftFlag === true;

    addResult(
      'Phase 5B Test 6: 미래 사업지(촉진3/우동3) 공고 등록 전 미확정 및 공고확인필요 플래그',
      passed,
      `촉진3 draft: ${isChokjinDraft}, 우동3 draft: ${isUdongDraft}, 써밋 확정: ${!isSummitDraft} -> 공고 확인 필요 안내 연동`
    );
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    results,
  };
}
