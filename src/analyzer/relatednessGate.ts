import { RawCollectedItem, RedevelopmentProject, RelatednessStatus } from '../types/redevelopment';

/**
 * Redevelopment Domain Context Keywords
 */
export const REDEVELOPMENT_CONTEXT_KEYWORDS = [
  '재개발',
  '재건축',
  '정비사업',
  '정비촉진',
  '조합',
  '조합장',
  '시공사',
  '시공사 선정',
  '입찰',
  '총회',
  '대의원회',
  '사업시행인가',
  '관리처분계획',
  '관리처분인가',
  '정비계획',
  '도시계획위원회',
  '건축심의',
  '경관심의',
  '환경영향평가',
  '공사비',
  '공사비 증액',
  '분담금',
  '추정분담금',
  '이주',
  '철거',
  '착공',
  '일반분양',
  '하이엔드',
  '아크로',
  '디에이치',
] as const;

/**
 * General Market or Non-target noise words that often trigger false positives
 */
export const GENERAL_MARKET_NOISE = [
  '아파트 전세',
  '빌라 전세',
  '오피스텔 매매',
  '단독주택 매매',
  '부동산 중개',
  '원룸 임대',
  '상가 분양',
] as const;

export interface DeterministicGateResult {
  status: RelatednessStatus;
  hasAliasMatch: boolean;
  hasLocationMatch: boolean;
  hasRedevelopmentContext: boolean;
  isGeneralMarketNoise: boolean;
  matchedAliases: string[];
  matchedContextKeywords: string[];
  reason: string;
}

/**
 * 1st Pass Deterministic Relatedness Gate
 * Verifies that the article contains:
 * 1. Specific project alias / name
 * 2. Location / District keyword OR Specific Project Brand
 * 3. Actual redevelopment domain context (not just general real estate price trends)
 */
export function evaluateDeterministicGate(
  item: RawCollectedItem,
  project: RedevelopmentProject
): DeterministicGateResult {
  const combinedText = `${item.title} ${item.content}`.toLowerCase();

  // 1. Alias matching
  const matchedAliases = project.aliases.filter((alias) =>
    combinedText.includes(alias.toLowerCase())
  );
  const hasAliasMatch = matchedAliases.length > 0;

  // 2. Location matching
  const hasLocationMatch =
    project.locationKeywords.some((loc) => combinedText.includes(loc.toLowerCase())) ||
    combinedText.includes(project.district.toLowerCase()) ||
    combinedText.includes(project.city.toLowerCase());

  // 3. Redevelopment domain context matching
  const matchedContextKeywords = REDEVELOPMENT_CONTEXT_KEYWORDS.filter((kw) =>
    combinedText.includes(kw.toLowerCase())
  );
  const hasRedevelopmentContext = matchedContextKeywords.length > 0;

  // 4. Check for pure noise
  const isGeneralMarketNoise = GENERAL_MARKET_NOISE.some((noise) =>
    combinedText.includes(noise.toLowerCase())
  );

  // Official source tier check: official notices already filtered by government portal
  if (item.sourceTier === 'official' && hasAliasMatch) {
    return {
      status: 'relevant',
      hasAliasMatch: true,
      hasLocationMatch: true,
      hasRedevelopmentContext: true,
      isGeneralMarketNoise: false,
      matchedAliases,
      matchedContextKeywords: ['공식행정고시'],
      reason: '공식 행정 고시·공고 자료이며 구역 별칭이 정확히 일치함',
    };
  }

  // If no project alias matched at all -> IRRELEVANT
  if (!hasAliasMatch) {
    return {
      status: 'irrelevant',
      hasAliasMatch: false,
      hasLocationMatch,
      hasRedevelopmentContext,
      isGeneralMarketNoise,
      matchedAliases: [],
      matchedContextKeywords,
      reason: `대상 정비사업 별칭(${project.aliases.join(', ')})이 기사에 포함되지 않음`,
    };
  }

  // If alias matched, but zero redevelopment context exists (e.g. general market trend or weather)
  if (!hasRedevelopmentContext) {
    return {
      status: 'irrelevant',
      hasAliasMatch: true,
      hasLocationMatch,
      hasRedevelopmentContext: false,
      isGeneralMarketNoise,
      matchedAliases,
      matchedContextKeywords: [],
      reason: '구역명이 언급되었으나 정비사업(인허가/공사비/총회/시공사 등) 실질 문맥이 전무함',
    };
  }

  // If alias matched and context exists, but lacks location verification and has heavy market noise
  if (!hasLocationMatch && isGeneralMarketNoise) {
    return {
      status: 'uncertain',
      hasAliasMatch: true,
      hasLocationMatch: false,
      hasRedevelopmentContext: true,
      isGeneralMarketNoise: true,
      matchedAliases,
      matchedContextKeywords,
      reason: '구역명과 정비사업 단어가 포함되었으나 일반 부동산 시황 노이즈가 혼재되어 추가 검증 필요',
    };
  }

  // Passed 1st pass deterministic checks
  return {
    status: 'relevant',
    hasAliasMatch: true,
    hasLocationMatch,
    hasRedevelopmentContext: true,
    isGeneralMarketNoise: false,
    matchedAliases,
    matchedContextKeywords,
    reason: `구역명(${matchedAliases.join(', ')}) 및 정비사업 실질 문맥(${matchedContextKeywords.slice(0, 3).join(', ')}) 확인됨`,
  };
}

