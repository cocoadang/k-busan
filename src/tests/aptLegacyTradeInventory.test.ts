import assert from 'node:assert/strict';
import test from 'node:test';
import { inventoryLegacyTrades, recentMonths } from '../../ops/apt_legacy_trade_inventory.ts';

test('cross-year recent contract months are correct; invalid month rejected', () => {
  assert.deepEqual(recentMonths('202701'), ['202611', '202612', '202701']);
  assert.throws(() => recentMonths('202613'), /INVALID_MONTH/);
});

test('read only catalog month docs and one fallback; missing and zero differ; preserve duplicates and cancellations', async () => {
  const requests: string[] = [];
  const now = Date.parse('2026-11-23T00:00:00Z');
  const trade = { umdNm: '원문동', aptNm: '래미안슈르', cdealDay: '', cdealType: '', dealAmount: 'SECRET-ROW-PAYLOAD' };
  const report = await inventoryLegacyTrades(async (collection, id) => {
    requests.push(collection + '/' + id);
    if (collection === 'apartment_trade_fallback') return { fetchedAt: 0, results: [trade] };
    if (id === '41290_202611') return { fetchedAt: now, rows: [trade, trade, { ...trade, cdealType: 'O' }, {}] };
    if (id === '41290_202610') return { fetchedAt: now, rows: [] };
    if (id === '41290_202609') throw new Error('private auth details');
    if (id === '11710_202611') return { fetchedAt: now + 1, rows: [] };
    return undefined;
  }, '202611', now);
  assert.equal(requests.length, 37);
  assert.equal(new Set(requests).size, 37);
  assert.equal(report.complexCount, 18);
  assert.equal(report.eligibleForCutover, false);
  assert.equal(report.buckets.find(bucket => bucket.district === '41290' && bucket.month === '202609')?.status, 'unreadable');
  assert.equal(report.buckets.find(bucket => bucket.district === '41290' && bucket.month === '202610')?.rows, 0);
  const populated = report.buckets.find(bucket => bucket.district === '41290' && bucket.month === '202611')!;
  assert.equal(populated.status, 'present_fresh');
  assert.deepEqual(populated.complexes?.find(apt => apt.name === '래미안슈르'), { name: '래미안슈르', rows: 3, cancelled: 1, multiIdentity: 0 });
  assert.equal(populated.unknown, 1);
  assert.equal(report.buckets.find(bucket => bucket.district === '11710' && bucket.month === '202611')?.status, 'invalid');
  assert.equal(report.buckets.find(bucket => bucket.district === '11710' && bucket.month === '202609')?.status, 'missing');
  assert.deepEqual(report.surFallback, { status: 'present_stale', rows: 1 });
  assert.doesNotMatch(JSON.stringify(report), /SECRET-ROW|private auth details/);
});
