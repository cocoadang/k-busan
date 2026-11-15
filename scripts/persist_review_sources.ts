import { Firestore } from "@google-cloud/firestore";
import { FirestoreService } from "../src/storage/firestoreService";
import { FirestoreAnalysisQueue } from "../src/queue/analysisQueue";
import { runQueuedAnalysis } from "../src/pipeline/queuedAnalysis";
import { AttachmentReader } from "../src/attachments/attachmentReader";
import { REDEVELOPMENT_SEED_PROJECTS } from "../src/registry/redevelopmentRegistry";
import { newsDateSupported } from "../src/news/newsDateEvidence";
async function main() {
  if (process.env.PERSIST_REVIEW_SOURCES !== "true")
    throw Error("EXPLICIT_PERSIST_REQUIRED");
  const ids = JSON.parse(process.argv[1]);
  if (
    ids.length !== 10 ||
    new Set(ids).size !== 10 ||
    ids.some((x: string) => !/[a-f0-9]{64}/.test(x))
  )
    throw Error("INVALID_IDS");
  const db = new Firestore({
      projectId: "busan-redevelopment",
      databaseId: "(default)",
    ignoreUndefinedProperties: true,
    }),
    svc = new FirestoreService({ firestore: db }),
    queue = new FirestoreAnalysisQueue(db),
    owner = "review-persist_" + Date.now();
  let acquired = false;
  try {
    acquired = await svc.acquirePollLock(owner, 600000, { production: true });
    if (!acquired) throw Error("POLL_IN_PROGRESS");
    const docs = await db.getAll(
      ...ids.map((id: string) => db.collection("analysisQueue").doc(id)),
    );
    const entries = docs.map((d) => d.data() as any);
    for (const e of entries)
      if (
        !["ready", "completed"].includes(e?.state) ||
        e.result?.validation?.status !== "relevant" ||
        !newsDateSupported(
          e.item,
          e.result?.payload?.eventDate,
          e.result?.payload?.eventDateEvidence,
        )
      )
        throw Error("UNVERIFIED_SOURCE");
    const sourceSet = new Set(entries.map((e) => e.item.sourceUrl));
    const existing = (await svc.getRecentEvents(500)).map((e) => ({
      ...e,
      primarySourceUrl: e.primarySource?.url || "#",
      primarySourceTier: e.primarySource?.sourceTier || "news",
      createdAt: e.firstSeenAt,
      updatedAt: e.lastSeenAt,
      telegramEligibleByRecency: false,
      isHistorical: true,
      telegramCandidate: false,
    })) as any;
    const result = await runQueuedAnalysis({
      queue: {
        enqueue: queue.enqueue.bind(queue),
        next: async () => entries.map((e) => ({ ...e, state: "ready" })),
        stage: async () => {
          throw Error("UNEXPECTED_MODEL_WORK");
        },
        ack: queue.ack.bind(queue),
        stats: queue.stats.bind(queue),
      },
      attachments: new AttachmentReader(),
      analyzer: {} as any,
      projects: REDEVELOPMENT_SEED_PROJECTS,
      items: [],
      existingEvents: existing,
      maxItems: 10,
    });
    const touched = result.events.filter((e) =>
      e.sources.some((s) => sourceSet.has(s.url)),
    );
    for (const e of touched)
      await svc.saveEvent(
        {
          id: e.id,
          projectId: e.projectId,
          category: e.category,
          eventType: e.eventType,
          title: e.title,
          summary: e.summary,
          importance: e.importance,
          confidence: e.confidence,
          eventDate: e.eventDate,
          primarySource:
            e.sources.find((s) => s.url === e.primarySourceUrl) || e.sources[0],
          sources: e.sources,
          sourceTier: e.sourceTier,
          verificationStatus: e.verificationStatus,
          provenance: e.provenance,
          firstSeenAt: e.createdAt,
          lastSeenAt: e.updatedAt,
          alreadyDispatched: e.alreadyDispatched || false,
          isHistorical: true,
          telegramEligibleByRecency: false,
        } as any,
        { production: true },
      );
    const stored = await db.getAll(
      ...touched.map((e) => db.collection("events").doc(e.id)),
    );
    for (const entry of entries) {
      const events = stored
        .map((d) => d.data() as any)
        .filter((e) =>
          e.sources?.some((s: any) => s.url === entry.item.sourceUrl),
        );
      if (
        events.length !== 1 ||
        events[0].eventDate !== entry.result.payload.eventDate
      )
        throw Error("EVENT_PERSIST_MISMATCH");
      const source = events[0].sources.find(
        (s: any) => s.url === entry.item.sourceUrl,
      );
      if (
        source.newsEvidence?.sha256 !== entry.item.newsEvidence.sha256 ||
        source.eventDateEvidence !== entry.result.payload.eventDateEvidence
      )
        throw Error("SOURCE_PERSIST_MISMATCH");
    }
    const cycleId = "review_sources_" + Date.now(),
      finishedAt = new Date().toISOString();
    await svc.saveCollectionCycle(
      {
        id: cycleId,
        startedAt: finishedAt,
        finishedAt,
        sourcesChecked: 0,
        rssItemsDiscovered: 0,
        relevantItems: 10,
        eventsCreated: result.eventsCreated,
        eventsMerged: result.eventsMerged,
        telegramCandidates: 0,
        telegramSent: 0,
        telegramFailed: 0,
        newEventsStored: 0,
        newDocumentsStored: 0,
        officialApiStatus: "not_requested",
        errors: [],
        explanationWhyNoAlert:
          "검증된 출처 저장만 재실행했습니다. 외부 수집·AI·Telegram은 실행하지 않았습니다.",
        itemAudits: result.audits,
        sourceDetails: [],
        aiUsage: { requests: 0, cacheHits: 0, failures: 0 },
      } as any,
      { production: true },
    );
    await queue.ack(ids);
    const report = {
      cycleId,
      sourceCount: entries.length,
      eventCount: touched.length,
      aiRequests: 0,
      telegramSent: 0,
      stats: await queue.stats(),
      verifiedSourceUrls: entries.map((e) => e.item.sourceUrl),
    };
    await db
      .collection("analysisReviewRuns")
      .doc("news-review16-20261115_source_persist")
      .set({ ...report, finishedAt });
    console.log("[REVIEW_SOURCE_PERSISTED] " + JSON.stringify(report));
  } finally {
    if (acquired) await svc.releasePollLock(owner);
    await db.terminate();
  }
}
main().catch((e) => {
  console.error("[REVIEW_SOURCE_PERSIST_FAILED]", e.message);
  process.exitCode = 1;
});
