import { useState, type FormEvent } from 'react';
import { locationGradeAxes, getApartmentLocationGrades } from './ApartmentRadar';

type Grades = ReturnType<typeof getApartmentLocationGrades>;
type Complex = { id: string; name: string; dong: string; district: string; region: string; homes: number; address: string; grades: Grades };
type Sale = [date: string, area: number, price: number, floor: number];
type SearchFeed = { asOf: string; through: string; directory: Complex[]; prices: Record<string, Sale[]>;
  confirmedDistrictMonths: number; expectedDistrictMonths: number };
type SearchQuery = { keyword: string; minimum: number; maximum: number; size: string; region: string };
const regionalAreas = ['서울', '과천', '분당', '구성남', '하남'] as const;
const pageSize = 24;
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const formatPrice = (price: number) => {
  const eok = Math.floor(price / 10000);
  const remainder = price % 10000;
  return [eok ? `${eok}억` : '', remainder ? `${remainder.toLocaleString('ko-KR')}만` : ''].filter(Boolean).join(' ') + ' 원';
};

function findMatches(query: SearchQuery, feed: SearchFeed | null) {
  if (!feed) return [];
  const terms = query.keyword.split(/\s+/).map(normalize).filter(Boolean);
  const budgetFilter = query.minimum > 0 || Number.isFinite(query.maximum);
  return feed.directory.flatMap(complex => {
    if (query.region && complex.region !== query.region) return [];
    if (!terms.every(term => normalize(complex.name + complex.district + complex.dong + complex.region + complex.address).includes(term))) return [];
    const byArea = new Map<string, Sale>();
    for (const sale of feed.prices[complex.id] ?? []) {
      const category = String(Math.floor(sale[1]));
      const prior = byArea.get(category);
      if (!prior || sale[0] > prior[0] || (sale[0] === prior[0] && sale[2] > prior[2])) byArea.set(category, sale);
    }
    const listings = [...byArea.entries()].filter(([category, sale]) =>
      (!query.size || category === query.size) && sale[2] >= query.minimum && sale[2] <= query.maximum,
    ).sort((a, b) => b[1][2] - a[1][2]);
    if (budgetFilter && !listings.length) return [];
    return [{ complex, listings }];
  }).sort((a, b) => (budgetFilter ? (b.listings[0]?.[1][2] ?? 0) - (a.listings[0]?.[1][2] ?? 0) : 0)
    || a.complex.name.localeCompare(b.complex.name, 'ko'));
}

