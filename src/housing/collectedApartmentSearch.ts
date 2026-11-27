import type { RequestHandler } from 'express';
import { tradeHistoryOrigin } from './apartmentTradeHistory';

const complexIdPattern = /^[a-z][a-z0-9_]{1,95}$/;
const refreshMs = 5 * 60_000;

type Complex = { id: string; name: string; alias: string; district: string };
type Listing = { complexId: string; area: number; areaCategory: string; date: string; price: number; floor: number };
type TradeResult = { listings: Listing[]; unavailable: boolean };
type Feed = { complexes: Complex[]; results: Listing[]; unavailable: string[]; months: string[] };

function monthsInKorea(now: number) {
  const kst = new Date(now + 9 * 3_600_000);
  return [2, 1, 0].map(offset =>
    new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - offset, 1)).toISOString().slice(0, 7).replace('-', ''),
  );
}

function distinctLatest(items: unknown[], id: string, start: string, end: string): Listing[] {
  const latest = new Map<string, Listing>();
  for (const value of items) {
    const row = value as Record<string, unknown>;
    if (!row || row.complexId !== id || typeof row.isCancelled !== 'boolean' ||
        !Number.isSafeInteger(row.activeCount) || Number(row.activeCount) < 0) {
      throw Error('INVALID_COLLECTED_TRADE');
    }
    if (row.isCancelled || row.activeCount === 0) continue;
    const { exclusiveArea: area, dealDate: date, price, floor } = row;
    if (typeof date !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(date) ||
        row.dealYmd !== date.slice(0, 7).replace('-', '') ||
        typeof row.dealYmd !== 'string' || row.dealYmd < start || row.dealYmd > end ||
        typeof area !== 'number' || !Number.isFinite(area) || area <= 0 ||
        typeof price !== 'number' || !Number.isSafeInteger(price) || price <= 0 ||
        typeof floor !== 'number' || !Number.isSafeInteger(floor)) throw Error('INVALID_COLLECTED_TRADE');
    const areaCategory = String(Math.floor(area));
    const previous = latest.get(areaCategory);
    if (!previous || date > previous.date || (date === previous.date && price > previous.price)) {
      latest.set(areaCategory, { complexId: id, area, areaCategory, date, price, floor });
    }
  }
  return [...latest.values()];
}

export function createCollectedApartmentSearch(request: typeof fetch = fetch, now = Date.now) {
  let cache: { month: string; until: number; promise: Promise<Feed> } | undefined;

  async function get(path: string, query: Record<string, string>) {
    const url = new URL(path, tradeHistoryOrigin);
    url.search = new URLSearchParams(query).toString();
    const response = await request(url, {
      headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8_000),
    });
    if (response.status !== 200 && response.status !== 503) throw Error('KHOUSING_READ_FAILED');
    const data = await response.json();
    return { ok: response.ok, data };
  }

  async function readTrades(complex: Complex, start: string, end: string): Promise<TradeResult> {
    try {
      const { ok, data } = await get('/api/complex-trades/' + complex.id, {
        startYmd: start, endYmd: end, areaCategory: 'ALL', fetchAll: 'true',
      });
      if (!ok || data?.success !== true || data.source !== 'FIRESTORE' || data.complexId !== complex.id ||
          data.startYmd !== start || data.endYmd !== end || data.areaCategory !== 'ALL' ||
          !Array.isArray(data.items) || data.items.length !== data.totalCount || data.items.length > 3_000) {
        throw Error('KHOUSING_TRADE_FEED_UNAVAILABLE');
      }
      return { listings: distinctLatest(data.items, complex.id, start, end), unavailable: false };
    } catch {
      return { listings: [], unavailable: true };
    }
  }

  async function read(months: string[]): Promise<Feed> {
    const [start, , end] = months;
    const { ok, data } = await get('/api/map-summaries', { areaCategory: '59', startYmd: end, endYmd: end });
    if (!ok || data?.success !== true || data.startYmd !== end || data.endYmd !== end ||
        !data.summaries || typeof data.summaries !== 'object' || Array.isArray(data.summaries)) {
      throw Error('KHOUSING_DIRECTORY_UNAVAILABLE');
    }
    const entries = Object.entries(data.summaries);
    if (!entries.length || entries.length !== data.totalComplexes || entries.length > 150) {
      throw Error('KHOUSING_DIRECTORY_UNAVAILABLE');
    }
    const complexes = entries.map(([id, value]): Complex => {
      const row = value as Record<string, unknown>;
      if (!row || row.complexId !== id || !complexIdPattern.test(id) ||
          typeof row.complexName !== 'string' || !row.complexName.trim() ||
          typeof row.province !== 'string' || typeof row.district !== 'string') throw Error('INVALID_COLLECTED_COMPLEX');
      return { id, name: row.complexName, alias: typeof row.shortName === 'string' ? row.shortName : '',
        district: [row.province, row.district].join(' ') };
    });
    // Bound concurrent reads and reuse the same request for concurrent searches.
    const results: Listing[] = [];
    const unavailable: string[] = [];
    for (let offset = 0; offset < complexes.length; offset += 10) {
      const batch = complexes.slice(offset, offset + 10);
      const trades = await Promise.all(batch.map(complex => readTrades(complex, start, end)));
      trades.forEach(({ listings, unavailable: failed }, index) => {
        results.push(...listings);
        if (failed) unavailable.push(batch[index].id);
      });
    }
    return { complexes, results, unavailable, months };
  }

  const handle: RequestHandler = async (_req, res) => {
    const at = now();
    const months = monthsInKorea(at);
    const month = months[2];
    if (!cache || cache.month !== month || cache.until <= at) {
      const promise = read(months);
      cache = { month, promise, until: Number.POSITIVE_INFINITY };
      void promise.then(() => {
        if (cache?.promise === promise) cache.until = now() + refreshMs;
      }, () => {
        if (cache?.promise === promise) cache = undefined;
      });
    }
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await cache.promise);
    } catch {
      res.status(503).json({ error: 'KHOUSING_DIRECTORY_UNAVAILABLE' });
    }
  };
  return handle;
}
