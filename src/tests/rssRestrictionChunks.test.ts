import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsCollector } from '../collector/newsCollector';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry';

test('restriction detection and sample hash do not depend on network chunk boundaries', async () => {
  const original = globalThis.fetch;
  const results = [];
  try {
    for (const chunks of [['<html>unusual traffic</html>'], ['<html>un', 'usual traf', 'fic</html>']]) {
      let calls = 0;
      globalThis.fetch = (async () => {
        calls++;
        return new Response(new ReadableStream({start(controller) {
          for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        }}), {status:503, headers:{'content-type':'text/html'}});
      }) as typeof fetch;
      const result = await new NewsCollector(0).fetchForProject(REDEVELOPMENT_SEED_PROJECTS[0]);
      assert.equal(calls, 1, 'restricted response must not be retried');
      assert.match(result.error!, /restrictionPage=true/);
      assert.equal(result.items.length, 0);
      results.push(result.error!.match(/initial503SampleSha256=([a-f0-9]+)/)![1]);
    }
    assert.equal(results[0], results[1]);
  } finally {globalThis.fetch = original;}
});

test('oversized error prefix is bounded and never retried as a known transient error', async () => {
  const original = globalThis.fetch; let calls = 0; let cancelled = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(new ReadableStream({start(c) {c.enqueue(new TextEncoder().encode('x'.repeat(8192)));},cancel() {cancelled++;}}), {status:503});
  }) as typeof fetch;
  try {
    const result = await new NewsCollector(0).fetchForProject(REDEVELOPMENT_SEED_PROJECTS[0]);
    assert.equal(calls, 1); assert.equal(cancelled, 1);
    assert.match(result.error!, /sampleBytes=4096; sampleLimitReached=true/);
    assert.equal(result.items.length, 0);
  } finally {globalThis.fetch = original;}
});

test('stalled 503 body respects deadline and stops alternative queries', async () => {
  const original = globalThis.fetch; let calls = 0; let cancelled = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(new ReadableStream({start(c) {c.enqueue(new TextEncoder().encode('<html>'));},cancel() {cancelled++;}}), {status:503});
  }) as typeof fetch;
  try {
    const result = await new NewsCollector(0).fetchForProject(REDEVELOPMENT_SEED_PROJECTS[0], {timeoutMs:20});
    assert.equal(calls, 1); assert.equal(cancelled, 1);
    assert.equal(result.httpStatus, 503); assert.ok(result.error);
    assert.equal(result.items.length, 0);
  } finally {globalThis.fetch = original;}
});
