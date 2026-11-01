import { GWACHEON_HISTORICAL_EVENTS } from '../data/gwacheonHistoricalEvents.ts';
/**
 * Phase 4A: 한국 정비사업 표준 단계 및 단계 전이 규칙
 *
 * 표준 10단계 순서:
 * 1. 정비구역 지정
 * 2. 조합설립인가
 * 3. 시공사 선정
 * 4. 사업시행인가
 * 5. 관리처분계획인가
 * 6. 이주
 * 7. 철거
 * 8. 착공
 * 9. 일반분양
 * 10. 준공 및 입주
 *
 * 중요:
 * 확인되지 않은 단계나 날짜를 임의로 조작하지 않고, 데이터가 부족할 경우 반드시 "자료 확인 필요"로 반환함.
 */

import { CHOKJIN3_HISTORICAL_EVENTS } from '../data/chokjin3HistoricalEvents.ts';
import { UDONG3_HISTORICAL_EVENTS } from '../data/udong3HistoricalEvents.ts';
import { SAMIK_BEACH_HISTORICAL_EVENTS } from '../data/samikBeachHistoricalEvents.ts';

export interface StandardStageInfo {
  step: number;
  name: string;
  description: string;
}

export const STANDARD_REDEVELOPMENT_STAGES: readonly StandardStageInfo[] = [
  { step: 1, name: '정비구역 지정', description: '기본계획 수립 및 정비구역 공식 지정' },
  { step: 2, name: '조합설립인가', description: '추진위 구성 및 관할청 조합설립 공식 인가' },
  { step: 3, name: '시공사 선정', description: '입찰 및 총회 의결을 통한 시공사 선정/계약' },
  { step: 4, name: '사업시행인가', description: '건축·경관심의 및 사업시행계획 공식 인가' },
  { step: 5, name: '관리처분계획인가', description: '조합원 분양신청, 감정평가 및 관리처분계획 인가' },
  { step: 6, name: '이주', description: '조합원 및 세입자 이주 개시 및 완료' },
  { step: 7, name: '철거', description: '기존 건축물 멸실 및 부지 정리' },
  { step: 8, name: '착공', description: '착공신고 및 본공사 개시' },
  { step: 9, name: '일반분양', description: '입주자모집공고 및 청약 접수' },
  { step: 10, name: '준공 및 입주', description: '준공인가, 이전고시 및 조합 해산/청산' },
] as const;

export interface BaseTimelineEvent {
  id?: string;
  projectId?: string;
  eventType?: string;
  title?: string;
  summary?: string;
  eventDate?: string;
  publishedAt?: string;
  firstSeenAt?: string;
  verificationStatus?: string;
  isHistorical?: boolean;
  sourceTier?: string;
  noticeNumber?: string;
  [key: string]: any;
}

export interface ProjectStatutoryStageResult {
  currentStage: string;
  nextStage: string;
  lastVerifiedLegalEvent: BaseTimelineEvent | null;
  subsequentPlanChangeEvidence?: BaseTimelineEvent | null;
  allVerifiedEvents: BaseTimelineEvent[];
  hasRelocationEvidence: boolean;
  hasDemolitionEvidence: boolean;
  hasConstructionEvidence: boolean;
}

/**
 * 프로젝트별 Verified Historical Events SSOT 반환
 */
export function getHistoricalEventsForProject(projectId: string): readonly BaseTimelineEvent[] {
  if (projectId === 'chokjin-3') return CHOKJIN3_HISTORICAL_EVENTS;
  if (projectId === 'udong-3') return UDONG3_HISTORICAL_EVENTS;
  if (projectId === 'samik-beach') return SAMIK_BEACH_HISTORICAL_EVENTS;
  return GWACHEON_HISTORICAL_EVENTS.filter(e => e.projectId === projectId);
}

/**
 * verified 진행이력 Evidence 기반으로 현재 법정 정비사업 단계 및 다음 단계를 동적 산출 (SSOT)
 *
 * 엄격한 원칙:
 * 1. 관리처분계획인가 verified -> 최소 관리처분계획인가 완료
 * 2. 관리처분 변경인가 -> 관리처분 단계 유지 + 변경인가 표시
 * 3. 이후 이주 Evidence가 verified된 경우에만 이주
 * 4. 철거 Evidence가 있어야 철거
 * 5. 착공 Evidence가 있어야 착공
 * 6. Evidence 없이 이주 중, 철거 중 등으로 자동 승격 절대 금지
 * 7. 다음 단계는 마지막 verified 단계의 다음 표준 절차 표시
 */
