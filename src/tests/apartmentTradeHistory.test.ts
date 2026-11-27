import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ApartmentTradeHistory from '../components/ApartmentTradeHistory';
import { tradeHistoryComplexes, tradeHistoryLink, tradeHistoryOrigin } from '../housing/apartmentTradeHistory';
import { createTradeHistoryService, parseTradeHistoryQuery, verifyTradeHistorySnapshot } from '../housing/apartmentTradeHistoryApi';

const q = { complex: 'gwacheon_raemian_sur', family: 'raemian_sur_59', start: '202609', end: '202611', page: '1' };
const exact = parseTradeHistoryQuery(q, '202611')!;
const row = (over = {}) => ({
  id: 'test-id', complexId: q.complex, areaFamilyId: q.family, dataSource: 'MOLIT_OPENAPI', dealDate: '2026-10-19',
  exclusiveArea: 59.973, price: 190000, floor: 16, activeCount: 1, isCancelled: false, ...over,
});
const snapshot = (items: unknown[], over = {}) => ({
  success: true, source: 'FIRESTORE', complexId: q.complex, lawdCd: '41290', startYmd: q.start, endYmd: q.end,
  hasMore: false, nextCursor: null, page: 1, totalCount: items.length, items, ...over,
});

test('trade history allows only canonical complex/family pairs, exact bounded contracted months and pages', () => {
  assert.equal(tradeHistoryComplexes.length, 4);
  assert.equal(tradeHistoryComplexes.reduce((count, c) => count + c.families.length, 0), 20);
  assert.equal(exact.district, '41290');
  for (const change of [
    { url: 'https://example.org' }, { complex: ['gwacheon_raemian_sur'] },
    { complex: 'dogok' }, { family: 'gracium_59' }, { start: '202612' }, { start: '200512' },
    { start: '202511' }, { end: '202613' }, { end: '202612' }, { page: '-1' }, { page: '1.0' }, { page: '101' },
  ]) assert.equal(parseTradeHistoryQuery({ ...q, ...change }, '202611'), null);
  assert.ok(parseTradeHistoryQuery({ ...q, start: '202512' }, '202611'));
});

test('unified history preserves the revision reported by Firestore and rejects missing provenance', async () => {
  const revision = 'r20261127013219_0d34fa17';
  for (const upstream of [undefined, 'invalid']) {
    const service = createTradeHistoryService(async () => Response.json(snapshot([row()], { revision: upstream })), undefined, true);
    await assert.rejects(service(q), /KH_UNVERIFIED_REVISION/);
  }
  const service = createTradeHistoryService(async () => Response.json(snapshot([row()], { revision })), undefined, true);
  assert.equal((await service(q))?.revision, revision);
});

test('keeps active and cancelled rows with same reported signature if upstream IDs are distinct', () => {
  const s = verifyTradeHistorySnapshot(snapshot([row(), row({ id: 'second', isCancelled: true, activeCount: 0 })]), exact);
  assert.equal(s.storedRows, 2);
  assert.equal(s.cancelledRows, 1);
  assert.deepEqual(s.rows.map(r => [r.dealDate, r.amountManwon, r.exactArea, r.cancelled]), [
    ['2026-10-19', 190000, 59.973, true], ['2026-10-19', 190000, 59.973, false],
  ]);
  assert.equal(JSON.stringify(s).includes('test-id'), false);
  assert.throws(() => verifyTradeHistorySnapshot(snapshot([row(), row()]), exact), /KH_UNVERIFIED_ROW/);
});

test('fails closed on absent coverage, wrong identity, invalid rows or a truncated upstream payload', () => {
  for (const different of [
    { hasMore: true }, { nextCursor: 'cursor' }, { success: false }, { lawdCd: '11740' }, { totalCount: 4 },
    { source: 'UNKNOWN' }, { startYmd: '202610' }, { endYmd: '202610' }, { page: 2 },
  ]) assert.throws(() => verifyTradeHistorySnapshot(snapshot([row()], different), exact), /KH_UNVERIFIED_SNAPSHOT/);
  for (const different of [
    { complexId: 'gangdong_gracium' }, { areaFamilyId: 'gracium_59' }, { dataSource: 'OTHER' },
    { isCancelled: undefined }, { dealDate: '2026-11-31' }, { dealDate: '2026-08-01' },
    { price: -5 }, { exclusiveArea: '84.00' }, { floor: Infinity }, { activeCount: 0 },
  ]) assert.throws(() => verifyTradeHistorySnapshot(snapshot([row(different)]), exact), /KH_UNVERIFIED_ROW/);
  assert.equal(verifyTradeHistorySnapshot(snapshot([]), exact).storedRows, 0);
});

