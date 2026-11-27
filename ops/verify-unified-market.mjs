import assert from 'node:assert/strict';

const [base, expectedRevision, fixtureMonth] = process.argv.slice(2);
const origin = new URL(base);
assert(origin.protocol === 'https:' && (origin.hostname === 'apt.dsoom.com' ||
  /^market-unified---busan-redevelopment-news-monitor-[a-z0-9-]+\.[a-z0-9.-]*run\.app$/.test(origin.hostname)),
  'Use the Apt domain or the tagged Apt revision');
assert(/^r\d{14}(?:_[a-f0-9]{8})?$/.test(expectedRevision), 'Pass the expected active DB revision');
assert(/^20\d{2}(0[1-9]|1[0-2])$/.test(fixtureMonth), 'Pass a known month with a 래미안슈르 59㎡ trade');

async function read(path, type) {
  const response = await fetch(new URL(path, origin), { redirect: 'error', signal: AbortSignal.timeout(25_000) });
  assert(response.ok, `${path} HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  assert(typeof type === 'string' ? contentType.startsWith(type) : type.test(contentType), `${path} invalid content type`);
  return response;
}
const json = async path => (await read(path, 'application/json')).json();

const page = await (await read('/market/?view=MAP', 'text/html')).text();
const entry = page.match(/src="(\/market\/assets\/[^"]+\.js)"/)?.[1];
assert(entry, 'Market page must load its own compiled bundle');
const bundleResponse = await read(entry, /^(?:application|text)\/javascript/);
const bundle = await bundleResponse.text();
assert(bundle.includes('/market/') && bundle.includes('지도·시세'), 'Market bundle must contain the integrated navigation');

const status = await json('/market/api/data-status');
assert.equal(status.revision, expectedRevision);
const config = await json('/market/api/config/maps');
assert(config.configured === true && typeof config.apiKey === 'string' && config.apiKey.length > 0, 'Maps configuration is missing');
const budget = await json('/api/housing/apartment-budget');
assert.equal(budget.revision, expectedRevision);
assert(budget.incomplete === false && budget.stale !== true && budget.results?.length > 0);

const complex = 'gwacheon_raemian_sur';
const family = 'raemian_sur_59';
const history = await json(`/api/housing/apartment-trade-history?complex=${complex}&family=${family}&start=${fixtureMonth}&end=${fixtureMonth}`);
assert.equal(history.revision, expectedRevision);
assert(history.source === 'K_HOUSING_SAVED_MOLIT' && history.rows?.length > 0);
const families = await json(`/market/api/complexes/${complex}/area-families`);
assert(JSON.stringify(families).includes(family), 'Complex price analysis lost the 59㎡ group');
const lineage = await json('/market/api/redevelopment/lineages/chokjin3_redevelopment');
assert(JSON.stringify(lineage).includes('chokjin3_redevelopment'), 'Redevelopment analysis is unavailable');

const plans = await json('/api/housing/floor-plans/raemian-sur');
assert(Array.isArray(plans) && plans.length > 0);
for (const plan of plans) {
  const image = new URL(plan.image, origin);
  assert.equal(image.origin, origin.origin);
  assert.equal(image.pathname, '/api/housing/floor-plans/raemian-sur');
  const response = await read(image.pathname + image.search, 'image/');
  const bytes = Buffer.from(await response.arrayBuffer());
  const mime = response.headers.get('content-type')?.split(';')[0];
  assert(bytes.length > 30 && (
    (mime === 'image/png' && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') ||
    (mime === 'image/jpeg' && bytes.subarray(0, 3).toString('hex') === 'ffd8ff') ||
    (mime === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
  ), 'Stored floor plan could not be decoded');
}
console.log(JSON.stringify({ revision: expectedRevision, recommendations: budget.results.length,
  fixtureTrades: history.rows.length, floorPlanImages: plans.length, mapsConfig: true }));
