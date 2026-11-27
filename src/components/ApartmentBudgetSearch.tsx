import { useState, type FormEvent } from 'react';
import catalog from '../housing/songApartmentCatalog.json';
import type { OfficialSalesSnapshot, RegionalApartmentCatalog, RegionalApartmentRow } from '../housing/collectedApartmentSearch';

type Complex = { id: string; name: string; alias: string; district: string; region?: string; units?: number; address?: string; directoryOnly?: boolean };
type Listing = { complexId: string; area: number; price: number; date: string; areaCategory: string };
type AptListing = Omit<Listing, 'complexId'> & { complexId?: string; name: string };
type SearchFeed = { complexes: Complex[]; results: Listing[]; unavailable: string[]; catalog: RegionalApartmentCatalog; officialSales?: OfficialSalesSnapshot; months: string[]; nativeDirectoryUnavailable?: boolean };
type AptFeed = { results: AptListing[]; incomplete: boolean; stale?: boolean };
type SearchQuery = { keyword: string; minimum: number; maximum: number; size: string; region: string };
const regionalAreas = ['서울', '과천', '분당', '구성남', '광명', '하남'] as const;
const pageSize = 24;
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const formatPrice = (price: number) => {
  const eok = Math.floor(price / 10000);
  const remainder = price % 10000;
  return [eok ? `${eok}억` : '', remainder ? `${remainder.toLocaleString('ko-KR')}만` : ''].filter(Boolean).join(' ') + ' 원';
};

