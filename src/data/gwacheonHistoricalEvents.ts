import type { FirestoreEventDoc } from '../schema/firestoreSchema.ts';

// Official administrative chronology checked 2026-10-14. Planned works are excluded.
export const GWACHEON_HISTORY_SOURCE = 'https://new.gccity.go.kr/dept/contents.do?mId=0303010000';
const checkedAt = '2026-10-14T00:00:00Z';
const milestones: Record<string, [string, string, string?][]> = {
  'gwacheon-5': [
    ['2010-04-30', '도시·주거환경정비기본계획 결정 고시'],
    ['2014-12-29', '정밀안전진단 통과 (조건부 D등급)'],
    ['2017-05-15', '정비구역 지정 및 지형도면 고시', '과천시 고시 제2017-44호'],
    ['2017-06-23', '조합설립추진위원회 구성 승인'],
    ['2020-01-23', '조합설립인가'],
    ['2024-05-21', '사업시행계획인가'],
    ['2025-03-21', '관리처분계획인가'],
  ],
  'gwacheon-89': [
    ['2010-04-30', '도시·주거환경정비기본계획 결정 고시'],
    ['2010-05-06', '9단지 정밀안전진단 통과 (조건부 D등급)'],
    ['2014-12-29', '8단지 정밀안전진단 통과 (조건부 D등급)'],
    ['2019-02-28', '정비구역 지정 및 지형도면 고시', '과천시 고시 제2019-8호'],
    ['2020-05-20', '조합설립추진위원회 구성 승인'],
    ['2021-02-23', '조합설립인가'],
    ['2024-03-21', '사업시행계획인가'],
    ['2025-01-08', '관리처분계획인가'],
  ],
  'gwacheon-10': [
    ['2010-04-30', '도시·주거환경정비기본계획 결정 고시'],
    ['2014-12-29', '정밀안전진단 통과 (조건부 D등급)'],
    ['2016-11-21', '정비구역 지정 및 지형도면 고시', '과천시 고시 제2016-105호'],
    ['2017-03-30', '조합설립추진위원회 구성 승인'],
    ['2021-08-10', '조합설립인가'],
    ['2026-02-11', '정비사업 통합심의위원회 심의 (조건부 의결)'],
  ],
};
const names: Record<string, string> = { 'gwacheon-5': '과천5단지', 'gwacheon-89': '과천8·9단지', 'gwacheon-10': '과천10단지' };
export const GWACHEON_HISTORICAL_EVENTS: FirestoreEventDoc[] = Object.entries(milestones).flatMap(([projectId, rows]) => rows.map(([eventDate, eventType, noticeNumber]) => {
  const id = `evt_hist_${projectId.replaceAll('-', '_')}_${eventDate.replaceAll('-', '')}`;
  const title = `${names[projectId]} ${eventType}`;
  // Page publication date is unknown; do not substitute the administrative event date.
  const source = { title: '과천시 단지별 추진현황', url: GWACHEON_HISTORY_SOURCE, source: '과천시', sourceTier: 'official' as const, publishedAt: '' };
  return {
    id, projectId, category: '사업단계', eventType, title,
    summary: `과천시 공식 단지별 추진현황에서 ${eventDate} ${eventType} 이력을 확인했습니다.${noticeNumber ? ` (${noticeNumber})` : ''}`,
    importance: 4, confidence: 1, eventDate,
    isHistorical: true, telegramEligibleByRecency: false, alreadyDispatched: true,
    sourceTier: 'official', verificationStatus: 'verified', ...(noticeNumber ? { noticeNumber } : {}),
    documentUrlVerified: false, documentIdentifierVerified: !!noticeNumber, actorType: 'official',
    provenance: { originalSourceId: id, sourceCollection: 'historical_admin', collector: 'GwacheonOfficialHistoryBackfill', collectedAt: checkedAt, department: '과천시', sourceType: 'official-admin', documentUrlVerified: false, documentIdentifierVerified: !!noticeNumber, actorType: 'official', notes: '과천시 공식 추진현황의 행정 이력 확인. 개별 고시 원문 및 페이지 게시일은 별도 검증하지 않음. 예정 일정 제외.' },
    primarySource: source, sources: [{ ...source, sourceType: 'official-web', discoveredAt: checkedAt }],
    firstSeenAt: checkedAt, lastSeenAt: checkedAt,
  };
}));

// Runtime records retain their latest metadata; baseline history never disappears under query limits.
export function mergeGwacheonHistory(events: FirestoreEventDoc[]): FirestoreEventDoc[] {
  const merged = new Map(GWACHEON_HISTORICAL_EVENTS.map(event => [event.id, event]));
  for (const event of events) merged.set(event.id, event);
  return [...merged.values()];
}
