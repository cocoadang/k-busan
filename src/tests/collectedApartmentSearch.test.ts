import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCollectedApartmentSearch } from '../housing/collectedApartmentSearch';

test('keeps registered complexes with unavailable trades and uses the latest active sale per area', async () => {
  const fetched: URL[] = [];
  const clock = () => Date.parse('2026-12-01T00:05:00+09:00');
  const request: typeof fetch = async input => {
    const url = new URL(String(input));
    fetched.push(url);
    if (url.pathname === '/api/apt/catalog/v1') {
      return Response.json({ revision: 'kapt-20261127-fc274fd1312b', asOf: '2026-11-27',
        complexes: [['A10024059', '과천', '41290', '과천시', '별양동', '과천자이아파트', 2099, '52-0', '']] });
    }
    if (url.pathname === '/api/map-summaries') {
      return Response.json({
        success: true, startYmd: '202612', endYmd: '202612', totalComplexes: 2,
        summaries: Object.fromEntries(['complex_one', 'complex_two'].map(id => [
          id, { complexId: id, complexName: id, shortName: id, province: 'region', district: 'district' },
        ])),
      });
    }
    assert.equal(url.searchParams.get('startYmd'), '202610');
    assert.equal(url.searchParams.get('endYmd'), '202612');
    assert.equal(url.searchParams.get('areaCategory'), 'ALL');
    if (url.pathname.endsWith('complex_two')) return Response.json({ success: false }, { status: 503 });
    const items = [
      { dealDate: '2026-10-01', price: 100000, isCancelled: false, activeCount: 1 },
      { dealDate: '2026-11-01', price: 120000, isCancelled: false, activeCount: 1 },
      { dealDate: '2026-12-01', price: 160000, isCancelled: true, activeCount: 0 },
    ].map(row => ({
      ...row, complexId: 'complex_one', exclusiveArea: 59.96, floor: 11,
      dealYmd: row.dealDate.slice(0, 7).replace('-', ''),
    }));
    return Response.json({ success: true, source: 'FIRESTORE', complexId: 'complex_one',
      startYmd: '202610', endYmd: '202612', areaCategory: 'ALL', totalCount: items.length, items });
  };
  const handle = createCollectedApartmentSearch(request, clock);
  async function search() {
    let payload: any;
    const res = {
      setHeader() {},
      status(code: number) { assert.fail('Unexpected status ' + code); },
      json(value: unknown) { payload = value; },
    };
    await handle({} as never, res as never, () => assert.fail('Unexpected next()'));
    return payload;
  }
  const [one, two] = await Promise.all([search(), search()]);
  assert.equal(fetched.length, 4);
  assert.equal(one.catalog.complexes[0][0], 'A10024059');
  assert.deepEqual(one, two);
  assert.deepEqual(one.complexes.map(({ id }: { id: string }) => id), ['complex_one', 'complex_two']);
  assert.deepEqual(one.unavailable, ['complex_two']);
  assert.deepEqual(one.results, [{ complexId: 'complex_one', area: 59.96, areaCategory: '59', date: '2026-11-01', price: 120000, floor: 11 }]);
});
