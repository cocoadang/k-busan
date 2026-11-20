import { useState, type FormEvent } from 'react';

import catalog from '../housing/songApartmentCatalog.json';

type Listing = (typeof catalog.apartments)[number] & { area: number; price: number; date: string; floor: number; areaCategory: string };
type PriceFeed = { results: Listing[]; incomplete: boolean; checkedAt: string };
const districts = [...new Set(catalog.apartments.map(({ district }) => district))].sort();
const formatPrice = (price: number) => {
  const eok = Math.floor(price / 10000);
  const remainder = price % 10000;
  return [eok ? `${eok}억` : '', remainder ? `${remainder.toLocaleString('ko-KR')}만` : ''].filter(Boolean).join(' ') + ' 원';
};

export default function ApartmentBudgetSearch() {
  const [budget, setBudget] = useState('');
  const [district, setDistrict] = useState('');
  const [size, setSize] = useState('');
  const [query, setQuery] = useState<{ budget: number; district: string; size: string } | null>(null);
  const [feed, setFeed] = useState<PriceFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const matches = query ? (feed?.results ?? []).filter((apt) =>
    apt.price <= query.budget &&
    (!query.district || apt.district === query.district) &&
    (!query.size || apt.areaCategory === query.size)
  ).sort((first, second) => second.price - first.price) : [];

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Math.round(Number(budget) * 10000);
    if (!Number.isSafeInteger(amount) || amount <= 0 || loading) return;
    setQuery({ budget: amount, district, size });
    setLoading(true);
    setFailed(false);
    setFeed(null);
    try {
      const response = await fetch('/api/housing/apartment-budget', { signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error('PRICE_UNAVAILABLE');
      setFeed(await response.json() as PriceFeed);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="budget-title">
      <div className="rounded-3xl bg-slate-900 px-5 py-10 text-white sm:px-12 sm:py-14">
        <p className="mb-3 text-sm font-semibold text-sky-300">아파트 예산 검색</p>
        <h1 id="budget-title" className="text-3xl font-bold tracking-tight sm:text-5xl">내 예산으로 어디에 살 수 있을까?</h1>
        <p className="mt-4 max-w-xl text-base text-slate-200">송희구 작가가 입지를 분석한 단지에서 매매 예산에 맞는 후보를 찾아보세요.</p>
        <form onSubmit={search} className="mt-8 grid gap-3 rounded-2xl bg-white p-4 text-slate-900 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-semibold">매매 예산 (억 원)
            <input className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" type="number" min="0.0001" step="0.0001" required placeholder="예: 19" value={budget} onChange={(event) => setBudget(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">지역
            <select className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" value={district} onChange={(event) => setDistrict(event.target.value)}>
              <option value="">전체 지역</option>
              {districts.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">전용면적
            <select className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" value={size} onChange={(event) => setSize(event.target.value)}>
              <option value="">전체 면적</option><option value="59">59㎡대</option><option value="84">84㎡대</option>
            </select>
          </label>
          <button type="submit" disabled={loading} className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">아파트 찾기</button>
        </form>
        <p className="mt-4 text-sm text-slate-300">영상 자막 검토 {catalog.reviewedVideoIds.length}편 · 분석 단지 {catalog.apartments.length}곳 · 최근 3개 계약월의 국토교통부 신고 거래 기준</p>
      </div>
      {query && <div className="mt-6" aria-live="polite">
        {loading && <p role="status">국토교통부 신고 거래를 확인하고 있습니다.</p>}
        {failed && <p role="status">현재 국토교통부 거래 정보를 조회할 수 없습니다. 잠시 후 다시 검색해 주세요.</p>}
        {feed?.incomplete && <p role="status">일부 지역의 거래를 조회하지 못했습니다. 조회된 지역의 후보를 표시합니다.</p>}
        {feed && <>
        <h2 className="text-xl font-bold">{formatPrice(query.budget)} 이하 후보 {matches.length}곳</h2>
        <p className="mt-1 text-sm text-slate-600">{[query.district || '전체 지역', query.size ? `전용 ${query.size}㎡대` : '전체 면적', '예산에 가까운 순'].join(' · ')}. 현재 매물이나 호가는 별도로 확인해야 합니다.</p>
        {matches.length === 0 && <p className="mt-4 rounded-xl bg-white p-5 text-slate-700">조회된 신고 거래에서 조건에 맞는 단지를 찾지 못했습니다. 지역이나 전용면적을 넓혀보세요.</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((apt) => <article key={apt.name + apt.areaCategory} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-600">{apt.district} · 전용 {apt.area}㎡</p>
            <h3 className="mt-1 text-xl font-bold">{apt.name}</h3>
            <p className="mt-3 text-lg font-bold text-blue-800">{formatPrice(apt.price)}</p>
            <p className="text-sm text-slate-600">{apt.date} 계약 · {apt.floor}층</p>
            <p className="mt-4 flex-1 text-base text-slate-700">{apt.note}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-3 text-sm font-semibold text-blue-800">
              <a className="underline" href={`https://www.youtube.com/watch?v=${apt.videoId}&t=${apt.time}s`} target="_blank" rel="noreferrer">입지 분석 영상</a>
              <a className="underline" href="https://rt.molit.go.kr/" target="_blank" rel="noreferrer">신고 거래 확인</a>
            </div>
          </article>)}
        </div>
        </>}
      </div>}
    </section>
  );
}
