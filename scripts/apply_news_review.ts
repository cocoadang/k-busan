import { createHash } from "node:crypto";
import { Firestore } from "@google-cloud/firestore";
import {
  FirestoreAnalysisQueue,
  enqueueEntry,
  stageEntry,
  closeReviewedEntry,
} from "../src/queue/analysisQueue";
import {
  NewsBodyReader,
  firestoreNewsBodyCache,
} from "../src/news/newsBodyReader";
import { newsDateSupported } from "../src/news/newsDateEvidence";
const plain = (v: any) => JSON.parse(JSON.stringify(v));
async function main() {
  const plan = JSON.parse(process.argv[1]),
    apply = process.env.APPLY_NEWS_REVIEW === "true";
  if (
    plan.runId !== "news-review16-20261115" ||
    plan.entries.length !== 16 ||
    new Set(plan.entries.map((x: any) => x.entry.id)).size !== 16
  )
    throw Error("REVIEW_PLAN_INVALID");
  const db = new Firestore({
      projectId: "busan-redevelopment",
      databaseId: "(default)",
    }),
    queue = new FirestoreAnalysisQueue(db),
    lock = db.collection("locks").doc("poll"),
    owner = "review16_" + Date.now(),
    run = db.collection("analysisReviewRuns").doc(plan.runId);
  let acquired = false;
  try {
    if ((await run.get()).data()?.state === "applied") {
      console.log(
        "[NEWS_REVIEW_APPLIED] " + JSON.stringify({ alreadyApplied: true }),
      );
      return;
    }
    const prepared = [];
    for (const p of plan.entries) {
      if (!/^[a-f0-9]{64}$/.test(p.entry.id)) throw Error("REVIEW_ID_INVALID");
      if (
        p.body &&
        p.body.sha256 !== createHash("sha256").update(p.body.text).digest("hex")
      )
        throw Error("BODY_HASH_MISMATCH");
      const item = p.body
        ? await new NewsBodyReader({
            get: async () => p.body,
            set: async () => {},
          }).enrich(p.entry.item)
        : p.entry.item;
      if (
        p.action === "approve" &&
        (!p.body ||
          !newsDateSupported(
            item,
            p.result.payload.eventDate,
            p.result.payload.eventDateEvidence,
          ))
      )
        throw Error("DATE_EVIDENCE_INVALID_" + p.entry.id);
      if (Date.now() - Date.parse(item.publishedAt) < 72 * 3600000)
        throw Error("EXPECTED_HISTORICAL_SOURCE");
      prepared.push({ ...p, item });
    }
    const extraItem = await new NewsBodyReader({
      get: async () => plan.extra.body,
      set: async () => {},
    }).enrich(plan.extra.item);
    if (
      !newsDateSupported(
        extraItem,
        plan.extra.result.payload.eventDate,
        plan.extra.result.payload.eventDateEvidence,
      )
    )
      throw Error("FOLLOWUP_DATE_INVALID");
    if (apply) {
      acquired = await db.runTransaction(async (tx) => {
        const s = await tx.get(lock);
        if (s.data()?.owner && s.data()!.expiresAt > Date.now()) return false;
        tx.set(lock, {
          owner,
          expiresAt: Date.now() + 600000,
          acquiredAt: new Date().toISOString(),
        });
        return true;
      });
      if (!acquired) throw Error("POLL_IN_PROGRESS");
    }
    const snapshots = await db.getAll(
      ...prepared.map((p) => db.collection("analysisQueue").doc(p.entry.id)),
    );
    snapshots.forEach((s, i) => {
      if (s.data()?.fingerprint !== prepared[i].entry.fingerprint)
        throw Error("SOURCE_CHANGED_SINCE_REVIEW_" + prepared[i].entry.id);
    });
    const sourceUrls = new Set(prepared.map((p) => p.entry.item.sourceUrl));
    const events = await db.collection("events").get();
    const affected = events.docs.filter((d) =>
      [...(d.data().sources || []), d.data().primarySource].some(
        (s) => s && sourceUrls.has(s.url),
      ),
    );
    const preview = {
      apply,
      approve: prepared.filter((p) => p.action === "approve").length,
      close: prepared.filter((p) => p.action === "close").length,
      followup: 1,
      affectedEvents: affected.map((d) => ({
        id: d.id,
        title: d.data().title,
        eventDate: d.data().eventDate,
        withdraw: !(d.data().sources || []).some(
          (s: any) => !sourceUrls.has(s.url),
        ),
      })),
    };
    console.log("[NEWS_REVIEW_PLAN] " + JSON.stringify(preview));
    if (!apply) return;
    await run.set(
      plain({
        state: "applying",
        startedAt: new Date().toISOString(),
        plan: prepared.map((p) => ({
          id: p.entry.id,
          action: p.action,
          resolution: p.resolution,
          approval: p.approval,
        })),
      }),
    );
    const audit = db.collection("analysisReviewCorrections");
    for (const d of affected) {
      const before = d.data(),
        sources = (before.sources || []).filter(
          (s: any) => !sourceUrls.has(s.url),
        );
      await db.runTransaction(async (tx) => {
        const current = await tx.get(d.ref);
        if (current.updateTime?.isEqual(d.updateTime!) !== true)
          throw Error("EVENT_CHANGED_DURING_REVIEW");
        tx.set(audit.doc(plan.runId + "_event_" + d.id), {
          kind: "event",
          originalId: d.id,
          before,
          reviewedAt: new Date(),
          reason:
            "제목만 읽어 생성된 대상 출처를 철회하고 본문·날짜 근거로 재구성합니다.",
          action: sources.length
            ? "remove_reviewed_sources"
            : "archive_and_withdraw",
        });
        if (!sources.length) tx.delete(d.ref);
        else {
          const primary = sourceUrls.has(before.primarySource?.url)
            ? sources.find((s: any) => s.sourceTier === "official") ||
              sources[0]
            : before.primarySource;
          tx.update(d.ref, { sources, primarySource: primary });
        }
      });
    }
    for (let n = 0; n < prepared.length; n++) {
      const p = prepared[n],
        ref = snapshots[n].ref;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref),
          old = snap.data() as any;
        if (old.fingerprint !== p.entry.fingerprint)
          throw Error("QUEUE_CHANGED_DURING_REVIEW");
        tx.set(audit.doc(plan.runId + "_queue_" + p.entry.id), {
          kind: "queue",
          originalId: p.entry.id,
          before: old,
          reviewedAt: new Date(),
          action: p.action,
          resolution: p.resolution || null,
          approval: p.approval || null,
        });
        let next;
        if (p.action === "close")
          next = closeReviewedEntry(
            { ...old, item: p.item, state: "needs_review" },
            p.resolution,
          );
        else
          next = stageEntry(
            { ...old, attempts: 0, reviewApproval: p.approval },
            p.item,
            p.result,
            undefined,
            Date.now(),
          );
        tx.set(ref, plain(next));
      });
      if (p.body)
        await firestoreNewsBodyCache(db).set(p.item.sourceUrl, p.body);
    }
    const extra = enqueueEntry(plan.extra.item, undefined, Date.now());
    await db
      .collection("analysisQueue")
      .doc(extra.id)
      .set(
        plain(
          stageEntry(
            {
              ...extra,
              reviewApproval: {
                mode: "source_review",
                reason:
                  "10월31일 우려에 대한 11월6일 해결 후속 보도를 직접 확인했습니다.",
                evidenceUrls: [extraItem.sourceUrl],
                reviewedAt: Date.now(),
              },
            },
            extraItem,
            plan.extra.result,
            undefined,
            Date.now(),
          ),
        ),
      );
    await firestoreNewsBodyCache(db).set(extraItem.sourceUrl, plan.extra.body);
    const summary = {
      state: "applied",
      finishedAt: new Date().toISOString(),
      approved: preview.approve,
      closed: preview.close,
      followup: 1,
      archivedEvents: affected.length,
      telegramSent: 0,
      aiRequests: 0,
      stats: await queue.stats(),
    };
    await run.set(summary, { merge: true });
    console.log("[NEWS_REVIEW_APPLIED] " + JSON.stringify(summary));
  } finally {
    if (acquired)
      await db.runTransaction(async (tx) => {
        const s = await tx.get(lock);
        if (s.data()?.owner === owner) tx.delete(lock);
      });
    await db.terminate();
  }
}
main().catch((e) => {
  console.error("[NEWS_REVIEW_FAILED]", e.message);
  process.exitCode = 1;
});
