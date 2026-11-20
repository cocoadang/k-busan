const table = 'A_2024_00178';
const regions = [{ id: '500007', name: '서울' }, { id: '500002', name: '수도권' }];
export type MarketTrend = { region: string; month: string; index: number; monthlyChange: number | null };

export async function readRoneMarketTrends(now = new Date()): Promise<MarketTrend[]> {
  const korea = new Date(now.getTime() + 9 * 3600_000);
  const monthAt = (offset: number) => new Date(Date.UTC(korea.getUTCFullYear(), korea.getUTCMonth() - offset, 1)).toISOString().slice(0, 7).replace('-', '');
  const trends = await Promise.allSettled(regions.map(async region => {
    const url = new URL('https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do');
    url.search = new URLSearchParams({
      Type: 'json', STATBL_ID: table, DTACYCLE_CD: 'MM', CLS_ID: region.id, ITM_ID: '100001',
      START_WRTTIME: monthAt(4), END_WRTTIME: monthAt(0),
    }).toString();
    const key = process.env.RONE_API_KEY?.trim();
    if (key) url.searchParams.set('KEY', key);
    const response = await fetch(url, { signal: AbortSignal.timeout(4500), redirect: 'error' });
    if (!response.ok) return null;
    const data = await response.json();
    const series = data?.SttsApiTblData;
    if (!Array.isArray(series) || series[0]?.head?.[1]?.RESULT?.CODE !== 'INFO-000' || !Array.isArray(series[1]?.row)) return null;
    const rows = new Map<string, number>();
    for (const row of series[1].row) {
      if (row.STATBL_ID !== table || String(row.CLS_ID) !== region.id || String(row.ITM_ID) !== '100001' ||
          !/^\d{4}(0[1-9]|1[0-2])$/.test(row.WRTTIME_IDTFR_ID) || !Number.isFinite(row.DTA_VAL) || row.DTA_VAL <= 0) continue;
      rows.set(row.WRTTIME_IDTFR_ID, row.DTA_VAL);
    }
    const latest = [...rows.keys()].sort().at(-1);
    if (!latest) return null;
    const index = rows.get(latest)!;
    const previousMonth = new Date(Date.UTC(Number(latest.slice(0, 4)), Number(latest.slice(4)) - 2, 1)).toISOString().slice(0, 7).replace('-', '');
    const previous = rows.get(previousMonth);
    return { region: region.name, month: latest, index, monthlyChange: previous ? (index / previous - 1) * 100 : null };
  }));
  return trends.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
}