test('uses the fixed HTTPS origin, no redirect, bounded pagination and cache/coalescing, active count excludes cancelled', async () => {
  let called = 0;
  const service = createTradeHistoryService(async (input, opts) => {
    called++;
    const url = new URL(String(input));
    assert.equal(url.origin, tradeHistoryOrigin);
    assert.equal(url.pathname, '/api/complex-trades/gwacheon_raemian_sur');
    assert.deepEqual(Object.fromEntries(url.searchParams), { areaFamilyId: q.family, startYmd: q.start, endYmd: q.end, fetchAll: 'true' });
    assert.equal(opts?.redirect, 'error');
    return Response.json(snapshot(Array.from({ length: 21 }, (_, i) => row({ id: String(i), isCancelled: i === 20 }))));
  });
  assert.equal(await service({ ...q, family: 'wrong' }), null);
  const [a, b] = await Promise.all([service(q), service({ ...q, page: '2' })]);
  assert.equal(called, 1);
  assert.equal(a?.rows.length, 20);
  assert.equal(b?.rows.length, 1);
  assert.equal(b?.coverage, 'saved_snapshot_only');
  assert.equal(b?.cancelledRows, 1);
  assert.equal(b?.activeRows, 20);
  assert.equal(await service({ ...q, page: '3' }), null);
  assert.equal(called, 1);
});

test('upstream errors or wrong payload type remain unavailable, never a successful empty result', async () => {
  const fault = createTradeHistoryService(async () => new Response('not JSON', { status: 503 }));
  await assert.rejects(fault(q), /KH_UNAVAILABLE/);
  const redirect = createTradeHistoryService(async () => Response.redirect('https://example.org'));
  await assert.rejects(redirect(q), /KH_UNAVAILABLE/);
  const huge = createTradeHistoryService(async () => new Response('x'.repeat(2_000_001), { headers: { 'content-type': 'application/json' } }));
  await assert.rejects(huge(q), /KH_TOO_LARGE/);
});

test('history view has explicit saved coverage and canonical preselection without offering the unverified pair', () => {
  const html = renderToStaticMarkup(createElement(ApartmentTradeHistory, { initialComplex: 'gangdong_gracium' }));
  assert.match(html, /실거래 이력/);
  assert.match(html, /value="gangdong_gracium" selected=""/);
  assert.match(html, /gracium_59/);
  assert.doesNotMatch(html, /<option[^>]*>도곡한신/);
  assert.match(html, /전체 신고 이력이나 현재 시세를 보장하지 않습니다/);
  assert.equal(tradeHistoryLink('도곡한신'), null);
  assert.equal(tradeHistoryLink('디에이치퍼스티어아이파크'), null);
  assert.equal(tradeHistoryLink('래미안슈르'), '?view=trade-history&complex=gwacheon_raemian_sur');
});

test('preview history trusts only the configured tagged origin and exact revision', async () => {
  const pin = 'r20261125084348_907cfe39';
  const preview = { origin: 'https://preview---k-housing-example.a.run.app', revision: pin };
  const exactService = createTradeHistoryService(async input => {
    assert.equal(new URL(String(input)).origin, preview.origin);
    return Response.json(snapshot([row()], { revision: pin }));
  }, preview);
  assert.equal((await exactService(q))?.revision, pin);

  const staleService = createTradeHistoryService(async () =>
    Response.json(snapshot([row()], { revision: 'r20261125000000' })), preview);
  await assert.rejects(staleService(q), /KH_UNEXPECTED_PREVIEW_REVISION/);
});
