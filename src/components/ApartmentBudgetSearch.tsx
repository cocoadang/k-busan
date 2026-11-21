import { useState, type FormEvent } from 'react';

import ApartmentRadar, { ApartmentRadarPreview } from './ApartmentRadar';
import catalog from '../housing/songApartmentCatalog.json';

type Listing = (typeof catalog.apartments)[number] & { area: number; price: number; date: string; floor: number; areaCategory: string; tradeSummary?: { count: number; min: number; max: number } };
type PriceFeed = { results: Listing[]; incomplete: boolean; checkedAt: string; marketTrends?: { region: string; month: string; index: number; monthlyChange: number | null }[] };
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
const principles = [
  { title: '같은 생활권의 대안을 비교', note: '호가가 예산을 넘으면 생활권과 주거 여건이 비슷한 단지를 살펴봅니다.', links: [{ id: 'XZF4lUnY1GY', time: 78 }] },
  { title: '교통·학군·거주 여건을 함께 확인', note: '역 접근성, 학원가, 주차처럼 실제 거주에 영향을 주는 조건을 비교합니다.', links: [{ id: 'TL_WqYQsUJw', time: 33 }, { id: '9f7SKimLzQA', time: 62 }] },
  { title: '리모델링 비용과 일정을 함께 검토', note: '매매가와 함께 예상 추가분담금, 이주·공사 일정을 확인합니다.', links: [{ id: '9f7SKimLzQA', time: 137 }, { id: 'iwO_jSjdRaI', time: 190 }] },
];
const videoUrl = (id: string, time: number) => `https://www.youtube.com/watch?v=${id}&t=${time}s`;
const districts = [...new Set(catalog.apartments.map(({ district }) => district))].sort();
const formatPrice = (price: number) => {
  const eok = Math.floor(price / 10000);
  const remainder = price % 10000;
  return [eok ? `${eok}억` : '', remainder ? `${remainder.toLocaleString('ko-KR')}만` : ''].filter(Boolean).join(' ') + ' 원';
};