async function fetchSearch<T>(path: string): Promise<T> {
  const response = await fetch(path, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw Error('SEARCH_DATA_UNAVAILABLE');
  return response.json() as Promise<T>;
}

function addRegionalDirectory(complexes: Map<string, Complex>, catalog: RegionalApartmentRow[]) {
  const byAddress = new Map<string, Complex[]>();
  for (const complex of complexes.values()) {
    const parts = complex.district.trim().split(/\s+/);
    const key = parts.slice(-2).join('/');
    const group = byAddress.get(key) ?? [];
    group.push(complex);
    byAddress.set(key, group);
  }
  const nameKey = (name: string, region: string) => {
    const key = normalize(name.split(' (')[0]).replace(/아파트$/, '');
    return region === '과천' ? key.replace(/^과천(?=래미안슈르$)/, '') : key;
  };
  const assigned = new Set<string>();
  const byCode = new Map<string, string>();
  for (const [code, region, , district, dong, name, units, , address] of catalog) {
    const localDistrict = district.split(' ').at(-1);
    const key = nameKey(name, region);
    const candidates = (byAddress.get(`${localDistrict}/${dong}`) ?? []).filter(complex =>
      !assigned.has(complex.id) && [complex.name, complex.alias].some(alias => nameKey(alias, region) === key),
    );
    const match = candidates.length === 1 ? candidates[0] : undefined;
    if (match) {
      assigned.add(match.id);
      byCode.set(code, match.id);
      complexes.set(match.id, { ...match, region, units, address });
    } else {
      const id = `kapt:${code}`;
      byCode.set(code, id);
      const province = region === '서울' ? '서울특별시' : '경기도';
      complexes.set(id, { id, name, alias: '', district: [province, district, dong].filter(Boolean).join(' '),
        region, units, address, directoryOnly: true });
    }
  }
  return byCode;
}

function findMatches(query: SearchQuery, shared: SearchFeed | null, apt: AptFeed | null) {
  const complexes = new Map((shared?.complexes ?? []).map(complex => [complex.id, complex]));
  const sharedNames = new Map([...complexes.values()].map(complex => [normalize(complex.alias || complex.name), complex.id]));
  const idsByName = new Map<string, string>();
  for (const entry of catalog.apartments) {
    const key = normalize(entry.name);
    const id = sharedNames.get(key) ?? `apt:${key}`;
    idsByName.set(key, id);
    if (!complexes.has(id)) {
      complexes.set(id, { id, name: entry.name, alias: entry.aliases.join(' '), district: `${entry.district} ${entry.neighborhood}` });
    }
  }

  const trades = new Map<string, Map<string, Listing>>();
  const put = (trade: Listing) => {
    const areas = trades.get(trade.complexId) ?? new Map<string, Listing>();
    const previous = areas.get(trade.areaCategory);
    if (!previous || previous.date < trade.date || (previous.date === trade.date && previous.price < trade.price)) {
      areas.set(trade.areaCategory, trade);
    }
    trades.set(trade.complexId, areas);
  };
  for (const trade of shared?.results ?? []) put(trade);
  for (const trade of apt?.results ?? []) {
    const id = trade.complexId && complexes.has(trade.complexId) ? trade.complexId : idsByName.get(normalize(trade.name));
    if (id) put({ ...trade, complexId: id });
  }

  const idsByCode = addRegionalDirectory(complexes, shared?.catalog.complexes ?? []);
  for (const [code, sales] of Object.entries(shared?.officialSales?.prices ?? {})) {
    const complexId = idsByCode.get(code);
    if (!complexId) continue;
    for (const [date, area, price] of sales) {
      if (shared?.months.includes(date.slice(0, 7).replace('-', ''))) {
        put({ complexId, date, area, price, areaCategory: String(Math.floor(area)) });
      }
    }
  }
  const budgetFilter = query.minimum > 0 || Number.isFinite(query.maximum);
  const terms = query.keyword.split(/\s+/).map(normalize).filter(Boolean);
  return [...complexes.values()].flatMap(complex => {
    if (query.region && complex.region !== query.region) return [];
    const searchable = normalize(`${complex.name} ${complex.alias} ${complex.district} ${complex.region ?? ''} ${complex.address ?? ''}`);
    if (!terms.every(term => searchable.includes(term))) return [];
    const listings = [...(trades.get(complex.id)?.values() ?? [])].filter(trade =>
      (!query.size || trade.areaCategory === query.size) && trade.price >= query.minimum && trade.price <= query.maximum,
    ).sort((first, second) => second.price - first.price);
    if (budgetFilter && !listings.length) return [];
    return [{ complex, listings, unavailable: shared?.unavailable.includes(complex.id) ?? false }];
  }).sort((first, second) => (budgetFilter ? (second.listings[0]?.price ?? 0) - (first.listings[0]?.price ?? 0) : 0)
    || first.complex.name.localeCompare(second.complex.name, 'ko'));
}

function PriceRange({ minimum, budget, onMinimum, onBudget }: {
  minimum: string; budget: string; onMinimum: (value: string) => void; onBudget: (value: string) => void;
}) {
  const upper = Math.max(50, Math.ceil(Math.max(Number(minimum), Number(budget)) / 10) * 10);
  const high = budget === '' ? upper : Number(budget);
  const low = Math.min(Number(minimum), high);
  const thumb = 'pointer-events-none absolute inset-x-0 top-0 m-0 h-8 w-full appearance-none bg-transparent focus-visible:outline-2 focus-visible:outline-blue-500 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-700 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-700';
  return (
    <fieldset className="col-span-full min-w-0 rounded-xl bg-slate-50 px-4 py-2">
      <legend className="text-sm font-semibold">매매가 범위</legend>
      <div className="relative h-8">
        <div className="absolute inset-x-2.5 top-3 h-2 rounded-full bg-slate-200" aria-hidden="true">
          <div className="absolute h-full rounded-full bg-blue-600" style={{ left: `${low / upper * 100}%`, right: `${(1 - high / upper) * 100}%` }} />
        </div>
        <input type="range" aria-label="최소 매매가 범위 (억 원)" min={0} max={upper} step="0.1" value={low}
          className={thumb} onChange={event => onMinimum(String(Math.min(Number(event.target.value), high)))} />
        <input type="range" aria-label="최대 매매가 범위 (억 원)" min={0} max={upper} step="0.1" value={high}
          className={thumb} onChange={event => onBudget(String(Math.max(Number(event.target.value), Number(minimum), 0.1)))} />
      </div>
      <div className="flex justify-between text-xs text-slate-600" aria-hidden="true"><span>0억 원</span><span>{upper}억 원</span></div>
    </fieldset>
  );
}

export default function ApartmentBudgetSearch() {
  const [keyword, setKeyword] = useState('');
  const [budget, setBudget] = useState('');
  const [minimum, setMinimum] = useState('');
  const [size, setSize] = useState('');
  const [region, setRegion] = useState('');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState<SearchQuery | null>(null);
  const [shared, setShared] = useState<SearchFeed | null>(null);
  const [apt, setApt] = useState<AptFeed | null>(null);
  const [checkedAt, setCheckedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rangeError, setRangeError] = useState(false);
  const matches = query ? findMatches(query, shared, apt) : [];
  const pageCount = Math.ceil(matches.length / pageSize);
  const shown = matches.slice((page - 1) * pageSize, page * pageSize);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const maximum = budget === '' ? Infinity : Math.round(Number(budget) * 10000);
    const lower = Math.round(Number(minimum) * 10000);
    const invalid = (budget !== '' && (!Number.isSafeInteger(maximum) || maximum <= 0))
      || !Number.isSafeInteger(lower) || lower < 0 || lower > maximum;
    setRangeError(invalid);
    if (invalid) return;
    setPage(1);
    setQuery({ keyword: keyword.trim(), minimum: lower, maximum, size, region });
    if (shared && apt && !apt.incomplete && !apt.stale && Date.now() - checkedAt < 60_000) return;
    setLoading(true);
    const [housing, recommendations] = await Promise.allSettled([
      fetchSearch<SearchFeed>('/api/housing/collected-apartments'),
      fetchSearch<AptFeed>('/api/housing/apartment-budget'),
    ]);
    setShared(housing.status === 'fulfilled' ? housing.value : null);
    setApt(recommendations.status === 'fulfilled' ? recommendations.value : null);
    setCheckedAt(Date.now());
    setLoading(false);
  }

  return (
    <section aria-labelledby="budget-title">
      <div className="rounded-3xl bg-slate-900 px-5 py-10 text-white sm:px-12 sm:py-14">
        <h1 id="budget-title" className="text-3xl font-bold tracking-tight sm:text-5xl">아파트 검색</h1>
        <p className="mt-3 text-sm text-slate-300">단지명, 지역, 예산으로 검색합니다. 1,000세대 이상 단지를 지역별로 볼 수 있습니다.</p>
        <form onSubmit={search} className="mt-8 grid gap-3 rounded-2xl bg-white p-4 text-slate-900 sm:grid-cols-2 lg:grid-cols-5 sm:items-end">
          <label className="grid gap-1 text-sm font-semibold">단지명 또는 지역
            <input className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" value={keyword}
              onChange={event => setKeyword(event.target.value)} placeholder="예: 과천자이, 잠실, 부산" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">1,000세대 이상 지역
            <select className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" value={region} onChange={event => setRegion(event.target.value)}>
              <option value="">전체 단지</option>
              {regionalAreas.map(area => <option key={area} value={area}>{area}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">최소 매매가 (억 원)
            <input className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" type="number" min="0" step="0.0001"
              placeholder="선택" value={minimum} onChange={event => { setMinimum(event.target.value); setRangeError(false); }} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">최대 매매가 (억 원)
            <input className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" type="number" min="0.0001" step="0.0001"
              placeholder="선택" value={budget} onChange={event => { setBudget(event.target.value); setRangeError(false); }} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">전용면적
            <select className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" value={size} onChange={event => setSize(event.target.value)}>
              <option value="">전체 면적</option><option value="59">59㎡대</option><option value="84">84㎡대</option>
            </select>
          </label>
          <PriceRange minimum={minimum} budget={budget} onMinimum={value => { setMinimum(value); setRangeError(false); }}
            onBudget={value => { setBudget(value); setRangeError(false); }} />
          {rangeError && <p role="alert" className="text-sm text-red-700 sm:col-span-full">최소 매매가를 최대 매매가 이하로 입력하세요.</p>}
          <button type="submit" disabled={loading} className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">아파트 찾기</button>
        </form>
      </div>
      {query && <div className="mt-6" aria-live="polite">
        {loading ? <p role="status">저장된 단지와 실거래를 불러오고 있습니다.</p> : (
          <section aria-labelledby="apartment-search-results" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 id="apartment-search-results" className="text-lg font-bold">검색 결과 <span className="text-sm font-normal text-slate-600">{matches.length}개 단지</span></h2>
            <p className="mt-1 text-xs text-slate-600">최근 3개 계약월의 저장 실거래가 연결된 단지에 예산 조건을 적용합니다. {shared && `대단지 ${shared.catalog.complexes.length}곳 · K-apt ${shared.catalog.asOf} 기준`}{shared?.officialSales && ` · 국토부 공개 자료 ${shared.officialSales.through} 기준`}</p>
            {!shared && <p role="status" className="mt-2 text-sm text-slate-700">K-Housing 단지 목록을 불러오지 못했습니다. 잠시 후 다시 검색해 주세요.</p>}
            {(!apt || apt.incomplete || apt.stale || Boolean(shared?.unavailable.length) || shared?.nativeDirectoryUnavailable) &&
              <p role="status" className="mt-2 text-sm text-slate-700">일부 단지의 최신 실거래를 확인할 수 없습니다. 확인된 거래만 검색 결과에 표시합니다.</p>}
            {matches.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map(({ complex, listings, unavailable }) => (
                <li key={complex.id} className="min-w-0 rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">{complex.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{complex.district}{complex.units && ` · ${complex.units.toLocaleString('ko-KR')}세대`}</p>
                  {listings.length ? <ul className="mt-3 divide-y divide-slate-100 text-sm">
                    {listings.map(trade => <li key={trade.areaCategory} className="flex flex-wrap items-baseline justify-between gap-x-2 py-1.5 tabular-nums">
                      <span>{trade.area}㎡</span>
                      <span><strong>{formatPrice(trade.price)}</strong> <time dateTime={trade.date} className="ml-1 text-xs text-slate-600">{trade.date}</time></span>
                    </li>)}
                  </ul> : <p className="mt-3 text-sm text-slate-600">{complex.directoryOnly ? '실거래 자료 미연계' : unavailable ? '최근 저장 거래 확인 불가' : '선택한 면적의 최근 저장 거래 없음'}</p>}
                </li>
              ))}
            </ul> : <p className="mt-4 text-sm text-slate-700">조건에 맞는 단지 또는 신고 거래가 없습니다.</p>}
            {pageCount > 1 && <nav className="mt-5 flex items-center justify-center gap-4 text-sm" aria-label="검색 결과 페이지">
              <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}
                className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">이전</button>
              <span className="tabular-nums">{page} / {pageCount}</span>
              <button type="button" disabled={page === pageCount} onClick={() => setPage(page + 1)}
                className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">다음</button>
            </nav>}
          </section>
        )}
      </div>}
    </section>
  );
}
