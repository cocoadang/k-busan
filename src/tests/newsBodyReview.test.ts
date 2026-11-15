import test from "node:test";
import assert from "node:assert/strict";
import {
  extractNewsBody,
  newsText,
  newsUrl,
  resolveNewsUrl,
  NewsBodyReader,
} from "../news/newsBodyReader";
import { newsDateSupported } from "../news/newsDateEvidence";
import {
  stageEntry,
  enqueueEntry,
  closeReviewedEntry,
} from "../queue/analysisQueue";
import type { RawCollectedItem } from "../types/redevelopment";
const raw: RawCollectedItem = {
  id: "test",
  projectId: "gwacheon-89",
  title: "과천주공8·9단지 관리처분계획 인가",
  content: "제목만",
  sourceUrl: "https://www.newsis.com/view/example",
  sourceTier: "news",
  sourceName: "뉴시스",
  sourceType: "news-rss",
  publishedAt: "2025-01-09T02:00:00Z",
  collectedAt: "2026-11-15T00:00:00Z",
  rawFingerprint: "x",
  matchedKeywords: ["과천주공8·9단지"],
};
const body =
  "9일 정비업계에 따르면 과천시는 전날 관리처분계획 인가를 고시했다. ".repeat(
    8,
  );
const html = `<meta property="og:title" content="${raw.title}"><meta property="article:published_time" content="2025-01-09T11:00:00+09:00"><div id="articleBody">${body}</div><article>추천기사와 메뉴가 본문보다 길어도 선택하지 않습니다.${"관련기사".repeat(200)}</article>`;
test("publisher body is selected without related headlines and publication time remains provenance", () => {
  const b = extractNewsBody(html, raw.sourceUrl, raw.title);
  assert.match(b.text, /전날/);
  assert.doesNotMatch(b.text, /추천기사/);
  assert.equal(b.publishedAt, "2025-01-09T02:00:00.000Z");
  assert.throws(
    () => extractNewsBody(html, raw.sourceUrl, "완전히 다른 기사 제목입니다"),
    /TITLE_MISMATCH/,
  );
  assert.throws(
    () =>
      extractNewsBody(
        `<meta property="og:title" content="${raw.title}"><article>제목뿐</article>`,
        raw.sourceUrl,
        raw.title,
      ),
    /BODY_UNAVAILABLE/,
  );
});
test("EUC-KR news bytes are decoded without corrupting Korean", async () => {
  const r = await newsText(
    "https://news.nate.com/view/example",
    (async () =>
      new Response(Uint8Array.from([0xb0, 0xa1, 0xb3, 0xaa]), {
        headers: { "content-type": "text/html;charset=euc-kr" },
      })) as typeof fetch,
  );
  assert.equal(r.text, "가나");
});
test("Google resolution is read-only and a decoded private destination is never fetched", async () => {
  let calls = 0;
  const fake = (async () => {
    calls++;
    return calls === 1
      ? new Response('<div data-n-a-sg="signature" data-n-a-ts="123"></div>')
      : new Response(
          JSON.stringify([
            [
              "wrb.fr",
              "Fbv4je",
              JSON.stringify(["garturlres", "https://127.0.0.1/private"]),
            ],
          ]),
        );
  }) as typeof fetch;
  const url = await resolveNewsUrl(
    "https://news.google.com/rss/articles/opaque_id",
    fake,
  );
  assert.throws(() => newsUrl(url), /HOST_REJECTED/);
  assert.equal(calls, 2);
  await assert.rejects(
    newsText(
      "https://www.newsis.com/view/a",
      (async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://127.0.0.1/" },
        })) as typeof fetch,
    ),
    /HOST_REJECTED/,
  );
});
test("restricted news response causes no retry or model request", async () => {
  let calls = 0;
  await assert.rejects(
    new NewsBodyReader(undefined, (async () => {
      calls++;
      return new Response("blocked", { status: 403 });
    }) as typeof fetch).enrich(raw),
    /NEWS_HTTP_403/,
  );
  assert.equal(calls, 1);
  const e = stageEntry(
    enqueueEntry(raw, undefined, 0),
    raw,
    undefined,
    "NEWS_HTTP_403",
    1,
  );
  assert.equal(e.state, "needs_review");
  assert.equal(e.nextAttemptAt, undefined);
});
test("news event dates must be cited in the body; publication dates cannot fill missing dates", () => {
  const item = {
    ...raw,
    content: "원문 발행일:2025-01-09\n[본문]\n" + body,
    newsEvidence: {
      url: raw.sourceUrl,
      sha256: "x",
      checkedAt: 0,
      publishedAt: "2025-01-09T02:00:00Z",
      selector: "#articleBody",
    },
  };
  assert.equal(
    newsDateSupported(
      item,
      "2025-01-08",
      "과천시는 전날 관리처분계획 인가를 고시했다.",
    ),
    true,
  );
  assert.equal(
    newsDateSupported(item, "2025-01-09", "원문 발행일:2025-01-09"),
    false,
  );
  assert.equal(
    newsDateSupported(
      item,
      "2025-01-09",
      "과천시는 전날 관리처분계획 인가를 고시했다.",
    ),
    false,
  );
  const partial = { ...item, content: "[본문]\n내년 6월 철거 완료 예정" };
  assert.equal(
    newsDateSupported(partial, "2026-06-01", "내년 6월 철거 완료 예정"),
    false,
  );
  const absolute = { ...item, content: "[본문]\n2024년 1월 8일 총회 개최" };
  assert.equal(
    newsDateSupported(absolute, "2025-01-08", "2024년 1월 8일 총회 개최"),
    false,
  );
  assert.equal(
    newsDateSupported(absolute, "2024-01-08", "2024년 1월 8일 총회 개최"),
    true,
  );
});
test("manual review closure is audited separately from completion and source edits reopen work", () => {
  const pending = enqueueEntry(raw, undefined, 0);
  assert.throws(
    () =>
      closeReviewedEntry(pending, {
        kind: "date_unconfirmed",
        reason: "사건일 원문 근거가 없어 사건을 등록하지 않습니다.",
        evidenceUrls: [raw.sourceUrl],
        reviewedAt: 1,
      }),
    /INVALID_REVIEW/,
  );
  const e = closeReviewedEntry(
    { ...pending, state: "needs_review" },
    {
      kind: "date_unconfirmed",
      reason: "사건일 원문 근거가 없어 사건을 등록하지 않습니다.",
      evidenceUrls: [raw.sourceUrl],
      reviewedAt: 1,
    },
    1,
  );
  assert.equal(e.state, "closed");
  assert.equal(e.nextAttemptAt, undefined);
  assert.equal(enqueueEntry(raw, e, 2).state, "closed");
  assert.equal(
    enqueueEntry({ ...raw, content: "원문이 변경되었습니다." }, e, 2).state,
    "pending",
  );
});