/** Exact article title/day: publisher and portal labels are presentation metadata. */
export function normalizedNewsTitle(item: { title?: string; sourceName?: string }): string {
  const title = (item.title || '').replace(/&nbsp;|\u00a0/gi, ' ').trim();
  const suffix = title.match(/\s+[-–—|]\s+([^\n]+)$/);
  const publisher = (item.sourceName || '').trim().toLowerCase();
  const body = suffix && (suffix[1].trim().toLowerCase() === publisher || /^(부산일보|busan\.com|헤럴드경제|daum|v\.daum\.net|하우징헤럴드|한국주택경제신문)$/i.test(suffix[1].trim()))
    ? title.slice(0, suffix.index) : title;
  return body.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}
export function newsArticleDay(publishedAt?: string): string {
  const timestamp = Date.parse(publishedAt || '');
  return Number.isFinite(timestamp) ? new Date(timestamp + 9 * 3600000).toISOString().slice(0, 10) : publishedAt || '';
}
export function newsArticleKey(item: { title?: string; sourceName?: string; publishedAt?: string }): string {
  return JSON.stringify([normalizedNewsTitle(item), newsArticleDay(item.publishedAt)]);
}

/** Conservative related-report grouping. This does not assert that a contractor was appointed. */
export function relatedReportKey(doc: any, projectIds: string[]): string | undefined {
  const title = normalizedNewsTitle(doc);
  if (!newsArticleDay(doc.publishedAt)) return undefined;
  if (projectIds.includes('gwacheon-10') && /과천역|지하철/.test(title) && /연결통로/.test(title) && /타당성/.test(title) && /업체|용역/.test(title)
    && !/낙찰|선정완료|계약체결|개통|착공|취소|재공고|유찰|선정했다|선정됐다/.test(title)) {
    return JSON.stringify(['gwacheon-10', newsArticleDay(doc.publishedAt), 'station-passage-feasibility-procurement']);
  }
  return undefined;
}

/** Curate the display without deleting the stored collection/audit history. */
export function curateNewsDocuments(documents: any[], projects: readonly RedevelopmentProject[]): any[] {
  const groups = new Map<string, any>();
  const relatedGroups = new Map<string, any>();
  for (const doc of [...documents].sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))) {
    if (doc.relatedness === 'irrelevant' || doc.relatedness === 'uncertain') continue;
    const ids = Array.from(new Set<string>([doc.projectId, ...(doc.matchedProjectIds || [])].filter(Boolean)));
    const matchedProjectIds = ids.filter(id => {
      const project = projects.find(p => p.id === id);
      return project && evaluateDeterministicGate(doc as RawCollectedItem, project).status === 'relevant';
    });
    if (!matchedProjectIds.length) continue;
    const key = newsArticleKey(doc);
    const relatedKey = relatedReportKey(doc, matchedProjectIds);
    const existing = groups.get(key) || (relatedKey ? relatedGroups.get(relatedKey) : undefined);
    const report = { title: doc.title, sourceName: doc.sourceName, publishedAt: doc.publishedAt, url: doc.sourceUrl || doc.url || doc.primarySourceUrl };
    if (existing) {
      existing.matchedProjectIds = Array.from(new Set([...existing.matchedProjectIds, ...matchedProjectIds]));
      if (!existing.relatedReports.some((r: any) => r.url === report.url && r.title === report.title)) existing.relatedReports.push(report);
      if (relatedKey) relatedGroups.set(relatedKey, existing);
      // Keep only the representative in the displayed map; raw records remain stored.
    } else {
      const representative = { ...doc, projectId: matchedProjectIds[0], matchedProjectIds, relatedReports: [report] };
      groups.set(key, representative);
      if (relatedKey) relatedGroups.set(relatedKey, representative);
    }
  }
  return Array.from(groups.values());
}
