import test from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache, toPublicOverview, publicErrorBody } from '../utils/publicApi.ts';
import { capCollectionCycleDoc, CYCLE_DOC_BYTE_BUDGET } from '../storage/cycleDocLimits.ts';
import { FirestoreService, mergeEventSources } from '../storage/firestoreService.ts';
import { resolvePreviewConfig } from '../storage/readinessService.ts';
import { clampTelegramText, TELEGRAM_MAX_MESSAGE_LENGTH } from '../notifier/telegramNotifier.ts';
import { resolveGeminiModel, DEFAULT_GEMINI_MODEL } from '../analyzer/geminiAnalyzer.ts';

test('TtlCache shares in-flight loads, expires, and does not cache failures', async () => {
  let now = 0;
  const cache = new TtlCache(1000, () => now);
  let calls = 0;
  const loader = async () => ++calls;
  const [a, b] = await Promise.all([cache.get('k', loader), cache.get('k', loader)]);
  assert.equal(a, 1); assert.equal(b, 1); assert.equal(calls, 1);
  now = 1500;
  assert.equal(await cache.get('k', loader), 2);
  await assert.rejects(cache.get('bad', async () => { throw new Error('boom'); }));
  assert.equal(await cache.get('bad', async () => 'ok'), 'ok');
});

test('public overview strips Telegram, audit and raw error details', () => {
  const out: any = toPublicOverview({
    status: { connected: false, available: false, mode: 'in_memory_fallback', error: 'secret path /creds.json' },
    projectCards: [{ projectId: 'chokjin-3' }],
    events: [{ id: 'e1' }],
    documents: [{ id: 'd1', title: 't', content: 'x'.repeat(5000), url: 'https://a', matchedProjectIds: ['chokjin-3'] }],
    deliveries: [{ chatId: '12345', messageText: 'private' }],
    latestCycle: { id: 'c1', errors: ['upstream detail'], itemAudits: [{ title: 'a' }] },
    recentCycles: [{ id: 'c1' }],
  });
  const json = JSON.stringify(out);
  assert.ok(!json.includes('secret path'));
  assert.ok(!json.includes('12345'));
  assert.ok(!json.includes('upstream detail'));
  assert.equal(out.deliveries, undefined);
  assert.equal(out.recentCycles, undefined);
  assert.equal(out.status.available, false);
  assert.equal(out.status.degraded, true);
  assert.equal(out.latestCycle.errorCount, 1);
  assert.ok(out.documents[0].content.length <= 600);
  assert.ok(!JSON.stringify(publicErrorBody('X')).includes('Error:'));
});

test('collection cycle documents are capped under the Firestore size budget', () => {
  const audits = Array.from({ length: 5000 }, (_, i) => ({
    projectId: 'chokjin-3', matchedAlias: 'a', title: '제목'.repeat(200), source: 's', sourceTier: 'news',
    publishedAt: '2026-01-01', sourceUrl: `https://n/${i}`, deterministicGateResult: 'relevant',
    geminiRelatednessResult: i === 4999 ? 'relevant' : 'uncertain', confidence: 0, eventType: 'x',
    importance: i === 4999 ? 5 : 1, telegramCandidate: i === 4999,
  }));
  const doc: any = { id: 'c', startedAt: '', finishedAt: '', sourcesChecked: 1, rssItemsDiscovered: 1,
    officialApiStatus: 'active', relevantItems: 1, eventsCreated: 1, eventsMerged: 0, telegramCandidates: 1,
    telegramSent: 0, telegramFailed: 0, errors: Array.from({ length: 200 }, () => 'e'), itemAudits: audits };
  const capped: any = capCollectionCycleDoc(doc);
  assert.ok(Buffer.byteLength(JSON.stringify(capped)) <= CYCLE_DOC_BYTE_BUDGET);
  assert.equal(capped.errors.length, 50);
  assert.equal(capped.itemAudits[0].sourceUrl, 'https://n/4999', 'telegram candidates are kept first');
  assert.ok(capped.truncated.itemAudits > 0);
  // Small documents pass through untouched.
  const small: any = capCollectionCycleDoc({ ...doc, errors: [], itemAudits: [audits[0]] });
  assert.equal(small.truncated, undefined);
});