test("closed reviews stay visibly closed in audits and never consume model work", async () => {
  const { runQueuedAnalysis } = await import("../pipeline/queuedAnalysis");
  const { AttachmentReader } = await import("../attachments/attachmentReader");
  const { REDEVELOPMENT_SEED_PROJECTS } = await import(
    "../registry/redevelopmentRegistry"
  );
  const project = REDEVELOPMENT_SEED_PROJECTS.find(
    (p) => p.id === "gwacheon-89",
  )!;
  const closed = closeReviewedEntry(
    { ...enqueueEntry(raw, undefined, 0), state: "needs_review" },
    {
      kind: "date_unconfirmed",
      reason: "사건일을 확인하지 못해 별도 검토 종결합니다.",
      evidenceUrls: [raw.sourceUrl],
      reviewedAt: 1,
    },
  );
  const r = await runQueuedAnalysis({
    queue: {
      enqueue: async () => new Map([[closed.id, closed]]),
      next: async () => [],
      stage: async () => {
        throw Error("unexpected");
      },
      ack: async () => {},
      stats: async () => ({ closed: 1 }),
    },
    analyzer: {} as any,
    attachments: new AttachmentReader(),
    items: [raw],
    projects: [project],
    existingEvents: [],
    maxItems: 80,
  });
  assert.equal(r.attempted, 0);
  assert.equal(r.audits[0].reviewDisposition, "closed");
  assert.match(r.audits[0].geminiReason, /검토 종결/);
});

test("cached bodies with the wrong headline or checksum are fetched again", async () => {
  let calls = 0;
  const b = extractNewsBody(html, raw.sourceUrl, raw.title);
  for (const bad of [
    { ...b, sha256: "wrong" },
    { ...b, title: "다른 기사 제목을 담은 잘못된 캐시" },
  ]) {
    const reader = new NewsBodyReader(
      { get: async () => bad, set: async () => {} },
      (async () => {
        calls++;
        return new Response(html, {
          headers: { "content-type": "text/html;charset=utf-8" },
        });
      }) as typeof fetch,
    );
    assert.equal((await reader.read(raw)).sha256, b.sha256);
  }
  assert.equal(calls, 2);
});
