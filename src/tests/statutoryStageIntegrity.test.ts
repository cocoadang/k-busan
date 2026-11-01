/**
 * 사업현황 현재단계 <-> 진행이력 Evidence 정합성 및 SSOT 검증 테스트 스위트
 */

import {
  resolveProjectStatutoryStage,
  getNextRedevelopmentStage,
  getHistoricalEventsForProject,
} from '../utils/redevelopmentStages.ts';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry.ts';

export function runStatutoryStageIntegritySuite(): {
  passed: number;
  total: number;
  results: { name: string; passed: boolean; message?: string }[];
} {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  const assert = (name: string, condition: boolean, message?: string) => {
    results.push({
      name,
      passed: condition,
      message: condition ? undefined : message || 'Assertion failed',
    });
  };

  // 1. 촉진3: 2024-05-23 관리처분계획인가 및 2024-07-17 변경인가 정합성 검증
  const chokjinRes = resolveProjectStatutoryStage('chokjin-3');
  assert(
    '촉진3 현재단계: 관리처분계획인가 완료 (변경인가) 도출',
    chokjinRes.currentStage === '관리처분계획인가 완료 (변경인가)',
    `Expected '관리처분계획인가 완료 (변경인가)', got '${chokjinRes.currentStage}'`
  );
  assert(
    '촉진3 다음단계: 이주 도출 (이주 및 철거로 묶지 않음)',
    chokjinRes.nextStage === '이주',
    `Expected '이주', got '${chokjinRes.nextStage}'`
  );
  assert(
    '촉진3 마지막 verified 법정 Evidence: 2024-07-17 변경인가 고시',
    chokjinRes.lastVerifiedLegalEvent?.eventDate === '2024-07-17' &&
      chokjinRes.lastVerifiedLegalEvent?.noticeNumber === '부산진구 고시 제2024-115호',
    `Expected 2024-07-17 고시 제2024-115호, got ${chokjinRes.lastVerifiedLegalEvent?.eventDate} ${chokjinRes.lastVerifiedLegalEvent?.noticeNumber}`
  );
  assert(
    '촉진3 미인가 이주/철거/착공 자동 승격 차단',
    chokjinRes.hasRelocationEvidence === false &&
      chokjinRes.hasDemolitionEvidence === false &&
      chokjinRes.hasConstructionEvidence === false
  );

  // 2. 우동3: 2026-06-03 관리처분계획인가 Evidence 실제 project/source 재검증 후 반영
  const udongRes = resolveProjectStatutoryStage('udong-3');
  assert(
    '우동3 현재단계: 관리처분계획인가 완료 도출',
    udongRes.currentStage === '관리처분계획인가 완료',
    `Expected '관리처분계획인가 완료', got '${udongRes.currentStage}'`
  );
  assert(
    '우동3 다음단계: 이주 도출 (이주 및 철거로 묶지 않음)',
    udongRes.nextStage === '이주',
    `Expected '이주', got '${udongRes.nextStage}'`
  );
  assert(
    '우동3 마지막 verified 법정 Evidence: 2026-06-03 관리처분계획인가 고시',
    udongRes.lastVerifiedLegalEvent?.eventDate === '2026-06-03' &&
      udongRes.lastVerifiedLegalEvent?.noticeNumber === '해운대구 고시 제2026-68호',
    `Expected 2026-06-03 고시 제2026-68호, got ${udongRes.lastVerifiedLegalEvent?.eventDate} ${udongRes.lastVerifiedLegalEvent?.noticeNumber}`
  );
  assert(
    '우동3 미인가 이주/철거/착공 자동 승격 차단',
    udongRes.hasRelocationEvidence === false &&
      udongRes.hasDemolitionEvidence === false &&
      udongRes.hasConstructionEvidence === false
  );

  // 3. 삼익비치: 마지막 verified 법정단계까지만 표시 (사업시행계획(변경)인가 완료 유지 및 최근 정비계획 변경과 구분)
  const samikRes = resolveProjectStatutoryStage('samik-beach');
  assert(
    '삼익비치 현재단계: 사업시행계획(변경)인가 완료 도출',
    samikRes.currentStage === '사업시행계획(변경)인가 완료',
    `Expected '사업시행계획(변경)인가 완료', got '${samikRes.currentStage}'`
  );
  assert(
    '삼익비치 다음 표준 단계: 관리처분계획인가 도출 (공란 없음)',
    samikRes.nextStage === '관리처분계획인가',
    `Expected '관리처분계획인가', got '${samikRes.nextStage}'`
  );
  assert(
    '삼익비치 마지막 verified 법정인가 Evidence: 2023-11-29 사업시행계획(변경)인가 고시',
    samikRes.lastVerifiedLegalEvent?.eventDate === '2023-11-29' &&
      samikRes.lastVerifiedLegalEvent?.noticeNumber === '부산광역시 수영구 고시 제2023-142호',
    `Expected 2023-11-29 수영구 고시 제2023-142호, got ${samikRes.lastVerifiedLegalEvent?.eventDate} ${samikRes.lastVerifiedLegalEvent?.noticeNumber}`
  );
  assert(
    '삼익비치 후속 정비계획 변경 Evidence 분리 보존',
    samikRes.subsequentPlanChangeEvidence?.eventDate === '2024-03-27' &&
      samikRes.subsequentPlanChangeEvidence?.noticeNumber === '부산광역시 고시 제2024-95호',
    `Expected 2024-03-27 부산광역시 고시 제2024-95호, got ${samikRes.subsequentPlanChangeEvidence?.eventDate} ${samikRes.subsequentPlanChangeEvidence?.noticeNumber}`
  );
  assert(
    '삼익비치 정비계획 변경이 있어도 사업시행인가 이전단계로 후퇴 금지 및 관리처분 미승격',
    samikRes.currentStage.includes('사업시행') &&
      samikRes.currentStage.includes('관리처분') === false &&
      samikRes.hasRelocationEvidence === false
  );

  // 4. SSOT 일치성: REDEVELOPMENT_SEED_PROJECTS와 resolveProjectStatutoryStage의 동일성
  for (const project of REDEVELOPMENT_SEED_PROJECTS) {
    const resolved = resolveProjectStatutoryStage(project.id);
    assert(
      `SSOT 일치성: ${project.id} seed stage === resolved.currentStage`,
      project.stage === resolved.currentStage,
      `Mismatch for ${project.id}: seed '${project.stage}' vs resolved '${resolved.currentStage}'`
    );
    assert(
      `SSOT 일치성: ${project.id} seed nextStage === resolved.nextStage`,
      project.nextStage === resolved.nextStage &&
        typeof project.nextStage === 'string' &&
        project.nextStage.trim() !== '',
      `Mismatch for ${project.id}: seed '${project.nextStage}' vs resolved '${resolved.nextStage}'`
    );
  }

  // 5. Evidence 없이 이주/철거/착공 자동 승격 금지 규칙
  const chokjinBase = getHistoricalEventsForProject('chokjin-3');
  const mockUnverifiedEvents = [
    ...chokjinBase,
    {
      id: 'mock_unverified_relocation',
      projectId: 'chokjin-3',
      eventType: '이주',
      title: '미확인 이주 시작 루머',
      eventDate: '2026-08-01',
      verificationStatus: 'unresolved', // unverified
    },
    {
      id: 'mock_unverified_demolition',
      projectId: 'chokjin-3',
      eventType: '철거',
      title: '미확인 철거 루머',
      eventDate: '2026-08-10',
      verificationStatus: 'conflict', // unverified
    },
  ];
  const protectedRes = resolveProjectStatutoryStage('chokjin-3', mockUnverifiedEvents);
  assert(
    '비검증(unverified) 이주/철거 이벤트는 현재단계 승격 불가 (방어 확인)',
    protectedRes.currentStage === '관리처분계획인가 완료 (변경인가)' &&
      protectedRes.hasRelocationEvidence === false &&
      protectedRes.hasDemolitionEvidence === false
  );

  // 6. getNextRedevelopmentStage 역호환성 및 표준 다음단계 전이 규칙 검증
  assert(
    'getNextRedevelopmentStage: 관리처분 완료 -> 이주 (이주 및 철거 분리)',
    getNextRedevelopmentStage('관리처분계획인가 완료') === '이주'
  );
  assert(
    'getNextRedevelopmentStage: 관리처분 변경인가 -> 이주',
    getNextRedevelopmentStage('관리처분계획인가 완료 (변경인가)') === '이주'
  );
  assert(
    'getNextRedevelopmentStage: 이주 -> 철거',
    getNextRedevelopmentStage('이주 진행') === '철거'
  );
  assert(
    'getNextRedevelopmentStage: 사업시행계획(변경)인가 -> 관리처분계획인가',
    getNextRedevelopmentStage('사업시행계획(변경)인가 완료') === '관리처분계획인가'
  );

  const passed = results.filter((r) => r.passed).length;
  return {
    passed,
    total: results.length,
    results,
  };
}

// Previously executed only through the removed dry-run endpoint; run it under node --test.
import nodeTest from 'node:test';
import nodeAssert from 'node:assert/strict';

nodeTest('사업현황 현재단계 ↔ 진행이력 Evidence 정합성', () => {
  const report = runStatutoryStageIntegritySuite();
  const failed = report.results.filter((r) => !r.passed);
  nodeAssert.equal(failed.length, 0, JSON.stringify(failed, null, 2));
});