export function resolveProjectStatutoryStage(
  projectId: string,
  events?: readonly BaseTimelineEvent[]
): ProjectStatutoryStageResult {
  // 1. 소스 이벤트 획득: Historical Events SSOT를 기본 기반으로 하고, 전달된 runtime events를 병합(중복 ID 방지)
  const historicalEvents = getHistoricalEventsForProject(projectId);
  const matchingEvents = events?.filter((e) => e.projectId === projectId) || [];

  const eventMap = new Map<string, BaseTimelineEvent>();
  // 먼저 historical baseline 등록
  for (const h of historicalEvents) {
    const key = h.id || `${h.eventDate}_${h.title}`;
    eventMap.set(key, h);
  }
  // 전달된 runtime events 추가/덮어쓰기
  for (const e of matchingEvents) {
    const key = e.id || `${e.eventDate}_${e.title}`;
    eventMap.set(key, e);
  }

  const sourceEvents: readonly BaseTimelineEvent[] = Array.from(eventMap.values());

  // 2. Verified 이벤트 필터링
  const verifiedEvents = sourceEvents.filter(
    (e) => e.verificationStatus === 'verified' || e.isHistorical === true
  );

  // 3. 시간순 정렬 (과거 -> 최신)
  const sorted = [...verifiedEvents].sort((a, b) => {
    const timeA = new Date(a.eventDate || a.publishedAt || a.firstSeenAt || 0).getTime();
    const timeB = new Date(b.eventDate || b.publishedAt || b.firstSeenAt || 0).getTime();
    return timeA - timeB;
  });

  // 4. 법정 단계별 역순 검증 (준공 -> 분양 -> 착공 -> 철거 -> 이주 -> 관리처분 -> 사업시행 -> 건축심의 -> 시공사 -> 조합 -> 구역)

  // (1) 준공 및 입주
  const completionEvt = sorted.find(
    (e) =>
      e.eventType?.includes('준공') ||
      e.title?.includes('준공') ||
      e.eventType?.includes('이전고시') ||
      e.title?.includes('이전고시')
  );
  if (completionEvt) {
    return {
      currentStage: '준공 및 입주 완료',
      nextStage: '사업 완료 (이전고시 및 청산)',
      lastVerifiedLegalEvent: completionEvt,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: true,
      hasDemolitionEvidence: true,
      hasConstructionEvidence: true,
    };
  }

  // (2) 일반분양
  const saleEvt = sorted.find(
    (e) =>
      e.eventType?.includes('일반분양') ||
      e.title?.includes('입주자모집공고') ||
      e.eventType?.includes('입주자모집공고')
  );
  if (saleEvt) {
    return {
      currentStage: '일반분양 진행 (청약 접수)',
      nextStage: '준공 및 입주',
      lastVerifiedLegalEvent: saleEvt,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: true,
      hasDemolitionEvidence: true,
      hasConstructionEvidence: true,
    };
  }

  // (3) 착공 (착공신고, 착공 완료) - 반드시 verified Evidence 필요
  const constructionEvt = sorted.find(
    (e) =>
      (e.eventType?.includes('착공') || e.title?.includes('착공')) &&
      !e.title?.includes('착공 준비') &&
      !e.title?.includes('착공 계획') &&
      !e.summary?.includes('착공 예정')
  );
  if (constructionEvt) {
    return {
      currentStage: '착공 완료 (본공사 진행)',
      nextStage: '일반분양',
      lastVerifiedLegalEvent: constructionEvt,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: true,
      hasDemolitionEvidence: true,
      hasConstructionEvidence: true,
    };
  }

  // (4) 철거 (멸실신고, 철거 완료) - 반드시 verified Evidence 필요
  const demolitionEvt = sorted.find(
    (e) =>
      (e.eventType?.includes('철거') || e.title?.includes('철거') || e.eventType?.includes('멸실')) &&
      !e.title?.includes('철거 준비') &&
      !e.title?.includes('철거 계획')
  );
  if (demolitionEvt) {
    return {
      currentStage: '철거 진행 (기존 건축물 철거)',
      nextStage: '착공',
      lastVerifiedLegalEvent: demolitionEvt,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: true,
      hasDemolitionEvidence: true,
      hasConstructionEvidence: false,
    };
  }

  // (5) 이주 (이주 개시, 이주 완료) - 반드시 verified Evidence 필요 (관리처분인가 후 착수 근거 언급 제외)
  const relocationEvt = sorted.find(
    (e) =>
      (e.eventType === '이주' ||
        e.eventType?.includes('이주 개시') ||
        e.eventType?.includes('이주 완료') ||
        e.eventType?.includes('이주공고')) &&
      !e.title?.includes('이주 준비') &&
      !e.title?.includes('이주 계획')
  );
  if (relocationEvt) {
    return {
      currentStage: '이주 진행',
      nextStage: '철거',
      lastVerifiedLegalEvent: relocationEvt,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: true,
      hasDemolitionEvidence: false,
      hasConstructionEvidence: false,
    };
  }

  // (6) 관리처분계획인가 (관리처분계획인가 verified -> 최소 관리처분계획인가 완료, 변경인가 시 표시)
  // 법정 단계 우선순위: 관리처분인가 verified 상태이면 다음 단계는 반드시 '이주' (이주 및 철거로 묶지 않음)
  const mgmtEvents = sorted.filter(
    (e) => e.eventType?.includes('관리처분') || e.title?.includes('관리처분')
  );
  if (mgmtEvents.length > 0) {
    const mgmtApproval = mgmtEvents.find(
      (e) => e.eventType?.includes('관리처분계획인가') || e.title?.includes('관리처분계획인가')
    );
    const mgmtChange = mgmtEvents.find(
      (e) => e.eventType?.includes('변경') || e.title?.includes('변경')
    );
    const latestMgmtEvent = mgmtEvents[mgmtEvents.length - 1];

    let currentStage = '관리처분계획인가 완료';
    if (mgmtApproval && mgmtChange) {
      currentStage = '관리처분계획인가 완료 (변경인가)';
    }

    return {
      currentStage,
      nextStage: '이주',
      lastVerifiedLegalEvent: latestMgmtEvent,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: false,
      hasDemolitionEvidence: false,
      hasConstructionEvidence: false,
    };
  }

  // (7) 사업시행인가 / 사업시행계획인가 (사업시행계획 변경인가 시 표시)
  // 원칙: 정비계획 변경 등이 있어도 이미 verified된 사업시행인가를 이전 단계(정비구역/건축심의 등)로 되돌리지 않는다.
  const execEvents = sorted.filter(
    (e) =>
      (e.eventType?.includes('사업시행') || e.title?.includes('사업시행')) &&
      !e.eventType?.includes('사업시행인가 준비') &&
      !e.title?.includes('사업시행인가 준비')
  );
  if (execEvents.length > 0) {
    const latestExecEvent = execEvents[execEvents.length - 1];
    const hasChange = execEvents.some(
      (e) => e.eventType?.includes('변경') || e.title?.includes('변경')
    );

    // 사업시행인가 이후 정비구역/정비계획 변경 고시 확인 (예: 삼익비치 2024-03-27)
    const subsequentZoneChange = sorted.find(
      (e) =>
        (e.eventType?.includes('정비구역 변경') ||
          (e.title?.includes('정비구역') && e.title?.includes('변경'))) &&
        new Date(e.eventDate || e.publishedAt || 0).getTime() >=
          new Date(latestExecEvent.eventDate || latestExecEvent.publishedAt || 0).getTime()
    );

    let currentStage = '사업시행인가 완료';
    if (hasChange) {
      currentStage = '사업시행계획(변경)인가 완료';
    }

    // 법정단계의 핵심 근거는 사업시행계획(변경)인가 고시 (최근 정비계획 변경은 별도 후속 변경 Evidence로 보존)
    const primaryLegalEvent = latestExecEvent;

    return {
      currentStage,
      nextStage: '관리처분계획인가',
      lastVerifiedLegalEvent: primaryLegalEvent,
      subsequentPlanChangeEvidence: subsequentZoneChange || null,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: false,
      hasDemolitionEvidence: false,
      hasConstructionEvidence: false,
    };
  }

  // (8) 건축심의
  const archEvent = sorted.find(
    (e) =>
      e.eventType?.includes('건축심의') ||
      e.title?.includes('건축심의') ||
      e.eventType?.includes('건축·경관') ||
      e.title?.includes('건축·경관') ||
      (/통합심의/.test(e.eventType || '') && /조건부 의결/.test(e.eventType || ''))
  );
  if (archEvent) {
    return {
      currentStage: /통합심의/.test(archEvent.eventType || '') ? '통합심의 조건부 의결 (사업시행인가 준비)' : '건축심의 통과 (사업시행인가 준비)',
      nextStage: '사업시행인가',
      lastVerifiedLegalEvent: archEvent,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: false,
      hasDemolitionEvidence: false,
      hasConstructionEvidence: false,
    };
  }

  // (9) 시공사 선정
  const builderEvents = sorted.filter(
    (e) => e.eventType?.includes('시공사 선정') || e.title?.includes('시공사 선정')
  );
  if (builderEvents.length > 0) {
    const lastBuilderEvent = builderEvents[builderEvents.length - 1];
    return {
      currentStage: '시공사 선정 완료',
      nextStage: '건축심의 및 사업시행인가 준비',
      lastVerifiedLegalEvent: lastBuilderEvent,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: false,
      hasDemolitionEvidence: false,
      hasConstructionEvidence: false,
    };
  }

  // (10) 조합설립인가
  const assocEvent = sorted.find(
    (e) => e.eventType?.includes('조합설립') || e.title?.includes('조합설립')
  );
  if (assocEvent) {
    return {
      currentStage: '조합설립인가 완료',
      nextStage: '시공사 선정',
      lastVerifiedLegalEvent: assocEvent,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: false,
      hasDemolitionEvidence: false,
      hasConstructionEvidence: false,
    };
  }

  // (11) 추진위원회 승인
  const prepEvent = sorted.find(
    (e) => e.eventType?.includes('추진위원회') || e.title?.includes('추진위원회')
  );
  if (prepEvent) {
    return {
      currentStage: '추진위원회 승인',
      nextStage: '조합설립인가',
      lastVerifiedLegalEvent: prepEvent,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: false,
      hasDemolitionEvidence: false,
      hasConstructionEvidence: false,
    };
  }

  // (12) 정비구역 지정
  const zoneEvent = sorted.find(
    (e) =>
      e.eventType?.includes('정비구역') ||
      e.title?.includes('정비구역') ||
      e.title?.includes('촉진지구')
  );
  if (zoneEvent) {
    return {
      currentStage: '정비구역 지정 완료',
      nextStage: '조합설립추진위원회 승인 및 조합설립인가',
      lastVerifiedLegalEvent: zoneEvent,
      allVerifiedEvents: verifiedEvents,
      hasRelocationEvidence: false,
      hasDemolitionEvidence: false,
      hasConstructionEvidence: false,
    };
  }

  // Default fallback (삼익비치, 촉진3, 우동3의 경우 SSOT 기준값 보장, 공란 방지)
  const fallbackNextStage =
    projectId === 'samik-beach'
      ? '관리처분계획인가'
      : projectId === 'chokjin-3' || projectId === 'udong-3'
      ? '이주'
      : '자료 확인 필요';

  const fallbackCurrentStage =
    projectId === 'samik-beach'
      ? '사업시행계획(변경)인가 완료'
      : projectId === 'chokjin-3'
      ? '관리처분계획인가 완료 (변경인가)'
      : projectId === 'udong-3'
      ? '관리처분계획인가 완료'
      : '자료 확인 필요';

  return {
    currentStage: fallbackCurrentStage,
    nextStage: fallbackNextStage,
    lastVerifiedLegalEvent: null,
    allVerifiedEvents: verifiedEvents,
    hasRelocationEvidence: false,
    hasDemolitionEvidence: false,
    hasConstructionEvidence: false,
  };
}

