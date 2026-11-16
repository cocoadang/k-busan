import type { RequestHandler } from 'express';
import DATA from '../data/busanHousingMap.json';

export type PriceSummary = { complexId: string; hasData: boolean; hasTargetArea: boolean; price: number | null; month: string | null; trades: number | null };
export type BusanPrices = { areaCategory: '59' | '84'; fetchedAt: string; startYmd: string; endYmd: string; summaries: Record<string, PriceSummary> };
const TTL = 60 * 60_000;
const IDS = DATA.apartments.map(a => a.id);
export function createBusanPriceReader(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { expires: number; data?: BusanPrices; pending?: Promise<BusanPrices>; failed?: boolean }>();
  return async (area: '59' | '84'): Promise<BusanPrices> => {
    const date = new Date(now() + 9 * 3600_000);
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const endYmd = `${date.getUTCFullYear()}${month}`, startYmd = `${date.getUTCFullYear() - 5}${month}`;
    const key = area + endYmd, hit = cache.get(key);
    if (hit?.pending) return hit.pending;
    if (hit && hit.expires > now()) { if (hit.data) return hit.data; throw new Error('PRICE_UNAVAILABLE'); }
    const pending = (async () => {
      try {
        const url = new URL('https://k-housing-5he2zcaska-du.a.run.app/api/map-summaries');
        url.search = new URLSearchParams({ areaCategory: area, startYmd, endYmd }).toString();
        const response = await fetcher(url, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
        if (!response.ok) throw new Error('PRICE_UNAVAILABLE');
        const body = await response.json();
        if (body.success !== true || body.areaCategory !== area || body.startYmd !== startYmd || body.endYmd !== endYmd) throw new Error('INVALID_PRICE_RESPONSE');
        const summaries: Record<string, PriceSummary> = {};
        for (const id of IDS) {
          const s = body.summaries?.[id];
          if (!s || s.complexId !== id || typeof s.hasData !== 'boolean' || typeof s.hasTargetArea !== 'boolean') throw new Error('INVALID_PRICE_RESPONSE');
          const available = s.hasData && s.hasTargetArea;
          if (available && (!Number.isFinite(s.latestMonthlyMedianPrice) || s.latestMonthlyMedianPrice <= 0 || !/^\d{6}$/.test(s.latestPeriod || ''))) throw new Error('INVALID_PRICE_RESPONSE');
          summaries[id] = { complexId: id, hasData: s.hasData, hasTargetArea: s.hasTargetArea,
            price: available ? s.latestMonthlyMedianPrice : null, month: available ? s.latestPeriod : null,
            trades: available && Number.isInteger(s.transactionCount) && s.transactionCount >= 0 ? s.transactionCount : null };
        }
        const data: BusanPrices = { areaCategory: area, fetchedAt: new Date(now()).toISOString(), startYmd, endYmd, summaries };
        cache.set(key, { expires: now() + TTL, data }); return data;
      } catch { cache.set(key, { expires: now() + 30_000, failed: true }); throw new Error('PRICE_UNAVAILABLE'); }
    })();
    for (const oldKey of cache.keys()) if (!oldKey.endsWith(endYmd)) cache.delete(oldKey);
    cache.set(key, { expires: now() + TTL, pending });
    return pending;
  };
}
export function createBusanPriceHandler(reader = createBusanPriceReader()): RequestHandler {
  return async (req, res) => {
    const area = req.query.areaCategory ?? '84';
    if (area !== '59' && area !== '84') { res.status(400).json({ error: 'INVALID_AREA' }); return; }
    try { const data = await reader(area); res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300'); res.json(data); }
    catch { res.status(502).json({ error: 'PRICE_UNAVAILABLE' }); }
  };
}
