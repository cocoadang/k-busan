import { evaluateDispatch } from '../notifier/dispatchPolicy';
import { createHash } from 'node:crypto';
import {
  EventSourceRef,
  ExtractedEvent,
  ImportanceLevel,
  RawCollectedItem,
} from '../types/redevelopment';
import { ExtractedEventPayload } from './geminiAnalyzer';

export interface DeduplicationResult {
  events: ExtractedEvent[];
  eventsCreated: number;
  eventsMerged: number;
  telegramCandidates: number;
}

/**
 * Event Deduplication & Telegram Candidate Evaluator
 *
 * Rules:
 * 1. Merges multiple articles or official notices reporting the same event into a single ExtractedEvent.
 * 2. Official sources are strictly prioritized as `primarySourceUrl` and `primarySourceTier = 'official'`.
 * 3. `importance` is upgraded to the maximum across all grouped sources.
 * 4. Telegram Candidate condition:
 *    `confidence >= 0.75` AND `importance >= 4` AND `!alreadyDispatched`.
 */
export class EventDeduplicator {
  /**
   * Group extracted payloads and existing events
   */
  public deduplicateAndMerge(
    newPayloads: Array<{ payload: ExtractedEventPayload; rawItem: RawCollectedItem }>,
    existingEvents: ExtractedEvent[] = []
  ): DeduplicationResult {
    const eventMap = new Map<string, ExtractedEvent>();
    let eventsCreated = 0;
    let eventsMerged = 0;

    // Load existing events into map by their cluster key
    for (const evt of existingEvents) {
      const source = evt.sources.find(s => s.url === evt.primarySourceUrl) || evt.sources[0];
      const key = this.generateClusterSignature(evt.projectId, evt.eventType, evt.eventDate,
        this.procurementIdentity(evt.eventType, source?.title || evt.title, source?.noticeNumber, source?.url || evt.primarySourceUrl, source?.actorType || evt.provenance?.actorType));
      eventMap.set(key, { ...evt });
    }

    for (const { payload, rawItem } of newPayloads) {
      const clusterKey = this.generateClusterSignature(
        payload.projectId, payload.eventType, payload.eventDate,
        this.procurementIdentity(payload.eventType, rawItem.title, rawItem.noticeNumber, rawItem.sourceUrl, rawItem.actorType)
      );

      // Recency policy calculation: 72 hours threshold
      const pubTime = new Date(rawItem.publishedAt).getTime();
      const discTime = Date.now(); // Delayed queue work must not revive historical alerts.
      const ageHours = (discTime - pubTime) / (1000 * 60 * 60);
      const isHistorical = ageHours > 72;
      const telegramEligibleByRecency = !isHistorical;

      const sourceRef: EventSourceRef = {
        actorType: rawItem.actorType,
        detailVerified: rawItem.detailVerified,
        attachmentUrls: rawItem.attachmentUrls,
        attachmentEvidence: rawItem.attachmentEvidence,
        attachmentContentStatus: rawItem.attachmentContentStatus ?? (rawItem.attachmentUrls?.length ? "unverified" : "not_applicable"),
        evidenceContent: rawItem.detailVerified === false ? undefined : rawItem.content,
        title: rawItem.title,
        url: rawItem.sourceUrl,
        source: rawItem.sourceName,
        sourceTier: rawItem.sourceTier,
        sourceType: rawItem.sourceType,
        publishedAt: rawItem.publishedAt,
        discoveredAt: rawItem.collectedAt,
        snippet: rawItem.content?.slice(0, 200),
        noticeNumber: rawItem.noticeNumber,
        department: rawItem.department,
        sectionType: rawItem.sectionType,
      };

      if (eventMap.has(clusterKey)) {
        // MERGE INTO EXISTING EVENT
        const existing = eventMap.get(clusterKey)!;
        eventsMerged++;

        // Add source if not already present
        const sourceIndex=existing.sources.findIndex(s=>s.url===sourceRef.url);
        if(sourceIndex<0)existing.sources.push(sourceRef);
        else if(sourceRef.attachmentContentStatus==='verified')existing.sources[sourceIndex]={...existing.sources[sourceIndex],...sourceRef};

        // Rule: Prioritize official source as primary source
        if (sourceRef.sourceTier === 'official') {
          existing.primarySourceTier = 'official';
          existing.primarySourceUrl = sourceRef.url;
        }

        // Maximize importance if newer report reveals higher urgency
        if (payload.importance > existing.importance) {
          existing.importance = payload.importance;
        }

        // If newly discovered source is recent, update recency eligibility
        if (telegramEligibleByRecency) {
          existing.telegramEligibleByRecency = true;
          existing.isHistorical = false;
        }

        if (payload.materialImpactEvidence) existing.materialImpactEvidence = payload.materialImpactEvidence;
        // Re-evaluate Telegram Candidate with updated importance and recency
        existing.telegramCandidate = this.evaluateTelegramCandidate(
          existing.confidence,
          existing.importance,
          existing.alreadyDispatched,
          existing.telegramEligibleByRecency
        );
        existing.telegramCandidateReason = this.explainTelegramCandidate(
          existing.confidence,
          existing.importance,
          existing.alreadyDispatched,
          existing.telegramEligibleByRecency
        );

        existing.updatedAt = new Date().toISOString();
      } else {
        // CREATE NEW EVENT
        eventsCreated++;
        const isCandidate = this.evaluateTelegramCandidate(
          payload.confidence,
          payload.importance,
          false,
          telegramEligibleByRecency
        );

        const newEvent: ExtractedEvent = {
          materialImpactEvidence: payload.materialImpactEvidence,
          sourceTier: rawItem.actorType === 'association' ? 'association' : rawItem.sourceTier,
          verificationStatus: rawItem.actorType === 'association' ? 'supported' : rawItem.sourceTier === 'official' ? 'verified' : 'unverified',
          provenance: { actorType: rawItem.actorType || (rawItem.sourceTier === 'official' ? 'official' : undefined), documentUrlVerified: rawItem.detailVerified },
          id: `evt_${payload.projectId}_${createHash('sha256').update(clusterKey).digest('hex').slice(0, 24)}`,
          projectId: payload.projectId,
          eventType: payload.eventType,
          category: payload.category,
          title: payload.title,
          summary: payload.summary,
          importance: payload.importance,
          confidence: payload.confidence,
          eventDate: payload.eventDate,
          primarySourceUrl: payload.sourceUrl,
          primarySourceTier: payload.sourceTier,
          sources: [sourceRef],
          reasoningSummary: payload.reasoningSummary,
          telegramCandidate: isCandidate,
          telegramCandidateReason: this.explainTelegramCandidate(
            payload.confidence,
            payload.importance,
            false,
            telegramEligibleByRecency
          ),
          alreadyDispatched: false,
          publishedAt: rawItem.publishedAt,
          discoveredAt: rawItem.collectedAt,
          isHistorical,
          telegramEligibleByRecency,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        eventMap.set(clusterKey, newEvent);
      }
    }

    const allEvents = Array.from(eventMap.values());
    for (const e of allEvents) {
      const decision = evaluateDispatch(e);
      e.telegramCandidate = decision.eligible;
      e.telegramCandidateReason = decision.reason;
    }
    const telegramCandidates = allEvents.filter((e) => e.telegramCandidate).length;

    return {
      events: allEvents,
      eventsCreated,
      eventsMerged,
      telegramCandidates,
    };
  }

  /**
   * Generates a normalized cluster signature based on project, eventType, and eventDate
   */
  public generateClusterSignature(
    projectId: string,
    eventType: string,
    eventDate: string,
    procurementKey = ''
  ): string {
    const normalizedType = eventType
      .replace(/\s+/g, '')
      .replace(/고시|공고|안내/g, '');
    // Separate different dates and procurement subjects; never truncate event types.
    const dateBucket = eventDate.slice(0, 10);
    return `${projectId}:${normalizedType}:${dateBucket}${procurementKey ? ':' + procurementKey : ''}`;
  }

  /** Procurement identity comes from the source, not AI's generic event label. */
  private procurementIdentity(eventType: string, title: string, noticeNumber?: string, sourceUrl = '', actorType?: string): string {
    if (!/입찰|협력업체|용역|업체.*선정/.test(eventType)) return '';
    const text = title.replace(/\s+/g, '');
    const scopes = [...text.matchAll(/기반시설공사건설사업관리|부지정지공사|토양정밀조사|지적측량|수직부재축소량(?:해석[&·]?계측)?|공공청사(?:기본및)?실시설계|법무법인/g)].map(m => m[0]);
    if (noticeNumber) return 'notice:' + noticeNumber.replace(/\s+/g, '');
    if (actorType === 'association') return 'source:' + sourceUrl;
    if (scopes.length) return 'scope:' + [...new Set(scopes)].sort().join('+');
    const brackets = [...title.matchAll(/[\[（(]([^\]）)]+)[\]）)]/g)].map(m => m[1].replace(/\s+/g, '')).filter(v => /공사|관리|조사|측량|설계|용역|감리|법무|해석|계측/.test(v));
    if (brackets.length) return 'scope:' + [...new Set(brackets)].sort().join('+');
    // Ambiguous subjects stay separate instead of being merged solely by date/type.
    return 'source:' + sourceUrl;
  }

  /**
   * Telegram Candidate Evaluation:
   * condition: confidence >= 0.75 AND importance >= 4 AND !alreadyDispatched AND telegramEligibleByRecency
   */
  public evaluateTelegramCandidate(
    confidence: number,
    importance: ImportanceLevel,
    alreadyDispatched = false,
    telegramEligibleByRecency = true
  ): boolean {
    if (alreadyDispatched) return false;
    if (!telegramEligibleByRecency) return false;
    return confidence >= 0.75 && importance >= 4;
  }

  /**
   * Human-readable explanation for audit logs
   */
  public explainTelegramCandidate(
    confidence: number,
    importance: ImportanceLevel,
    alreadyDispatched = false,
    telegramEligibleByRecency = true
  ): string {
    if (alreadyDispatched) {
      return '이미 텔레그램으로 발송 완료된 이벤트 (중복 발송 방지)';
    }
    if (!telegramEligibleByRecency) {
      return '72시간 경과 과거 자료 (최신성 정책에 따라 실시간 텔레그램 발송 제외 및 아카이브 저장)';
    }
    if (confidence < 0.75) {
      return `신뢰도 기준 미달 (신뢰도: ${confidence.toFixed(2)} < 0.75 기준치)`;
    }
    if (importance < 4) {
      return `중요도 기준 미달 (중요도: ${importance}등급 < 4등급 기준치). 통상적 총회 안내나 시황 뉴스는 텔레그램 피로도를 줄이기 위해 발송에서 제외됩니다.`;
    }
    return `텔레그램 발송 후보 승인 (중요도 ${importance}등급, 신뢰도 ${confidence.toFixed(2)}: 중대 사업 변곡점)`;
  }
}
