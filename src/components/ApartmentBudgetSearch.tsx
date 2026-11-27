import { useState, type FormEvent } from 'react';
import { getApartmentLocationGrades, locationGradeAxes } from './ApartmentRadar';
import type catalog from '../housing/songApartmentCatalog.json';

type Listing = (typeof catalog.apartments)[number] & { area: number; price: number; date: string; floor: number; areaCategory: string };
type PriceFeed = { results: Listing[]; incomplete: boolean; stale?: boolean };
const priorities = { budget: '예산에 가까운 순', transit: '교통', schools: '학군', living: '주거환경' };
type Priority = keyof typeof priorities;
const strengths: Record<string, Partial<Record<Exclude<Priority, 'budget'>, string>>> = {
  '힐스테이트 e편한세상 문정': { schools: '학교 접근성을 장점으로 언급', living: '주변 주거환경을 장점으로 언급' },
  '가락쌍용1차': { schools: '학군을 가격과 함께 검토' },
  '래미안슈르': { living: '주차와 거주 여건을 장점으로 언급' },
  '광장현대3단지': { transit: '광나루·강변역 접근을 장점으로 언급', schools: '학원가 접근을 장점으로 언급' },
  '고덕 아이파크': { transit: '고덕역 접근을 장점으로 언급', schools: '학원가 접근을 장점으로 언급' },
  '대치 은마': { transit: '대치역·삼성역 접근을 장점으로 언급', schools: '대치동 학군을 장점으로 언급' },
};
const formatPrice = (price: number) => {
  const eok = Math.floor(price / 10000);
  const remainder = price % 10000;
  return [eok ? `${eok}억` : '', remainder ? `${remainder.toLocaleString('ko-KR')}만` : ''].filter(Boolean).join(' ') + ' 원';
};

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
  const [budget, setBudget] = useState('');
  const [minimum, setMinimum] = useState('');
  const [size, setSize] = useState('59');
  const [priority, setPriority] = useState<Priority>('budget');
  const [query, setQuery] = useState<{ budget: number; minimum: number; size: string; priority: Priority } | null>(null);
  const [feed, setFeed] = useState<PriceFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const matchEvidence = (apt: Listing) => query && query.priority !== 'budget' ? strengths[apt.name]?.[query.priority] : undefined;
  const matches = query ? (feed?.results ?? []).filter((apt) =>
    apt.price >= query.minimum && apt.price <= query.budget &&
    (!query.size || apt.areaCategory === query.size)
  ).sort((first, second) => Number(Boolean(matchEvidence(second))) - Number(Boolean(matchEvidence(first))) || second.price - first.price) : [];

  const [rangeError, setRangeError] = useState(false);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Math.round(Number(budget) * 10000);
    if (!Number.isSafeInteger(amount) || amount <= 0 || loading) return;
    const lower = Math.round(Number(minimum) * 10000);
    const invalid = !Number.isSafeInteger(lower) || lower < 0 || lower > amount;
    setRangeError(invalid);
    if (invalid) return;
    setQuery({ budget: amount, minimum: lower, size, priority });
    setLoading(true);
    setFailed(false);
    if (feed && !feed.incomplete && !feed.stale) {
      setLoading(false);
      return;
    }
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
        <form onSubmit={search} className="mt-8 grid gap-3 rounded-2xl bg-white p-4 text-slate-900 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
          <label className="grid gap-1 text-sm font-semibold">최대 매매가 (억 원)
            <input className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" type="number" min="0.0001" step="0.0001" required placeholder="예: 19" value={budget} onChange={(event) => setBudget(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">최소 매매가 (억 원)
            <input className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" type="number" min="0" step="0.0001" placeholder="선택" value={minimum} onChange={event => { setMinimum(event.target.value); setRangeError(false); }} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">전용면적
            <select className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" value={size} onChange={(event) => setSize(event.target.value)}>
              <option value="">전체 면적</option><option value="59">59㎡대</option><option value="84">84㎡대</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">우선 조건
            <select className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {(Object.keys(priorities) as Priority[]).map(key => <option key={key} value={key}>{priorities[key]}</option>)}
            </select>
          </label>
          <button type="submit" disabled={loading} className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">아파트 찾기</button>
          <PriceRange minimum={minimum} budget={budget} onMinimum={value => { setMinimum(value); setRangeError(false); }}
            onBudget={value => { setBudget(value); setRangeError(false); }} />
          {rangeError && <p role="alert" className="text-sm text-red-700 sm:col-span-full">최소 매매가를 최대 매매가 이하로 입력하세요.</p>}
        </form>
      </div>
      {query && <div className="mt-6" aria-live="polite">
        {loading && <p role="status">저장된 실거래 자료에서 후보를 불러오고 있습니다.</p>}
        {failed && <p role="status">저장된 실거래 자료를 불러오지 못했습니다. 잠시 후 다시 검색해 주세요.</p>}
        {feed?.stale && <p role="status">갱신이 지연되어 마지막으로 저장된 거래를 표시합니다.</p>}
        {feed?.incomplete && <p role="status">일부 지역의 거래 자료를 불러오지 못했습니다.</p>}
        {!loading && !failed && feed && (matches.length ? (
          <section aria-labelledby="location-grades" className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 id="location-grades" className="text-lg font-bold">입지 등급표</h2>
            <div className="mt-3 overflow-x-auto" role="region" aria-labelledby="location-grades" tabIndex={0}>
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="p-2">단지</th>
                    <th scope="col" className="p-2">전용면적</th>
                    <th scope="col" className="p-2">신고 거래가</th>
                    {locationGradeAxes.map(([key, label, rule]) =>
                      <th key={key} scope="col" title={rule} className="whitespace-nowrap p-2 text-center">{label}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {matches.map(apt => (
                    <tr key={`${apt.name}:${apt.areaCategory}`} className="border-t border-slate-200">
                      <th scope="row" className="p-2 font-semibold">{apt.name}</th>
                      <td className="whitespace-nowrap p-2">{apt.area}㎡</td>
                      <td className="whitespace-nowrap p-2 tabular-nums">{formatPrice(apt.price)}</td>
                      {getApartmentLocationGrades(apt.name).map(({ grade, label, pending, source }, index) => {
                        const score = grade === null ? '미확인' : `${grade}/5`;
                        const detail = [label, grade === null && pending].filter(Boolean).join(' · ');
                        return <td key={locationGradeAxes[index][0]} title={detail} className="whitespace-nowrap p-2 text-center tabular-nums">
                          {source ? <a className="text-blue-800 underline" href={source} target="_blank" rel="noreferrer"
                            aria-label={`${locationGradeAxes[index][1]} ${score} · ${detail}`}>{score}</a> : score}
                        </td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : <p className="rounded-xl bg-white p-5 text-slate-700">조건에 맞는 신고 거래가 없습니다.</p>)}
      </div>}
    </section>
  );
}
