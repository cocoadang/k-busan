import type { RequestHandler } from 'express';
import { kstContractMonth, tradeHistoryComplexes, tradeHistoryFirstMonth, tradeHistoryMaxMonths, tradeHistoryOrigin, type TradeHistoryResponse, type TradeHistoryRow } from './apartmentTradeHistory.ts';

const pageSize = 20;
const maxRows = 2000;
const maxBytes = 2_000_000;
const maxInFlight = 4;
const cacheTtl = 5 * 60_000;
const maxCacheKeys = 64;
const maxPage = Math.ceil(maxRows / pageSize);
const sourceCurrency = { source: 'K_HOUSING_SAVED_MOLIT', coverage: 'saved_snapshot_only' } as const;
type Query = { complex: string; district: string; family: string; start: string; end: string; page: number };
type Snapshot = { revision?: string; checkedAt: string; storedRows: number; cancelledRows: number; rows: TradeHistoryRow[] };
type UpstreamRequest = typeof fetch;
type Preview = { origin: string; revision: string };
const revisionPattern = /^r\d{14}(?:_[a-f0-9]{8})?$/;
const previewHostPattern = /^[a-z0-9-]+---k-housing-[a-z0-9-]+\.[a-z0-9.-]*run\.app$/;

function readPreview(env: NodeJS.ProcessEnv): Preview | undefined {
  const origin = env.APT_KHOUSING_PREVIEW_ORIGIN;
  const revision = env.APT_KHOUSING_PREVIEW_REVISION;
  if (origin === undefined && revision === undefined) return;
  const endpoint = new URL(origin ?? '');
  if (endpoint.protocol !== 'https:' || endpoint.origin !== origin ||
      !previewHostPattern.test(endpoint.hostname) || !revision || !revisionPattern.test(revision)) {
    throw Error('KH_PREVIEW_CONFIGURATION_INVALID');
  }
  return { origin, revision };
}
type RecordObject = Record<string, unknown>;

const obj = (x: unknown): x is RecordObject => !!x && typeof x === 'object' && !Array.isArray(x);
const monthPattern = /^\d{4}(0[1-9]|1[0-2])$/;
const monthNumber = (x: string) => Number(x.slice(0, 4)) * 12 + Number(x.slice(4));
export function parseTradeHistoryQuery(query: unknown, currentMonth = kstContractMonth()): Query | null {
  if (!obj(query) || Object.keys(query).some(k => !['complex', 'family', 'start', 'end', 'page'].includes(k))) return null;
  const { complex, family, start, end, page = '1' } = query;
  if (![complex, family, start, end, page].every(x => typeof x === 'string')) return null;
  const scope = tradeHistoryComplexes.find(c => c.id === complex);
  if (!scope || typeof family !== 'string' || !scope.families.some(f => f.id === family) ||
      typeof start !== 'string' || typeof end !== 'string' || !monthPattern.test(start) || !monthPattern.test(end) ||
      start < tradeHistoryFirstMonth || end > currentMonth || monthNumber(end) - monthNumber(start) >= tradeHistoryMaxMonths ||
      start > end || typeof page !== 'string' || !/^[1-9]\d{0,2}$/.test(page) || Number(page) > maxPage) return null;
  return { complex: scope.id, district: scope.district, family, start, end, page: Number(page) };
}

function dateInWindow(value: unknown, start: string, end: string): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const month = value.slice(0, 7).replace('-', '');
  const date = new Date(value + 'T00:00:00Z');
  return month >= start && month <= end && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function verifyTradeHistorySnapshot(value: unknown, query: Query, expectedRevision?: string): Snapshot {
  if (!obj(value) || value.success !== true || value.source !== 'FIRESTORE' || value.complexId !== query.complex ||
      value.lawdCd !== query.district || value.startYmd !== query.start || value.endYmd !== query.end ||
      value.hasMore !== false || value.nextCursor !== null || value.page !== 1 || !Array.isArray(value.items) ||
      !Number.isSafeInteger(value.totalCount) || value.totalCount !== value.items.length || value.items.length > maxRows) {
    throw new Error('KH_UNVERIFIED_SNAPSHOT');
  }
  if (expectedRevision !== undefined && value.revision !== expectedRevision) {
    throw Error('KH_UNEXPECTED_PREVIEW_REVISION');
  }
  const ids = new Set<string>();
  let cancelledRows = 0;
  const rows: { id: string; row: TradeHistoryRow }[] = [];
  for (const r of value.items as unknown[]) {
    if (!obj(r) || r.complexId !== query.complex || r.areaFamilyId !== query.family || r.dataSource !== 'MOLIT_OPENAPI' ||
        typeof r.id !== 'string' || !r.id || ids.has(r.id) || typeof r.isCancelled !== 'boolean' ||
        !dateInWindow(r.dealDate, query.start, query.end)) throw new Error('KH_UNVERIFIED_ROW');
    ids.add(r.id);
    if (r.isCancelled) cancelledRows++;
    if (typeof r.exclusiveArea !== 'number' || !Number.isFinite(r.exclusiveArea) || r.exclusiveArea <= 0 ||
        typeof r.price !== 'number' || !Number.isSafeInteger(r.price) || r.price <= 0 ||
        (r.isCancelled === false && (typeof r.activeCount !== 'number' || !Number.isSafeInteger(r.activeCount) || r.activeCount < 1)) ||
        typeof r.floor !== 'number' || !Number.isSafeInteger(r.floor)) throw new Error('KH_UNVERIFIED_ROW');
    rows.push({ id: r.id, row: { dealDate: r.dealDate, exactArea: r.exclusiveArea, amountManwon: r.price, floor: r.floor, cancelled: r.isCancelled } });
  }
  rows.sort((a, b) => b.row.dealDate.localeCompare(a.row.dealDate) || a.id.localeCompare(b.id));
  return { ...(expectedRevision ? { revision: expectedRevision } : {}), checkedAt: new Date().toISOString(), storedRows: value.items.length, cancelledRows, rows: rows.map(r => r.row) };
}