test('delivery reservations: stale pending is held for review, failed retries are capped', () => {
  const old = new Date(Date.now() - 10 * 60_000).toISOString();
  const fresh = new Date().toISOString();
  const base: any = { id: 'd', eventId: 'e', projectId: 'p', messageHash: 'h', chatId: '' };
  assert.equal(FirestoreService.evaluateExistingDelivery({ ...base, status: 'sent', createdAt: old }), 'ALREADY_SENT');
  assert.equal(FirestoreService.evaluateExistingDelivery({ ...base, status: 'pending', createdAt: fresh }), 'CONCURRENT_PENDING_LOCK');
  assert.equal(FirestoreService.evaluateExistingDelivery({ ...base, status: 'pending', createdAt: old }), 'STALE_PENDING_NEEDS_REVIEW');
  assert.equal(FirestoreService.evaluateExistingDelivery({ ...base, status: 'failed', createdAt: old, attempts: 1 }), null);
  assert.equal(FirestoreService.evaluateExistingDelivery({ ...base, status: 'failed', createdAt: old, attempts: 3 }), 'MAX_ATTEMPTS_REACHED');
});

test('poll lock blocks a second concurrent run until released or expired', async () => {
  const svc = new FirestoreService({ firestore: null });
  assert.equal(await svc.acquirePollLock('a', 60_000), true);
  assert.equal(await svc.acquirePollLock('b', 60_000), false);
  await svc.releasePollLock('a');
  assert.equal(await svc.acquirePollLock('b', 1), true);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(await svc.acquirePollLock('c', 60_000), true, 'expired lock can be taken over');
});

test('poll lock is transactional on the Firestore client', async () => {
  const svc = new FirestoreService({ simulatedConnected: true });
  assert.equal(await svc.acquirePollLock('a', 60_000, { production: true }), true);
  assert.equal(await svc.acquirePollLock('b', 60_000, { production: true }), false);
  await svc.releasePollLock('a');
  assert.equal(await svc.acquirePollLock('b', 60_000, { production: true }), true);
});

test('event sources are merged by URL instead of overwritten', () => {
  const merged = mergeEventSources([{ url: 'a', title: '1' }], [{ url: 'a', title: 'dup' }, { url: 'b', title: '2' }]);
  assert.deepEqual(merged.map((s) => s.url), ['a', 'b']);
  assert.equal(merged[0].title, '1');
});

test('saveEvent keeps firstSeenAt and accumulates sources on the memory store', async () => {
  const svc = new FirestoreService({ firestore: null });
  const base: any = { id: 'evt-merge', projectId: 'chokjin-3', category: '총회', eventType: 't', title: 't', summary: 's',
    importance: 3, confidence: 0.9, eventDate: '2026-11-01', isHistorical: false, telegramEligibleByRecency: true,
    primarySource: { url: 'a' }, alreadyDispatched: false, lastSeenAt: '' };
  await svc.saveEvent({ ...base, firstSeenAt: '2026-11-01T00:00:00.000Z', sources: [{ url: 'a' }] });
  await svc.saveEvent({ ...base, firstSeenAt: '2026-11-02T00:00:00.000Z', sources: [{ url: 'b' }] });
  const saved = (await svc.getRecentEvents(500)).find((e) => e.id === 'evt-merge')!;
  assert.equal(saved.firstSeenAt, '2026-11-01T00:00:00.000Z');
  assert.deepEqual((saved.sources || []).map((s: any) => s.url), ['a', 'b']);
});

test('preview proxy is opt-in and never active in production', () => {
  assert.deepEqual(resolvePreviewConfig({ NODE_ENV: 'development' } as any), { enabled: false, upstreamOrigin: null });
  assert.equal(resolvePreviewConfig({ PREVIEW_MODE: 'true', NODE_ENV: 'production' } as any).enabled, false);
  const cfg = resolvePreviewConfig({ PREVIEW_MODE: 'true', PREVIEW_UPSTREAM_ORIGIN: 'https://apt.dsoom.com/x' } as any);
  assert.deepEqual(cfg, { enabled: true, upstreamOrigin: 'https://apt.dsoom.com' });
  assert.equal(resolvePreviewConfig({ PREVIEW_MODE: 'true', PREVIEW_UPSTREAM_ORIGIN: 'http://insecure.example' } as any).upstreamOrigin, null);
});

test('Telegram text is clamped below the API limit', () => {
  assert.equal(clampTelegramText('짧은 메시지'), '짧은 메시지');
  assert.equal(clampTelegramText('가'.repeat(5000)).length, TELEGRAM_MAX_MESSAGE_LENGTH);
});

test('Gemini model has one source of truth', () => {
  const prevAnalysis = process.env.OPENAI_MODEL;
  const prevLegacy = process.env.GEMINI_MODEL;
  delete process.env.OPENAI_MODEL;
  process.env.GEMINI_MODEL = 'gemini-2.5-flash';
  assert.equal(resolveGeminiModel(), DEFAULT_GEMINI_MODEL, 'legacy GEMINI_MODEL must not switch the model');
  process.env.OPENAI_MODEL = 'custom-model';
  assert.equal(resolveGeminiModel(), 'custom-model');
  if (prevAnalysis === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = prevAnalysis;
  if (prevLegacy === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = prevLegacy;
});
