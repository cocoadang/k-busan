/**
 * Helpers for public (unauthenticated) API responses.
 *
 * - TtlCache: short-lived in-memory cache so every page view does not re-read Firestore.
 * - toPublicOverview: strips operational internals (Telegram chat IDs and message bodies,
 *   raw collector errors, per-item audits, raw Firestore errors) from the dashboard payload.
 * - publicErrorBody: fixed error codes instead of internal exception messages.
 */

export class TtlCache {
  private entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

  constructor(private readonly ttlMs: number, private readonly now: () => number = Date.now) {}

  /**
   * Returns the cached value for key, or runs loader once and shares the in-flight promise
   * between concurrent callers. Failed loads are not cached.
   */
  get<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const time = this.now();
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > time) return hit.value as Promise<T>;
    const value = loader();
    this.entries.set(key, { expiresAt: time + this.ttlMs, value });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    if (this.entries.size > 200) {
      for (const [k, entry] of this.entries) if (entry.expiresAt <= time) this.entries.delete(k);
    }
    return value;
  }

  clear(): void {
    this.entries.clear();
  }
}

const PUBLIC_DOCUMENT_CONTENT_LIMIT = 600;

type AnyRecord = Record<string, any>;

function pickCycleSummary(cycle: AnyRecord | null | undefined) {
  if (!cycle) return null;
  return {
    id: cycle.id,
    startedAt: cycle.startedAt,
    finishedAt: cycle.finishedAt,
    sourcesChecked: cycle.sourcesChecked,
    rssItemsDiscovered: cycle.rssItemsDiscovered,
    officialApiStatus: cycle.officialApiStatus,
    relevantItems: cycle.relevantItems,
    eventsCreated: cycle.eventsCreated,
    eventsMerged: cycle.eventsMerged,
    newEventsStored: cycle.newEventsStored,
    newDocumentsStored: cycle.newDocumentsStored,
    telegramSent: cycle.telegramSent,
    errorCount: Array.isArray(cycle.errors) ? cycle.errors.length : 0,
  };
}

export function toPublicOverview(data: AnyRecord) {
  const status = data.status || {};
  return {
    status: {
      connected: Boolean(status.connected),
      available: Boolean(status.available),
      mode: status.mode,
      // Raw initialisation errors can contain project IDs, paths or credential hints.
      degraded: Boolean(status.error),
    },
    projectCards: (data.projectCards || []).map((card: AnyRecord) => ({
      ...card,
      latestDeliveryAt: card.latestDeliveryAt ?? null,
    })),
    events: data.events || [],
    documents: (data.documents || []).map((doc: AnyRecord) => ({
      id: doc.id,
      sourceType: doc.sourceType,
      sourceTier: doc.sourceTier,
      title: doc.title,
      url: doc.url,
      publishedAt: doc.publishedAt,
      discoveredAt: doc.discoveredAt,
      matchedProjectIds: doc.matchedProjectIds,
      relatedness: doc.relatedness,
      confidence: doc.confidence,
      sourceName: doc.sourceName,
      content: typeof doc.content === 'string' ? doc.content.slice(0, PUBLIC_DOCUMENT_CONTENT_LIMIT) : '',
    })),
    areaDevelopments: data.areaDevelopments || [],
    planVersions: data.planVersions || [],
    unitTypes: data.unitTypes || [],
    latestCycle: pickCycleSummary(data.latestCycle),
  };
}

/** Generic body for 5xx responses on public endpoints; details stay in server logs only. */
export function publicErrorBody(code: string) {
  return { success: false, error: code, message: '일시적으로 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' };
}
