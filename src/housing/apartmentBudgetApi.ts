import { FirestoreService } from '../storage/firestoreService.ts';
import type { RequestHandler } from 'express';
import { XMLParser } from 'fast-xml-parser';
import { readRoneMarketTrends, type MarketTrend } from './roneMarketTrends.ts';
import catalog from './songApartmentCatalog.json';
import { canonicalApartmentIdentity, legacyApartmentTradeMode, readCanonicalApartmentTrades, runLegacyApartmentWriter, type ApartmentTradeMode } from './apartmentCanonicalReader';

const endpoint = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';
const parser = new XMLParser({ parseTagValue: false });
const normalize = (value: unknown) => String(value ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
const pad = (value: unknown) => String(value).padStart(2, '0');
const regions = [...new Set(catalog.apartments.map(({ region }) => region))];
type Sale = { area: number; price: number; date: string; floor: number };
type TradeSummary = { count: number; min: number; max: number };
type Result = (typeof catalog.apartments)[number] & Sale & { areaCategory: string; tradeSummary?: TradeSummary };
type ResponseData = { results: Result[]; marketTrends: MarketTrend[]; incomplete: boolean; stale?: boolean; checkedAt: string; observedAt?:string; validUntil?:number; revision?:string };

async function monthTrades(key: string, region: string, month: string) {
  const items: Record<string, string>[] = [];
  for (let page = 1; page <= 10; page++) {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({ serviceKey: key, LAWD_CD: region, DEAL_YMD: month, pageNo: String(page), numOfRows: '1000' }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) throw new Error('MOLIT_HTTP_ERROR');
    const data = parser.parse(await response.text()).response;
    const code = String(data?.header?.resultCode ?? '');
    const total = Number(data?.body?.totalCount);
    if (!['0', '00', '000'].includes(code) || !Number.isSafeInteger(total) || total < 0) throw new Error('MOLIT_INVALID_RESPONSE');
    const block = data.body?.items?.item;
    const batch = block ? [block].flat() : [];
    items.push(...batch);
    if (items.length >= total) return items;
    if (!batch.length) break;
  }
  throw new Error('MOLIT_INCOMPLETE_MONTH');
}

const storage = new FirestoreService();
const maxAge = 6 * 3600_000;
type StoredMonth = { rows: Record<string, string>[]; fetchedAt: number };
const acceptedNames = new Map(regions.map(region => [region, new Set(catalog.apartments
  .filter(apt => apt.region === region)
  .flatMap(apt => apt.aliases.map(alias => `${normalize(apt.neighborhood)}/${normalize(alias)}`)))]));
const pendingMonths = new Map<string, Promise<{ rows: StoredMonth['rows']; stale: boolean }>>();

function storedMonth(key: string | null, region: string, month: string, refreshAllowed: boolean) {
  const id = `${region}_${month}`;
  const active = refreshAllowed ? pendingMonths.get(id) : undefined;
  if (active) return active;
  const request = (async () => {
    const db = await storage.getClient().catch(() => null);
    const ref = db?.collection('apartment_trade_months_v1').doc(id);
    const saved = (await ref?.get().catch(() => undefined))?.data() as StoredMonth | undefined;
    if (saved && Date.now() - saved.fetchedAt < maxAge) return { rows: saved.rows, stale: false };
    if (!refreshAllowed) {
      if (!saved) throw new Error('TRADE_SNAPSHOT_MISSING');
      return { rows: saved.rows, stale: true };
    }
    const refresh = async () => {
      if (!key) throw new Error('MOLIT_KEY_UNAVAILABLE');
      const names = acceptedNames.get(region);
      const rows = (await monthTrades(key, region, month))
        .filter(row => names?.has(`${normalize(row.umdNm)}/${normalize(row.aptNm)}`))
        .map(row => Object.fromEntries(['umdNm', 'aptNm', 'cdealDay', 'cdealType', 'dealAmount', 'excluUseAr', 'floor', 'dealYear', 'dealMonth', 'dealDay']
          .map(field => [field, String(row[field] ?? '')])));
      if (ref) {
        const fetchedAt = Date.now();
        await ref.set({ rows, fetchedAt }).catch(() => console.warn('[housing] trade snapshot write failed', id));
      }
      return { rows, stale: false };
    };
    try {
      return await refresh();
    } catch (error) {
      if (!saved) throw error;
      return { rows: saved.rows, stale: true };
    }
  })().finally(() => { if (pendingMonths.get(id) === request) pendingMonths.delete(id); });
  if (refreshAllowed) pendingMonths.set(id, request);
  return request;
}

async function existingHousingPrices(startYmd: string, endYmd: string): Promise<Result[]> {
  const apt = catalog.apartments.find(item => item.region === '41290' && item.name === '래미안슈르');
  if (!apt) return [];
  const results = await Promise.allSettled((['59', '84'] as const).map(async areaCategory => {
    const url = new URL('https://k-housing-5he2zcaska-du.a.run.app/api/complex-trades/gwacheon_raemian_sur');
    url.search = new URLSearchParams({ areaCategory, startYmd, endYmd }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) return [];
    const body = await response.json();
    if (body.success !== true || body.complexId !== 'gwacheon_raemian_sur' || body.startYmd !== startYmd || body.endYmd !== endYmd || body.areaCategory !== areaCategory || !Array.isArray(body.items)) return [];
    const rows = body.items.filter(row =>
      row.complexId === body.complexId && row.dataSource === 'MOLIT_OPENAPI' && row.isCancelled === false &&
      Number.isSafeInteger(row.price) && row.price > 0 && Number.isFinite(row.exclusiveArea) &&
      Math.floor(row.exclusiveArea) === Number(areaCategory) && Number.isInteger(row.floor) && /^\d{4}-\d{2}-\d{2}$/.test(row.dealDate)
    ).sort((a, b) => b.dealDate.localeCompare(a.dealDate) || b.price - a.price);
    const row = rows[0];
    return row ? [{ ...apt, areaCategory, area: row.exclusiveArea, price: row.price, date: row.dealDate, floor: row.floor }] : [];
  }));
  return results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
}

function tradeMonths() {
  const now = new Date(Date.now() + 9 * 3600_000);
  return [0, 1, 2].map(offset => {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    return String(month.getUTCFullYear()) + pad(month.getUTCMonth() + 1);
  });
}

async function refreshGwacheonFallback(months = tradeMonths()) {
  const db = await storage.getClient();
  if (!db) return;
  const ref = db.collection('apartment_trade_fallback').doc(months[0]);
  const saved = (await ref.get()).data();
  if (saved?.results?.length === 2 && Date.now() - Number(saved.fetchedAt) < maxAge) return;
  const rows = await existingHousingPrices(months[2], months[0]);
  if (!rows.length) throw new Error('GWACHEON_FALLBACK_NO_VERIFIED_TRADES');
  await db.runTransaction(async transaction => {
    const snapshot = (await transaction.get(ref)).data();
  const byArea = new Map<string, Result>(((snapshot?.results as Result[] | undefined) ?? [])
    .map(row => [row.areaCategory, row]));
  for (const row of rows) byArea.set(row.areaCategory, row);
  transaction.set(ref, { results: [...byArea.values()], fetchedAt: rows.length === 2 ? Date.now() : 0 });
});
}

function summarizeTrades(apt: (typeof catalog.apartments)[number], rows: Sale[]): Result[] {
  const byArea = new Map<string, { latest: Sale; summary: TradeSummary }>();
  for (const sale of rows) {
    if (sale.area <= 0) continue;
    const areaCategory = String(Math.floor(sale.area));
    const group = byArea.get(areaCategory);
    if (!group) {
      byArea.set(areaCategory, { latest: sale, summary: { count: 1, min: sale.price, max: sale.price } });
    } else {
      group.summary.count++;
      group.summary.min = Math.min(group.summary.min, sale.price);
      group.summary.max = Math.max(group.summary.max, sale.price);
    }
  }
  return [...byArea].map(([areaCategory, { latest, summary }]) => ({ ...apt, ...latest, areaCategory, tradeSummary: summary }));
}

const canonicalIdentities = new Set(catalog.apartments.map(apt => canonicalApartmentIdentity(apt.region, apt.neighborhood, apt.name)));

async function loadCanonicalPrices(mode: Extract<ApartmentTradeMode, { kind: 'canonical' }>, months: readonly string[]): Promise<ResponseData> {
  if ('project' in mode) {
    const projected = await mode.project(months);
    if (projected.incomplete) throw Error('CANONICAL_TRADES_UNAVAILABLE');
    const results = projected.results.map(row => {
      const apt = catalog.apartments.find(apt => apt.region === row.region && apt.neighborhood === row.neighborhood && apt.name === row.name);
      if (!apt) throw Error('CANONICAL_TRADES_UNAVAILABLE');
      const { price, area, date, floor, areaCategory, tradeSummary } = row;
      return { ...apt, price, area, date, floor, areaCategory, tradeSummary };
    });
    return { results, marketTrends: await readRoneMarketTrends(), incomplete: false, checkedAt: projected.checkedAt, observedAt:projected.observedAt, validUntil:projected.validUntil, revision:projected.revision };
  }
  const scopes = regions.flatMap(district => months.map(month => ({ district, month })));
  const data = await readCanonicalApartmentTrades(mode, scopes, canonicalIdentities);
  const groups = new Map<string, Sale[]>();
  for (const { district, rows } of data.buckets) for (const row of rows) {
    if (row.cancelled) continue;
    const id = canonicalApartmentIdentity(district, row.neighborhood, row.complex);
    const sales = groups.get(id) ?? [];
    sales.push({ area: row.area, price: row.price, date: row.date, floor: row.floor });
    groups.set(id, sales);
  }
  const results = catalog.apartments.flatMap(apt => summarizeTrades(apt,
    (groups.get(canonicalApartmentIdentity(apt.region, apt.neighborhood, apt.name)) ?? [])
      .sort((a, b) => b.date.localeCompare(a.date) || b.price - a.price)));
  return { results, marketTrends: await readRoneMarketTrends(), incomplete: data.incomplete, checkedAt: data.checkedAt };
}

async function loadPrices(refresh = false): Promise<ResponseData> {
  const raw = process.env.MOLIT_API_KEY?.trim() || process.env.DATA_GO_KR_API_KEY?.trim();
  const key = raw ? decodeURIComponent(raw) : null;
  const months = tradeMonths();
  const marketTrends = readRoneMarketTrends();
  const feeds = await Promise.allSettled(regions.map(async region => {
    const data = await Promise.allSettled(months.map(month => storedMonth(key, region, month, refresh)));
    return {
      region,
      missingMonths: data.filter(month => month.status === 'rejected').length,
      stale: data.some(month => month.status === 'fulfilled' && month.value.stale),
      rows: data.flatMap(month => month.status === 'fulfilled' ? month.value.rows : []),
    };
  }));
  const received = feeds.flatMap(feed => feed.status === 'fulfilled' ? [feed.value] : []);
  const byRegion = new Map(received.filter(feed => feed.missingMonths < months.length).map(feed => [feed.region, feed.rows]));
  const incomplete = byRegion.size < regions.length || received.some(feed => feed.missingMonths > 0);
  const results = catalog.apartments.flatMap<Result>(apt => {
    const rows = (byRegion.get(apt.region) ?? []).flatMap(row => {
      if (normalize(row.umdNm) !== normalize(apt.neighborhood) || !apt.aliases.some(alias => normalize(alias) === normalize(row.aptNm))) return [];
      if (String(row.cdealDay ?? '').replace(/[-\s]/g, '') || String(row.cdealType ?? '').trim() === 'O') return [];
      const price = Number(String(row.dealAmount ?? '').replace(/,/g, ''));
      const area = Number(row.excluUseAr);
      const floor = Number(row.floor);
      const date = [row.dealYear, pad(row.dealMonth), pad(row.dealDay)].join('-');
      if (!Number.isSafeInteger(price) || price <= 0 || !Number.isFinite(area) || !Number.isInteger(floor) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
      return [{ price, area, date, floor }];
    }).sort((a, b) => b.date.localeCompare(a.date) || b.price - a.price);
    return summarizeTrades(apt, rows);
  });
  const hasRaemianSurArea = (areaCategory: string) => results.some(result =>
    result.region === '41290' && result.name === '래미안슈르' && result.areaCategory === areaCategory
  );
  if (['59', '84'].some(areaCategory => !hasRaemianSurArea(areaCategory))) {
    const db = await storage.getClient().catch(() => null);
    const ref = db?.collection('apartment_trade_fallback').doc(months[0]);
    if (refresh && ref) {
      await refreshGwacheonFallback(months).catch(error => console.warn('[housing] Gwacheon fallback refresh failed', error instanceof Error ? error.message : 'unknown'));
    }
    const saved = await ref?.get().catch(() => undefined);
    const fallback = (saved?.data()?.results as Result[] | undefined) ?? [];
    for (const result of fallback) {
      const month = result.date.slice(0, 7).replace('-', '');
      if (months.includes(month) && !hasRaemianSurArea(result.areaCategory)) results.push(result);
    }
  }
  if (!byRegion.size && !results.length) throw new Error('MOLIT_UNAVAILABLE');
  return { results, marketTrends: await marketTrends, incomplete, stale: received.some(feed => feed.stale), checkedAt: new Date().toISOString() };
}

async function refreshApartmentTrades() {
  const data = await loadPrices(true);
  return { count: data.results.length, incomplete: data.incomplete };
}

function createApartmentBudgetHandler(mode: ApartmentTradeMode): RequestHandler {
  let cache: { until: number; scopeKey: string; request: Promise<ResponseData> } | undefined;
  return async (_req, res) => {
    // A valid prior-month cache cannot answer the new KST rolling window.
    const months = mode.kind === 'canonical' ? tradeMonths() : [];
    const scopeKey = months.join(',');
    if (!cache || cache.scopeKey !== scopeKey || cache.until <= Date.now()) {
      const request = mode.kind === 'legacy' ? loadPrices() : loadCanonicalPrices(mode, months);
      cache = { request, scopeKey, until: Date.now() + 60_000 };
      void request.then(data => {
        if (cache?.request !== request) return;
        if (data.incomplete || data.stale) cache.until = Date.now() + 60_000;
        if (data.validUntil !== undefined) cache.until = Math.min(cache.until,data.validUntil);
      }, () => {
        if (cache?.request === request) cache.until = Date.now() + 30_000;
      });
    }
    try {
      const data = await cache.request;
      const {validUntil, ...payload} = data;
      if (validUntil !== undefined && Date.now() >= validUntil) throw Error('CANONICAL_TRADES_UNAVAILABLE');
      res.setHeader('Cache-Control', mode.kind === 'canonical' || data.incomplete ? 'no-store' : 'public, max-age=60, s-maxage=300');
      res.json(payload);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({ error: mode.kind === 'legacy' ? 'MOLIT_UNAVAILABLE' : 'CANONICAL_TRADES_UNAVAILABLE' });
    }
  };
}

export function createApartmentBudgetService(configuration: ApartmentTradeMode = legacyApartmentTradeMode) {
  const mode = Object.freeze({ ...configuration });
  return {
    handle: createApartmentBudgetHandler(mode),
    refreshTrades: () => runLegacyApartmentWriter(mode, refreshApartmentTrades),
    refreshGwacheonFallback: () => runLegacyApartmentWriter(mode, refreshGwacheonFallback),
  };
}