export default function ApartmentBudgetSearch() {
  const [budget, setBudget] = useState('');
  const [minimum, setMinimum] = useState('');
  const [selected, setSelected] = useState<Listing[]>([]);
  const [district, setDistrict] = useState('');
  const [size, setSize] = useState('');
  const [priority, setPriority] = useState<Priority>('budget');
  const [query, setQuery] = useState<{ budget: number; minimum: number; district: string; size: string; priority: Priority } | null>(null);
  const [feed, setFeed] = useState<PriceFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const matchEvidence = (apt: Listing) => query && query.priority !== 'budget' ? strengths[apt.name]?.[query.priority] : undefined;
  const matches = query ? (feed?.results ?? []).filter((apt) =>
    apt.price >= query.minimum && apt.price <= query.budget &&
    (!query.district || apt.district === query.district) &&
    (!query.size || apt.areaCategory === query.size)
  ).sort((first, second) => Number(Boolean(matchEvidence(second))) - Number(Boolean(matchEvidence(first))) || second.price - first.price) : [];

  const [rangeError, setRangeError] = useState(false);
  const listingKey = (apt: Listing) => `${apt.name}:${apt.areaCategory}`;
  function compareNearby(anchor: Listing) {
    const closest = new Map<string, Listing>();
    for (const candidate of matches.filter(apt => apt.name !== anchor.name && apt.district === anchor.district && apt.areaCategory === anchor.areaCategory)
      .sort((a, b) => Number(b.neighborhood === anchor.neighborhood) - Number(a.neighborhood === anchor.neighborhood) ||
        Math.abs(a.price - anchor.price) - Math.abs(b.price - anchor.price))) {
      if (!closest.has(candidate.name)) closest.set(candidate.name, candidate);
    }
    setSelected([anchor, ...[...closest.values()].slice(0, 2)]);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Math.round(Number(budget) * 10000);
    if (!Number.isSafeInteger(amount) || amount <= 0 || loading) return;
    const lower = Math.round(Number(minimum) * 10000);
    const invalid = !Number.isSafeInteger(lower) || lower < 0 || lower > amount;
    setRangeError(invalid);
    if (invalid) return;
    setSelected([]);
    setQuery({ budget: amount, minimum: lower, district, size, priority });
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
        <form onSubmit={search} className="mt-8 grid gap-3 rounded-2xl bg-white p-4 text-slate-900 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 sm:items-end">
          <label className="grid gap-1 text-sm font-semibold">최대 매매가 (억 원)
            <input className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" type="number" min="0.0001" step="0.0001" required placeholder="예: 19" value={budget} onChange={(event) => setBudget(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">최소 매매가 (억 원)
            <input className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" type="number" min="0" step="0.0001" placeholder="선택" value={minimum} onChange={event => { setMinimum(event.target.value); setRangeError(false); }} />
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
          <label className="grid gap-1 text-sm font-semibold">우선 조건
            <select className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-base" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {(Object.keys(priorities) as Priority[]).map(key => <option key={key} value={key}>{priorities[key]}</option>)}
            </select>
          </label>
          <button type="submit" disabled={loading} className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">아파트 찾기</button>
          {rangeError && <p role="alert" className="text-sm text-red-700 sm:col-span-full">최소 매매가를 최대 매매가 이하로 입력하세요.</p>}
        </form>
        <p className="mt-4 text-sm text-slate-300">영상 자막 검토 {catalog.reviewedVideoIds.length}편 · 분석 단지 {catalog.apartments.length}곳 · 최근 3개 계약월의 국토교통부 신고 거래 기준</p>
      </div>
      <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer font-semibold">검토한 영상에서 정리한 투자 판단 기준</summary>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {principles.map(principle => <li key={principle.title}>
            <h3 className="font-semibold">{principle.title}</h3>
            <p className="text-sm text-slate-700">{principle.note}</p>
            {principle.links.map(({ id, time }, index) => <a key={id} className="mr-3 text-sm text-blue-800 underline" href={videoUrl(id, time)} target="_blank" rel="noreferrer">근거 영상{principle.links.length > 1 ? ` ${index + 1}` : ''}</a>)}
          </li>)}
        </ul>
      </details>
      {query && <div className="mt-6" aria-live="polite">
        {loading && <p role="status">국토교통부 신고 거래를 확인하고 있습니다.</p>}
        {failed && <p role="status">현재 국토교통부 거래 정보를 조회할 수 없습니다. 잠시 후 다시 검색해 주세요.</p>}
        {feed?.incomplete && <p role="status">일부 지역의 거래를 조회하지 못했습니다. 조회된 지역의 후보를 표시합니다.</p>}
        {feed && <>
        <h2 className="text-xl font-bold">{query.minimum ? `${formatPrice(query.minimum)}~${formatPrice(query.budget)}` : `${formatPrice(query.budget)} 이하`} 후보 {new Set(matches.map(apt => apt.name)).size}곳</h2>
        <p className="mt-1 text-sm text-slate-600">{[query.district || '전체 지역', query.size ? `전용 ${query.size}㎡대` : '전체 면적', query.priority === 'budget' ? priorities.budget : `${priorities[query.priority]} 관련 영상 근거 우선`].join(' · ')}. 현재 매물이나 호가는 별도로 확인해야 합니다.</p>
        {!!feed.marketTrends?.length && <aside aria-label="지역 아파트 매매가격지수" className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <a className="font-semibold text-blue-800 underline" href="https://www.reb.or.kr/r-one/" target="_blank" rel="noreferrer">한국부동산원 R-ONE · 월간 아파트 매매가격지수</a>
            {feed.marketTrends.map(({ region, month, index, monthlyChange }) => <span key={region}>
              {region} {index.toFixed(2)} ({month.slice(0, 4)}.{month.slice(4)}{monthlyChange === null ? '' : ` · 전월 대비 ${monthlyChange >= 0 ? '+' : ''}${monthlyChange.toFixed(2)}%`})
            </span>)}
          </div>
        </aside>}
        {matches.length === 0 && <p className="mt-4 rounded-xl bg-white p-5 text-slate-700">조회된 신고 거래에서 조건에 맞는 단지를 찾지 못했습니다. 지역이나 전용면적을 넓혀보세요.</p>}
        {selected.length > 0 && <section aria-label="선택 단지 비교" className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold">전용 {selected[0].areaCategory}㎡대 단지 비교 ({selected.length}/3)</h3>
            <button type="button" onClick={() => setSelected([])} className="text-sm text-blue-800 underline">비교 초기화</button>
          </div>
          <p className="mt-1 text-sm text-slate-600">비슷한 후보는 같은 시·군·구와 면적대에서 같은 법정동, 가격 차이 순으로 찾습니다.</p>
          {selected.length === 1 && <p className="mt-1 text-sm text-slate-600">아래 결과에서 같은 면적대의 단지를 추가해 비교할 수 있습니다.</p>}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead><tr><th scope="col" className="p-2">비교 항목</th>{selected.map(apt => <th scope="col" className="p-2" key={listingKey(apt)}>{apt.name} <button type="button" className="text-xs text-blue-800 underline" aria-label={`${apt.name} 비교에서 빼기`} onClick={() => setSelected(current => current.filter(a => a.name !== apt.name))}>빼기</button></th>)}</tr></thead>
              <tbody>
                {([
                  ['위치·전용면적', (apt: Listing) => `${apt.district} ${apt.neighborhood} · ${apt.area}㎡`],
                  ['최신 신고 거래', (apt: Listing) => `${formatPrice(apt.price)} · ${apt.date} · ${apt.floor}층`],
                  ['최근 3개 계약월 조회 범위', (apt: Listing) => apt.tradeSummary ? `${formatPrice(apt.tradeSummary.min)} ~ ${formatPrice(apt.tradeSummary.max)} (${apt.tradeSummary.count}건)` : '범위·건수 미확인'],
                  ['영상 분석', (apt: Listing) => <a className="text-blue-800 underline" href={videoUrl(apt.videoId, apt.time)} target="_blank" rel="noreferrer">{apt.note}</a>],
                ] as const).map(([label, value]) => <tr className="border-t border-slate-200" key={label}>
                  <th scope="row" className="p-2 font-semibold">{label}</th>
                  {selected.map(apt => <td key={listingKey(apt)} className="p-2 align-top">{value(apt)}</td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
          <ApartmentRadar names={selected.map(apt => apt.name)} />
        </section>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((apt) => {
            const checked = selected.some(a => listingKey(a) === listingKey(apt));
            const unavailable = !checked && (selected.length >= 3 || selected.some(a => a.areaCategory !== apt.areaCategory || a.name === apt.name));
            return <article key={listingKey(apt)} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-600">{apt.district} · 전용 {apt.area}㎡</p>
            <h3 className="mt-1 text-xl font-bold">{apt.name}</h3>
            <p className="mt-3 text-lg font-bold text-blue-800">{formatPrice(apt.price)}</p>
            <p className="text-sm text-slate-600">{apt.date} 계약 · {apt.floor}층</p>
            <ApartmentRadarPreview name={apt.name} />
            <dl className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
              <div><dt className="font-semibold text-slate-900">작가가 분석한 내용</dt><dd>{apt.note}</dd></div>
              <div><dt className="font-semibold text-slate-900">내 조건에 맞는 이유</dt><dd>{query.district ? '선택 지역 · ' : ''}{query.size ? '선택 전용면적 · ' : ''}{query.minimum ? '입력 가격대 내 신고 거래' : '예산 이내 신고 거래'}{matchEvidence(apt) ? ` · ${matchEvidence(apt)}` : ''}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-3 text-sm font-semibold text-blue-800">
              <button type="button" disabled={unavailable} aria-pressed={checked} className="underline disabled:opacity-40" onClick={() => setSelected(current => checked ? current.filter(a => listingKey(a) !== listingKey(apt)) : [...current, apt])}>{checked ? '비교에서 빼기' : '비교에 추가'}</button>
              {matches.some(a => a.name !== apt.name && a.district === apt.district && a.areaCategory === apt.areaCategory) && <button type="button" className="underline" onClick={() => compareNearby(apt)}>비슷한 후보 비교</button>}
              <a className="underline" href={videoUrl(apt.videoId, apt.time)} target="_blank" rel="noreferrer">입지 분석 영상</a>
              <a className="underline" href="https://rt.molit.go.kr/" target="_blank" rel="noreferrer">신고 거래 확인</a>
            </div>
          </article>;
          })}
        </div>
        </>}
      </div>}
    </section>
  );
}
