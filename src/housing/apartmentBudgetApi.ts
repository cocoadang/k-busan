import type { RequestHandler } from 'express';
import { XMLParser } from 'fast-xml-parser';
import catalog from './songApartmentCatalog.json';

const endpoint = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';
const parser = new XMLParser({ parseTagValue: false });
const normalize = (value: unknown) => String(value ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
const pad = (value: unknown) => String(value).padStart(2, '0');
const regions = [...new Set(catalog.apartments.map(({ region }) => region))];
type Sale = { area: number; price: number; date: string; floor: number };
type Result = (typeof catalog.apartments)[number] & Sale & { areaCategory: '59' | '84' };
type ResponseData = { results: Result[]; incomplete: boolean; checkedAt: string };

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

async function loadPrices(): Promise<ResponseData> {
  const raw = process.env.MOLIT_API_KEY?.trim() || process.env.DATA_GO_KR_API_KEY?.trim();
  const key = raw ? decodeURIComponent(raw) : null;
  const now = new Date(Date.now() + 9 * 3600_000);
  const months = [0, 1, 2].map(offset => {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    return String(month.getUTCFullYear()) + pad(month.getUTCMonth() + 1);
  });
  const feeds = key ? await Promise.allSettled(regions.map(async region => {
    const data = await Promise.all(months.map(month => monthTrades(key, region, month)));
    return [region, data.flat()] as const;
  })) : [];
  const byRegion = new Map(feeds.flatMap(feed => feed.status === 'fulfilled' ? [feed.value] : []));
  const results = catalog.apartments.flatMap(apt => {
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
    return (['59', '84'] as const).flatMap(areaCategory => {
      const sale = rows.find(row => Math.floor(row.area) === Number(areaCategory));
      return sale ? [{ ...apt, ...sale, areaCategory }] : [];
    });
  });
  if (!byRegion.has('41290')) results.push(...await existingHousingPrices(months[2], months[0]));
  if (!byRegion.size && !results.length) throw new Error('MOLIT_UNAVAILABLE');
  return { results, incomplete: byRegion.size < regions.length, checkedAt: new Date().toISOString() };
}

export function createApartmentBudgetHandler(): RequestHandler {
  let cache: { until: number; request: Promise<ResponseData> } | undefined;
  return async (_req, res) => {
    if (!cache || cache.until <= Date.now()) {
      const request = loadPrices();
      cache = { request, until: Date.now() + 3600_000 };
      void request.then(data => {
        if (cache?.request === request && data.incomplete) cache.until = Date.now() + 60_000;
      }, () => {
        if (cache?.request === request) cache.until = Date.now() + 30_000;
      });
    }
    try {
      const data = await cache.request;
      res.setHeader('Cache-Control', data.incomplete ? 'no-store' : 'public, max-age=60, s-maxage=300');
      res.json(data);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({ error: 'MOLIT_UNAVAILABLE' });
    }
  };
}
