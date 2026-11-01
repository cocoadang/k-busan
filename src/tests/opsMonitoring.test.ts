import test from 'node:test';
import assert from 'node:assert/strict';
import { recordPollOutcome, POLL_FAILURE_REALERT_MS, summarizeFailureReason } from '../notifier/pollHealthMonitor.ts';
import { TelegramNotifier } from '../notifier/telegramNotifier.ts';

function memoryStore() {
  const map = new Map<string, Record<string, unknown>>();
  let writes = 0;
  return {
    get writes() { return writes; },
    async getOpsState<T extends Record<string, unknown>>(key: string) { return (map.get(key) as T) || null; },
    async setOpsState(key: string, data: Record<string, unknown>) { writes++; map.set(key, data); },
  };
}

function sender() {
  const sent: string[] = [];
  return { sent, isConfigured: () => true, sendOpsAlert: async (t: string) => { sent.push(t); return { success: true }; } };
}

test('one alert after two consecutive failures, rate-limited, then a recovery message', async () => {
  const store = memoryStore();
  const s = sender();
  let now = new Date('2026-11-01T13:00:00Z').getTime();
  const clock = () => new Date(now);

  await recordPollOutcome(store, s, { ok: false, reason: 'Firestore 연결 불가' }, clock);
  assert.equal(s.sent.length, 0, 'single failure does not alert');

  now += 30 * 60_000;
  const second = await recordPollOutcome(store, s, { ok: false, reason: 'Firestore 연결 불가' }, clock);
  assert.equal(second.alertSent, true);
  assert.equal(s.sent.length, 1);
  assert.match(s.sent[0], /2회 연속 실패/);

  now += 30 * 60_000;
  await recordPollOutcome(store, s, { ok: false, reason: 'x' }, clock);
  assert.equal(s.sent.length, 1, 'no repeat within the re-alert window');

  now += POLL_FAILURE_REALERT_MS;
  await recordPollOutcome(store, s, { ok: false, reason: 'x' }, clock);
  assert.equal(s.sent.length, 2, 'repeats after the re-alert window');

  now += 30 * 60_000;
  const ok = await recordPollOutcome(store, s, { ok: true }, clock);
  assert.equal(ok.recoverySent, true);
  assert.match(s.sent[2], /복구/);
  assert.equal(ok.state.consecutiveFailures, 0);

  const writesBefore = store.writes;
  now += 30 * 60_000;
  await recordPollOutcome(store, s, { ok: true }, clock);
  assert.equal(store.writes, writesBefore, 'healthy runs do not write every time');
  assert.equal(s.sent.length, 3);
});

test('failure reasons are scrubbed of credentials', () => {
  const out = summarizeFailureReason('fetch https://api.telegram.org/bot123:ABC_def/sendMessage token=abc key=zzz');
  assert.ok(!out.includes('ABC_def'));
  assert.ok(!out.includes('abc '));
  assert.ok(!out.includes('zzz'));
});

test('Telegram 429 waits retry_after once and then succeeds; other errors do not retry', async () => {
  const realFetch = globalThis.fetch;
  const calls: number[] = [];
  const responses = [
    { status: 429, body: { ok: false, description: 'Too Many Requests', parameters: { retry_after: 1 } } },
    { status: 200, body: { ok: true, result: { message_id: 7 } } },
  ];
  globalThis.fetch = (async () => {
    calls.push(Date.now());
    const r = responses.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const n = new TelegramNotifier({ botToken: 't', chatId: 'c' } as any);
    const res = await n.sendOpsAlert('hello');
    assert.equal(res.success, true);
    assert.equal(calls.length, 2);
    assert.ok(calls[1] - calls[0] >= 900, 'waited roughly retry_after seconds');

    calls.length = 0;
    responses.push({ status: 400, body: { ok: false, description: 'Bad Request' } as any });
    const bad = await n.sendOpsAlert('x');
    assert.equal(bad.success, false);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});