async function readSmallJson(response: Response) {
  if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('application/json') || !response.body)
    throw new Error('KH_UNAVAILABLE');
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('KH_TOO_LARGE');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let json = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) { void reader.cancel().catch(() => {}); throw new Error('KH_TOO_LARGE'); }
      json += decoder.decode(chunk.value, { stream: true });
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(json + decoder.decode()) as unknown;
}

export function createTradeHistoryService(request: UpstreamRequest = fetch, preview?: Preview) {
  const cache = new Map<string, { until: number; snapshot: Snapshot }>();
  const pending = new Map<string, Promise<Snapshot>>();
  return async (input: unknown): Promise<TradeHistoryResponse | null> => {
    const q = parseTradeHistoryQuery(input);
    if (!q) return null;
    const key = [q.complex, q.family, q.start, q.end].join(':');
    const cached = cache.get(key);
    let snapshot: Snapshot;
    if (cached && cached.until > Date.now()) {
      snapshot = cached.snapshot;
    } else {
      let load = pending.get(key);
      if (!load) {
        if (pending.size >= maxInFlight) throw new Error('KH_BUSY');
        const url = new URL('/api/complex-trades/' + q.complex, preview?.origin ?? tradeHistoryOrigin);
        url.search = new URLSearchParams({ areaFamilyId: q.family, startYmd: q.start, endYmd: q.end, fetchAll: 'true' }).toString();
        load = (async () => {
          const response = await request(url, {
            headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8000),
          });
          const verified = verifyTradeHistorySnapshot(await readSmallJson(response), q, preview?.revision);
          cache.delete(key);
          if (cache.size >= maxCacheKeys) cache.delete(cache.keys().next().value!);
          cache.set(key, { until: Date.now() + cacheTtl, snapshot: verified });
          return verified;
        })();
        pending.set(key, load);
        void load.finally(() => pending.delete(key)).catch(() => {});
      }
      snapshot = await load;
    }
    const totalPages = Math.max(1, Math.ceil(snapshot.rows.length / pageSize));
    if (q.page > totalPages) return null;
    const offset = (q.page - 1) * pageSize;
    return { ...sourceCurrency, ...(snapshot.revision ? { revision: snapshot.revision } : {}), checkedAt: snapshot.checkedAt, storedRows: snapshot.storedRows, activeRows: snapshot.rows.length - snapshot.cancelledRows,
      cancelledRows: snapshot.cancelledRows, complex: q.complex, family: q.family, start: q.start, end: q.end,
      page: q.page, totalPages, rows: snapshot.rows.slice(offset, offset + pageSize) };
  };
}

export function createApartmentTradeHistoryHandler(request: UpstreamRequest = fetch): RequestHandler {
  let load: ReturnType<typeof createTradeHistoryService> | undefined;
  try {
    load = createTradeHistoryService(request, readPreview(process.env));
  } catch {
    // A partial preview configuration cannot fall back to the live origin.
  }
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!load) throw Error('KH_PREVIEW_CONFIGURATION_INVALID');
      const data = await load(req.query);
      if (!data) { res.status(400).json({ error: 'TRADE_HISTORY_INVALID_SELECTION' }); return; }
      res.json(data);
    } catch {
      res.status(503).json({ error: 'TRADE_HISTORY_UNAVAILABLE' });
    }
  };
}
