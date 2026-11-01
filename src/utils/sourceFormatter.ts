/**
 * Phase 4A: 정비사업 출처 표기 및 분류 포매터
 *
 * 규칙:
 * 1. 공식 행정자료 (official) -> "공식자료"
 * 2. 조합/사업주체 (association) -> "사업주체"
 * 3. 언론기사 (news) -> "언론보도"
 * 4. 기타 출처 (other) -> "기타 출처"
 *
 * 중요: 언론기사에 행정절차(고시, 인가 등)가 언급되었다는 이유만으로 공식자료로 분류하지 않는다.
 */

export type DisplaySourceTier = '공식자료' | '사업주체' | '언론보도' | '기타 출처';

export interface SourceTierDisplayInfo {
  label: DisplaySourceTier;
  badgeClass: string;
  dotClass: string;
  description: string;
}

export function getDisplaySourceTier(
  sourceTier?: string,
  sourceType?: string,
  sourceName?: string
): SourceTierDisplayInfo {
  const tier = (sourceTier || '').toLowerCase();
  const type = (sourceType || '').toLowerCase();

  // 1. 공식 행정자료 (시청, 구청, 관보, 고시공고 등)
  if (
    tier === 'official' ||
    type === 'official-api' ||
    type === 'official-web' ||
    type === 'official-notice' ||
    type === 'official-admin'
  ) {
    return {
      label: '공식자료',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dotClass: 'bg-emerald-500',
      description: '지자체·행정청 공인 고시·공고 자료',
    };
  }

  // 2. 언론기사 (언론사, 포털 RSS, 보도자료)
  // 언론기사에 총회나 인허가 내용이 담겨 있더라도 원천이 언론이면 반드시 "언론보도"로 분류
  if (
    tier === 'news' ||
    type === 'news-rss' ||
    type === 'news-api' ||
    type === 'archive-news'
  ) {
    return {
      label: '언론보도',
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      dotClass: 'bg-blue-500',
      description: '일간지·경제지·지역 언론 보도 기사',
    };
  }

  // 3. 조합/사업주체 자료 (실제 조합 공문, 총회 공고문 등 원문 출처가 association인 경우만)
  if (
    tier === 'association' ||
    type === 'association-doc'
  ) {
    return {
      label: '사업주체',
      badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      dotClass: 'bg-indigo-500',
      description: '조합 및 사업시행주체 공식 자료',
    };
  }

  // 4. 기타
  return {
    label: '기타 출처',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
    description: '기타 참조 및 외부 수집 자료',
  };
}
