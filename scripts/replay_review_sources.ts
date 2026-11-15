import { Firestore } from "@google-cloud/firestore";
import { newsDateSupported } from "../src/news/newsDateEvidence";
async function main() {
  if (process.env.APPLY_REVIEW_SOURCE_REPLAY !== "true")
    throw Error("EXPLICIT_REPLAY_REQUIRED");
  const ids = JSON.parse(process.argv[1]);
  if (
    ids.length !== 10 ||
    new Set(ids).size !== 10 ||
    ids.some((x: string) => !/^\w{64}$/.test(x))
  )
    throw Error("INVALID_REPLAY_IDS");
  const db = new Firestore({
      projectId: "busan-redevelopment",
      databaseId: "(default)",
    }),
    lock = db.collection("locks").doc("poll"),
    owner = "review-source-replay_" + Date.now(),
    marker = db
      .collection("analysisReviewRuns")
      .doc("news-review16-20261115_sources");
  let acquired = false;
  try {
    if ((await marker.get()).data()?.done) {
      console.log(
        "[REVIEW_SOURCES_REPLAY] " + JSON.stringify({ alreadyApplied: true }),
      );
      return;
    }
    acquired = await db.runTransaction(async (tx) => {
      const s = await tx.get(lock);
      if (s.data()?.owner && s.data()!.expiresAt > Date.now()) return false;
      tx.set(lock, { owner, expiresAt: Date.now() + 600000 });
      return true;
    });
    if (!acquired) throw Error("POLL_IN_PROGRESS");
    const docs = await db.getAll(
      ...ids.map((id: string) => db.collection("analysisQueue").doc(id)),
    );
    for (const doc of docs) {
      const data = doc.data();
      if (
        data?.state !== "completed" ||
        data.result?.validation?.status !== "relevant" ||
        !data.item?.newsEvidence ||
        !newsDateSupported(
          data.item,
          data.result?.payload?.eventDate,
          data.result?.payload?.eventDateEvidence,
        )
      )
        throw Error("UNVERIFIED_REPLAY_SOURCE_" + doc.id);
    }
    for (const doc of docs)
      await db.runTransaction(async (tx) => {
        const current = await tx.get(doc.ref),
          data = current.data()!;
        if (data.state !== "completed") throw Error("REPLAY_STATE_CHANGED");
        tx.set(
          db
            .collection("analysisReviewCorrections")
            .doc("news-review16-20261115_replay_" + doc.id),
          {
            kind: "source_replay",
            originalId: doc.id,
            before: data,
            reviewedAt: new Date(),
            reason:
              "동일 대표출처 객체가 sources에서 누락되는 저장 오류 수정 후 검증된 결과를 재저장합니다.",
          },
        );
        tx.update(doc.ref, {
          state: "ready",
          nextAttemptAt: 0,
          updatedAt: Date.now(),
        });
      });
    await marker.set({
      done: true,
      ids,
      appliedAt: new Date(),
      aiRequests: 0,
      telegramSent: 0,
    });
    console.log(
      "[REVIEW_SOURCES_REPLAY] " +
        JSON.stringify({ ready: ids.length, aiRequests: 0, telegramSent: 0 }),
    );
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
  console.error("[REVIEW_SOURCES_FAILED]", e.message);
  process.exitCode = 1;
});
