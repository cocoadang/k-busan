import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const revisionPattern = /^r\d{14}(?:_[a-f0-9]{8})?$/;
const monthPattern = /^20\d{2}(?:0[1-9]|1[0-2])$/;
const previewHostPattern = /^[a-z0-9-]+---[a-z0-9-]+\.[a-z0-9.-]*run\.app$/;
const imagePath = '/api/housing/floor-plans/raemian-sur';

function previewOrigin(value) {
  const url = new URL(value);
  assert(url.protocol === 'https:' && !url.username && !url.password &&
    !url.port && url.pathname === '/' && !url.search && !url.hash &&
    previewHostPattern.test(url.hostname), 'A tagged Cloud Run origin is required');
  return url.origin;
}

async function request(origin, path, label, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(new URL(path, origin), {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new Error(`${label} request failed`);
  }
  assert(response.ok, `${label} returned HTTP ${response.status}`);
  return response;
}

async function json(origin, path, label, fetchImpl) {
  const response = await request(origin, path, label, fetchImpl);
  assert(response.headers.get('content-type')?.startsWith('application/json'),
    `${label} returned an unexpected content type`);
  return response.json();
}

function isImage(header, mime) {
  if (mime === 'image/png') return header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (mime === 'image/jpeg') return header.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  if (mime === 'image/webp') {
    return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

export async function verifyPreview(config, fetchImpl = fetch) {
  const khousing = previewOrigin(config.khousingOrigin);
  const apt = previewOrigin(config.aptOrigin);
  assert(revisionPattern.test(config.expectedRevision), 'Invalid expected K-Housing revision');
  assert(monthPattern.test(config.historyMonth), 'Invalid history fixture month');

  const report = await json(khousing, '/api/apt/recommendation-sales/v1', 'K-Housing recommendations', fetchImpl);
  assert(report.schema === 1 && report.readMode === 'pinned' &&
    report.revision === config.expectedRevision, 'K-Housing recommendations did not prove the expected preview revision');
  assert(Number.isFinite(report.validUntil) && report.validUntil > Date.now() &&
    Array.isArray(report.results) && report.results.length > 0, 'Missing or stale K-Housing preview results');

  const budget = await json(apt, '/api/housing/apartment-budget', 'Apt recommendations', fetchImpl);
  assert(budget.revision === config.expectedRevision, 'Apt recommendations did not prove the expected preview revision');
  assert(budget.incomplete === false && budget.stale !== true &&
    Array.isArray(budget.results) && budget.results.length > 0, 'Apt recommendations returned incomplete or empty results');

  const params = new URLSearchParams({
    complex: 'gwacheon_raemian_sur',
    family: 'raemian_sur_59',
    start: config.historyMonth,
    end: config.historyMonth,
  });
  const history = await json(apt, '/api/housing/apartment-trade-history?' + params, 'Apt trade history', fetchImpl);
  assert(history.source === 'K_HOUSING_SAVED_MOLIT' && history.coverage === 'saved_snapshot_only' &&
    history.complex === params.get('complex') && history.family === params.get('family') &&
    history.start === config.historyMonth && history.end === config.historyMonth &&
    Array.isArray(history.rows) && history.rows.length > 0, 'Apt trade history fixture was not returned');
  assert(history.revision === config.expectedRevision,
    'Apt trade history did not prove the expected preview revision');

  const plans = await json(apt, imagePath, 'Apt floor plan index', fetchImpl);
  assert(Array.isArray(plans) && plans.length > 0, 'No stored floor plans for the fixture complex');
  for (const plan of plans) {
    const image = new URL(plan.image, apt);
    assert(image.origin === apt && image.pathname === imagePath && image.searchParams.get('image') &&
      !image.hash, 'Floor plan image must be served by the Apt preview');
    const response = await request(apt, image.pathname + image.search, 'Apt floor plan image', fetchImpl);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length > 30 && isImage(bytes, response.headers.get('content-type')?.split(';')[0]),
      'Invalid floor plan image response');
  }
  return {
    revision: config.expectedRevision,
    recommendationRows: report.results.length,
    budgetRows: budget.results.length,
    historyRows: history.rows.length,
    floorPlanImages: plans.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await verifyPreview({
      khousingOrigin: process.env.KHOUSING_PREVIEW_ORIGIN,
      aptOrigin: process.env.APT_PREVIEW_ORIGIN,
      expectedRevision: process.env.KHOUSING_EXPECTED_REVISION,
      historyMonth: process.env.KHOUSING_HISTORY_FIXTURE_MONTH,
    })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
