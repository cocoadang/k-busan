import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import { createApiSecurity, PUBLIC_DATA_CACHE_CONTROL } from '../security/apiSecurity.ts';
import { resolveWebpSibling } from '../utils/planAssets.ts';
import { mergeDocumentsNewestFirst } from '../storage/firestoreService.ts';
import { parseDashboardHash, formatDashboardHash } from '../components/Phase3Dashboard.tsx';

async function withServer(app: express.Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  try { await run(`http://127.0.0.1:${(server.address() as { port: number }).port}`); }
  finally { await new Promise<void>((r) => server.close(() => r())); }
}

test('one client hitting its public quota does not block other clients', async () => {
  const app = express();
  app.use(createApiSecurity({ production: true, secret: () => 's', clientLimit: 2, publicLimit: 100 }));
  app.all('*', (_req, res) => res.json({ ok: true }));
  await withServer(app, async (base) => {
    const as = (ip: string) => fetch(base + '/api/registry', { headers: { 'X-Forwarded-For': ip } });
    assert.equal((await as('1.1.1.1')).status, 200);
    assert.equal((await as('1.1.1.1')).status, 200);
    assert.equal((await as('1.1.1.1')).status, 429);
    assert.equal((await as('2.2.2.2')).status, 200);
  });
});

test('public data is briefly cacheable; health, status and admin calls are not', async () => {
  const app = express();
  app.use(createApiSecurity({ production: true, secret: () => 's' }));
  app.all('*', (_req, res) => res.json({ ok: true }));
  await withServer(app, async (base) => {
    assert.equal((await fetch(base + '/api/storage/overview')).headers.get('cache-control'), PUBLIC_DATA_CACHE_CONTROL);
    assert.equal((await fetch(base + '/api/health')).headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(base + '/api/status')).headers.get('cache-control'), 'no-store');
    const admin = await fetch(base + '/api/jobs/poll', { headers: { Authorization: 'Bearer s' } });
    assert.equal(admin.headers.get('cache-control'), 'no-store');
  });
});

test('WebP siblings resolve only inside the plan folder', () => {
  const root = path.join(process.cwd(), 'public/assets/plans');
  assert.equal(resolveWebpSibling(root, '/chokjin3/배치도.jpg'), '/chokjin3/배치도.jpg.webp');
  assert.equal(resolveWebpSibling(root, encodeURI('/chokjin3/배치도.jpg')), encodeURI('/chokjin3/배치도.jpg') + '.webp');
  assert.equal(resolveWebpSibling(root, '/nope/missing.jpg'), null);
  assert.equal(resolveWebpSibling(root, '/../../package.json'), null);
});

test('per-project news is merged with the global list without duplicates, newest first', () => {
  const doc = (id: string, publishedAt: string) => ({ id, publishedAt } as any);
  const merged = mergeDocumentsNewestFirst([doc('a', '2026-11-10'), doc('b', '2026-11-12')], [doc('a', '2026-11-10'), doc('c', '2025-01-01')]);
  assert.deepEqual(merged.map((d) => d.id), ['b', 'a', 'c']);
});

test('dashboard tab and project round-trip through the URL hash', () => {
  assert.deepEqual(parseDashboardHash(formatDashboardHash('news', 'udong-3')), { tab: 'news', projectId: 'udong-3' });
  assert.deepEqual(parseDashboardHash(''), { tab: 'plans', projectId: 'chokjin-3' });
  assert.deepEqual(parseDashboardHash('#/unknown/evil'), { tab: 'plans', projectId: 'chokjin-3' });
  assert.deepEqual(parseDashboardHash('#/timeline/gwacheon-10'), { tab: 'timeline', projectId: 'gwacheon-10' });
});