function LocationRadar({ grades }: { grades: Grades }) {
  const point = (index: number, value: number) => {
    const radians = index * Math.PI / 3 - Math.PI / 2;
    return [70 + Math.cos(radians) * value * 10, 70 + Math.sin(radians) * value * 10];
  };
  const polygon = (value: number) => grades.map((_, index) => point(index, value).join(',')).join(' ');
  const measured = grades.map((metric, index) => metric.grade === null ? null : point(index, metric.grade));
  return <details className="mt-3 border-t border-slate-200 pt-2">
    <summary className="cursor-pointer text-sm font-semibold text-blue-800">브역대신평초 6각형</summary>
    <div className="mt-2 flex flex-wrap items-start gap-2">
      <svg viewBox="0 0 140 140" className="w-36 shrink-0 text-blue-700" aria-hidden="true">
        {[1, 2, 3, 4, 5].map(value => <polygon key={value} points={polygon(value)} fill="none" stroke="#cbd5e1" />)}
        {measured.every(Boolean) && <polygon points={measured.map(p => p?.join(',')).join(' ')} fill="#bfdbfe" fillOpacity="0.7" />}
        {measured.map((p, index) => {
          const [x, y] = point(index, 6);
          const next = measured[(index + 1) % measured.length];
          return <g key={locationGradeAxes[index][0]}>
            <text x={x} y={y} dominantBaseline="middle" textAnchor="middle" fontSize="10" fill="currentColor">{locationGradeAxes[index][0]}</text>
            {p && next && <line x1={p[0]} y1={p[1]} x2={next[0]} y2={next[1]} stroke="currentColor" strokeWidth="2" />}
            {p && <circle cx={p[0]} cy={p[1]} r="3" fill="currentColor" />}
          </g>;
        })}
      </svg>
      <dl className="min-w-36 flex-1 space-y-1 text-xs">
        {grades.map(({ grade, label, pending, source }, index) => <div key={locationGradeAxes[index][0]}>
          <dt className="inline font-semibold">{locationGradeAxes[index][1]} </dt>
          <dd className="inline">{grade === null ? '미확인' : grade + '/5'}
            {(label || pending) && <span className="block text-slate-600">{label || pending}{' '}
              {source && <a href={source} target="_blank" rel="noreferrer" className="underline">출처</a>}</span>}
          </dd>
        </div>)}
      </dl>
    </div>
  </details>;
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
  const [feed, setFeed] = useState<SearchFeed | null>(null);
  const [checkedAt, setCheckedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rangeError, setRangeError] = useState(false);
  const matches = query ? findMatches(query, feed) : [];
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
    if (feed && Date.now() - checkedAt < 60_000) return;
    setLoading(true);
    try {
      const response = await fetch('/api/apt/search', { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw Error('APT_SEARCH_UNAVAILABLE');
      setFeed(await response.json());
      setCheckedAt(Date.now());
    } catch {
      setFeed(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="budget-title">
      <div className="rounded-3xl bg-slate-900 px-5 py-10 text-white sm:px-12 sm:py-14">
        <h1 id="budget-title" className="text-3xl font-bold tracking-tight sm:text-5xl">아파트 검색</h1>
        <p className="mt-3 text-sm text-slate-300">단지명, 지역, 예산으로 검색합니다. 1,000세대 이상 단지를 지역별로 볼 수 있습니다.</p>
        <form onSubmit={search} className="mt-8 grid gap-3 rounded-2xl bg-white p-4 text-slate-900 sm:grid-cols-2 lg:grid-cols-5 sm:items-end">
          <label className="grid gap-1 text-sm font-semibold">단지명 또는 지역
            <input className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" value={keyword}
              onChange={event => setKeyword(event.target.value)} placeholder="예: 과천자이, 잠실, 위례" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">1,000세대 이상 지역
            <select className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" value={region} onChange={event => setRegion(event.target.value)}>
              <option value="">전체 지역</option>
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
            {feed ? <p className="mt-1 text-xs text-slate-600">
              K-apt {feed.asOf} 기준 {feed.directory.length}곳 · 국토부 공개 자료 {feed.through} 기준
              {feed.confirmedDistrictMonths < feed.expectedDistrictMonths && ' · 일부 최근 거래의 API 갱신 대기 중'}
            </p> : <p role="alert" className="mt-2 text-sm text-red-700">Apt 검색 데이터를 불러오지 못했습니다. 잠시 후 다시 검색해 주세요.</p>}
            {matches.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map(({ complex, listings }) => (
                <li key={complex.id} className="min-w-0 rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">{complex.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{complex.district} {complex.dong} · {complex.homes.toLocaleString('ko-KR')}세대</p>
                  {listings.length ? <ul className="mt-3 divide-y divide-slate-100 text-sm">
                    {listings.map(([category, [date, area, price]]) => <li key={category} className="flex flex-wrap items-baseline justify-between gap-x-2 py-1.5 tabular-nums">
                      <span>{area}㎡</span>
                      <span><strong>{formatPrice(price)}</strong> <time dateTime={date} className="ml-1 text-xs text-slate-600">{date}</time></span>
                    </li>)}
                  </ul> : <p className="mt-3 text-sm text-slate-600">표시할 최근 저장 거래가 없습니다.</p>}
                  <LocationRadar grades={complex.grades} />
                </li>
              ))}
            </ul> : feed && <p className="mt-4 text-sm text-slate-700">조건에 맞는 단지 또는 신고 거래가 없습니다.</p>}
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