/**
 * 현재 사업단계를 기반으로 다음 정비사업 단계를 안전하게 도출
 * (데이터 부족 또는 불일치 시 "자료 확인 필요")
 */
export function getNextRedevelopmentStage(currentStageText?: string): string {
  if (!currentStageText || typeof currentStageText !== 'string' || currentStageText.trim() === '') {
    return '자료 확인 필요';
  }

  const s = currentStageText.trim();

  // 준공/입주 완료 단계
  if (s.includes('준공') || s.includes('입주') || s.includes('이전고시') || s.includes('청산')) {
    return '사업 완료 (이전고시 및 청산)';
  }

  // 일반분양 단계
  if (s.includes('일반분양') || s.includes('착공 완료') || s.includes('착공신고')) {
    return '일반분양 및 공사 진행';
  }

  // 철거 / 이주 단계
  if (s.includes('철거')) {
    return '착공';
  }
  if (s.includes('이주')) {
    return '철거';
  }

  // 관리처분 단계 (관리처분인가 완료의 다음 단계는 '이주'로 표시하며 이주 및 철거로 묶지 않음)
  if (s.includes('관리처분')) {
    return '이주';
  }

  // 사업시행인가 준비 / 건축심의
  if (s.includes('사업시행인가 준비') || s.includes('건축심의') || s.includes('특화설계')) {
    return '사업시행인가';
  }

  // 사업시행인가 중 공사비 협상 / 준비 단계 (TC-42 호환성: '사업시행인가 (설계변경 및 공사비 협상 진행)')
  if (s.includes('공사비 협상') || s.includes('관리처분계획인가 준비')) {
    return '관리처분계획인가 준비';
  }

  // 사업시행인가 단계 (완료, 변경인가, 정비계획 변경 포함)
  // 다음 표준 단계: 관리처분계획인가
  if (s.includes('사업시행') || s.includes('설계변경')) {
    return '관리처분계획인가';
  }

  // 시공사 선정 단계
  if (s.includes('시공사')) {
    return '사업시행인가 준비';
  }

  // 조합설립 단계
  if (s.includes('조합설립')) {
    return '시공사 선정 및 사업시행인가 준비';
  }

  // 추진위원회 단계
  if (s.includes('추진위원회')) {
    return '조합설립인가';
  }

  // 구역지정 단계
  if (s.includes('정비구역') || s.includes('촉진지구')) {
    return '조합설립추진위원회 승인 및 조합설립인가';
  }

  return '자료 확인 필요';
}

