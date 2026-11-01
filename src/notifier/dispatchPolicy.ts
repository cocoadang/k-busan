import type { ExtractedEvent, MaterialImpactEvidence, RawCollectedItem } from '../types/redevelopment';

export function defaultMinImportance(): number {
  const value = Number(process.env.TELEGRAM_MIN_IMPORTANCE || 4);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 4;
}
export function validateMaterialEvidence(value: unknown, item: RawCollectedItem): MaterialImpactEvidence | undefined {
  const v = value as MaterialImpactEvidence | undefined;
  if (!v || item.detailVerified === false || !['schedule','member-cost'].includes(v.kind) ||
    !['confirmed','scheduled'].includes(v.certainty) || typeof v.quote !== 'string' || v.quote.trim().length < 20 ||
    !item.content.includes(v.quote.trim()) || typeof v.change !== 'string' || !v.change.trim() || typeof v.practicalMeaning !== 'string' || !v.practicalMeaning.trim()) return undefined;
  if (!/연기|변경|중단|의결|확정|착수|개시|시작|증액|증가|인상|감소|감액/.test(v.quote)) return undefined;
  // Ground the change in concrete milestone/date or quantified cost, never a keyword alone.
  if (v.kind === 'schedule' && (!/(이주|철거|착공|분양)/.test(v.quote) || !/20\d{2}[년.\-/]\s*\d{1,2}/.test(v.quote))) return undefined;
  if (v.kind === 'member-cost' && (!/(분담금|조합원|부담)/.test(v.quote) || !/\d[\d,.]*\s*(원|만원|억원|%)/.test(v.quote))) return undefined;
  return { kind: v.kind, certainty: v.certainty, quote: v.quote.trim(), change: v.change.trim(), practicalMeaning: v.practicalMeaning.trim(), sourceUrl: item.sourceUrl };
}
export function evaluateDispatch(event: Pick<ExtractedEvent, 'importance'|'confidence'|'eventType'|'alreadyDispatched'|'isHistorical'|'telegramEligibleByRecency'|'publishedAt'|'materialImpactEvidence'|'sources'>, minImportance = defaultMinImportance(), now = Date.now()) {
  const no = (reason: string) => ({ eligible: false, reason });
  if (event.alreadyDispatched) return no('이미 발송한 사건');
  if (!Number.isFinite(event.confidence) || event.confidence < .75) return no('신뢰도 0.75 미달');
  if (!Number.isFinite(event.importance) || event.importance < minImportance) return no(`중요도 ${minImportance} 미달`);
  if (event.isHistorical || event.telegramEligibleByRecency === false) return no('72시간 경과 과거 아카이브 자료');
  const published = Date.parse(event.publishedAt || '');
  if (!Number.isFinite(published) || published > now || now - published > 72*3600000) return no('발표일 확인 불가 또는 최근 72시간 범위 밖');
  if (/협력업체|용역|토양|감정평가/.test(event.eventType)) {
    const e = event.materialImpactEvidence;
    const source = event.sources?.find(s => s.url === e?.sourceUrl);
    if (!e || !source?.evidenceContent || source.detailVerified === false || !validateMaterialEvidence(e, {
      content: source.evidenceContent, sourceUrl: source.url, detailVerified: source.detailVerified,
    } as RawCollectedItem)) return no('협력업체 공고: 중대한 일정·조합원 부담 변화의 원문 근거 없음');
  }
  return { eligible: true, reason: '중요도·신뢰도·최신성 및 원문 근거 충족' };
}
