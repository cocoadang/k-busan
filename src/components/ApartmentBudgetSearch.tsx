import { RaemianSurFloorPlans, hasInlineFloorPlans } from './RaemianSurFloorPlans';
import floorPlans from '../housing/largeApartmentFloorPlans.json';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import ApartmentRadar, { ApartmentRadarPreview } from './ApartmentRadar';
import catalog from '../housing/songApartmentCatalog.json';

type Listing = (typeof catalog.apartments)[number] & { area: number; price: number; date: string; floor: number; areaCategory: string; tradeSummary?: { count: number; min: number; max: number } };
type PriceFeed = { results: Listing[]; incomplete: boolean; stale?: boolean; checkedAt: string; marketTrends?: { region: string; month: string; index: number; monthlyChange: number | null }[] };
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
const formatPrice = (price: number) => {
  const eok = Math.floor(price / 10000);
  const remainder = price % 10000;
  return [eok ? `${eok}억` : '', remainder ? `${remainder.toLocaleString('ko-KR')}만` : ''].filter(Boolean).join(' ') + ' 원';
};

const livingAreas: Record<string, readonly [string, string]> = {
  '경기 과천시/원문동': ['과천 원문·별양', '정부과천청사역'],
  '경기 안양시 동안구/관양동': ['평촌', '평촌역'],
  '경기 의왕시/포일동': ['인덕원', '인덕원역'],
  '경기 광명시/철산동': ['철산', '철산역'],
  '서울 송파구/문정동': ['문정', '문정역'],
  '서울 송파구/가락동': ['가락', '경찰병원역'],
  '서울 광진구/광장동': ['광장', '강변역·광나루역'],
  '서울 강동구/고덕동': ['고덕', '고덕역'],
  '서울 동대문구/청량리동': ['청량리', '청량리역'],
  '서울 강남구/대치동': ['대치', '대치역'],
  '서울 성북구/길음동': ['길음', '길음역'],
  '서울 관악구/봉천동': ['봉천', '서울대입구역'],
};

// Approximate neighborhood reference points, not apartment entrances or boundaries.
const neighborhoodPoints: Record<string, L.LatLngTuple> = {
  '경기 과천시/원문동': [37.423, 126.991],
  '경기 안양시 동안구/관양동': [37.396, 126.965],
  '경기 의왕시/포일동': [37.388, 126.981],
  '경기 광명시/철산동': [37.477, 126.871],
  '서울 송파구/문정동': [37.488, 127.124],
  '서울 송파구/가락동': [37.499, 127.125],
  '서울 광진구/광장동': [37.542, 127.100],
  '서울 강동구/고덕동': [37.556, 127.153],
  '서울 동대문구/청량리동': [37.585, 127.048],
  '서울 강남구/대치동': [37.494, 127.062],
  '서울 성북구/길음동': [37.609, 127.024],
  '서울 관악구/봉천동': [37.482, 126.953],
};

type NeighborhoodPin = { key: string; name: string; count: number; position: L.LatLngTuple };

function NeighborhoodMap({ pins, onPick }: { pins: NeighborhoodPin[]; onPick: (key: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || !pins.length) return;
    const map = L.map(container.current, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.fitBounds(L.latLngBounds(pins.map(pin => pin.position)), { padding: [40, 40], maxZoom: 14 });
    for (const pin of pins) {
      const icon = L.divIcon({
        className: '',
        html: `<span class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-700 text-xs font-bold text-white shadow-lg">${pin.count}</span>`,
        iconSize: [32, 32],
      });
      const label = document.createElement('span');
      label.textContent = `${pin.name} · 단지 ${pin.count}곳`;
      L.marker(pin.position, { icon, title: label.textContent, alt: label.textContent })
        .bindTooltip(label)
        .on('click', () => onPick(pin.key))
        .addTo(map);
    }
    return () => { map.remove(); };
  }, [pins, onPick]);
  if (!pins.length) return null;
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div ref={container} role="region" aria-label="검색된 생활권 지도" className="relative isolate h-72 bg-slate-100 lg:h-[28rem]" />
      <figcaption className="px-3 py-2 text-xs text-slate-600">핀은 생활권의 대략적인 위치이며, 숫자는 조건에 맞는 단지 수입니다.</figcaption>
    </figure>
  );
}

function groupBy<K>(listings: Listing[], key: (listing: Listing) => K) {
  const groups = new Map<K, Listing[]>();
  for (const listing of listings) {
    const id = key(listing);
    const group = groups.get(id);
    if (group) group.push(listing);
    else groups.set(id, [listing]);
  }
  return groups;
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
  const [budget, setBudget] = useState('');
  const [minimum, setMinimum] = useState('');
  const [view, setView] = useState<'neighborhood' | 'apartments'>('neighborhood');
  const [selected, setSelected] = useState<Listing[]>([]);
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

  const neighborhoods = [...groupBy(matches, apt => `${apt.district}/${apt.neighborhood}`)];
  const pins = neighborhoods.flatMap(([key, listings]) => {
    const position = neighborhoodPoints[key];
    if (!position) return [];
    const name = livingAreas[key]?.[0] ?? listings[0].neighborhood;
    return [{ key, name, count: new Set(listings.map(apt => apt.name)).size, position }];
  });
  const neighborhoodCards = useRef(new Map<string, HTMLDetailsElement>());

  function openNeighborhood(key: string) {
    const details = neighborhoodCards.current.get(key);
    if (!details) return;
    details.open = true;
    details.querySelector('summary')?.focus({ preventScroll: true });
    details.scrollIntoView({ block: 'nearest' });
  }

  const [rangeError, setRangeError] = useState(false);
  const listingKey = (apt: Listing) => `${apt.name}:${apt.areaCategory}`;
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Math.round(Number(budget) * 10000);
    if (!Number.isSafeInteger(amount) || amount <= 0 || loading) return;
    const lower = Math.round(Number(minimum) * 10000);
    const invalid = !Number.isSafeInteger(lower) || lower < 0 || lower > amount;
    setRangeError(invalid);
    if (invalid) return;
    setSelected([]);
    setView('neighborhood');
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

  function renderCards(listings: Listing[], grouped = false) {
    return (
      <div className={`mt-4 grid gap-4 ${grouped ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {listings.map((apt) => {
            const planName = apt.name === '대치 은마' ? '은마' : apt.name === '래미안슈르' ? '과천래미안슈르' : apt.name;
            const plan = (floorPlans as Record<string, { url: string; source: string } | null>)[planName];
            const checked = selected.some(a => listingKey(a) === listingKey(apt));
            const unavailable = !checked && (selected.length >= 3 || selected.some(a => a.areaCategory !== apt.areaCategory || a.name === apt.name));
            return <article key={listingKey(apt)} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-600">{apt.district} {apt.neighborhood} · 전용 {apt.area}㎡</p>
            <h3 className="mt-1 text-xl font-bold">{apt.name}</h3>
            <p className="mt-3 text-lg font-bold text-blue-800">{formatPrice(apt.price)}</p>
            <p className="text-sm text-slate-600">{apt.date} 계약 · {apt.floor}층</p>
            <ApartmentRadarPreview name={apt.name} />
            <dl className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
              <div><dt className="font-semibold text-slate-900">작가가 분석한 내용</dt><dd>{apt.note}</dd></div>
              <div><dt className="font-semibold text-slate-900">내 조건에 맞는 이유</dt><dd>{query?.size ? '선택 전용면적 · ' : ''}{query?.minimum ? '입력 가격대 내 신고 거래' : '예산 이내 신고 거래'}{matchEvidence(apt) ? ` · ${matchEvidence(apt)}` : ''}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-3 text-sm font-semibold text-blue-800">
              <button type="button" disabled={unavailable} aria-pressed={checked} className="underline disabled:opacity-40" onClick={() => setSelected(current => checked ? current.filter(a => listingKey(a) !== listingKey(apt)) : [...current, apt])}>{checked ? '비교에서 빼기' : '비교에 추가'}</button>
              {plan && !hasInlineFloorPlans(apt.name, apt.areaCategory) && <a className="underline" href={plan.url} target="_blank" rel="noreferrer">평면도 원본</a>}
              <a className="underline" href={videoUrl(apt.videoId, apt.time)} target="_blank" rel="noreferrer">입지 분석 영상</a>
            </div>
            {hasInlineFloorPlans(apt.name, apt.areaCategory) && <RaemianSurFloorPlans name={apt.name} area={apt.areaCategory} />}
          </article>;
          })}
        </div>
    );
  }

  return (
    <section aria-labelledby="budget-title">
      <div className="rounded-3xl bg-slate-900 px-5 py-10 text-white sm:px-12 sm:py-14">
        <p className="mb-3 text-sm font-semibold text-sky-300">아파트 예산 검색</p>
        <h1 id="budget-title" className="text-3xl font-bold tracking-tight sm:text-5xl">내 예산으로 어디에 살 수 있을까?</h1>
        <p className="mt-4 max-w-xl text-base text-slate-200">송희구 작가가 입지를 분석한 단지에서 매매 예산에 맞는 후보를 찾아보세요.</p>
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
        {loading && <p role="status">저장된 실거래 자료에서 후보를 불러오고 있습니다.</p>}
        {failed && <p role="status">현재 국토교통부 거래 정보를 조회할 수 없습니다. 잠시 후 다시 검색해 주세요.</p>}
        {feed?.stale && <p role="status">최신 조회가 지연된 일부 계약월은 서버에 저장된 마지막 정상 자료를 표시합니다.</p>}
        {feed?.incomplete && <p role="status">일부 지역의 거래를 조회하지 못했습니다. 조회된 지역의 후보를 표시합니다.</p>}
        {feed && <>
        <h2 className="text-xl font-bold">{query.minimum ? `${formatPrice(query.minimum)}~${formatPrice(query.budget)}` : `${formatPrice(query.budget)} 이하`} 후보 {new Set(matches.map(apt => apt.name)).size}곳</h2>
        <p className="mt-1 text-sm text-slate-600">{['전체 지역', query.size ? `전용 ${query.size}㎡대` : '전체 면적', query.priority === 'budget' ? priorities.budget : `${priorities[query.priority]} 관련 영상 근거 우선`].join(' · ')}. 현재 매물이나 호가는 별도로 확인해야 합니다.</p>
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
        {matches.length > 0 && <>
          <div role="group" aria-label="검색 결과 보기" className="mt-4 inline-flex gap-1 rounded-lg bg-slate-200 p-1">
            {([['neighborhood', '동네별 보기'], ['apartments', '단지 바로 보기']] as const).map(([mode, label]) => (
              <button type="button" key={mode} aria-pressed={view === mode}
                className={view === mode ? 'rounded-md bg-white px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm' : 'rounded-md px-3 py-2 text-sm text-slate-700'}
                onClick={() => setView(mode)}>{label}</button>
            ))}
          </div>
          {view === 'apartments' ? renderCards(matches) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-600">면적대별 가격은 검색 조건에 맞는 단지의 최신 신고 거래 기준입니다.</p>
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <NeighborhoodMap pins={pins} onPick={openNeighborhood} />
              <div className="min-w-0 space-y-3">
              {neighborhoods.map(([key, listings]) => {
                const { district, neighborhood } = listings[0];
                const area = livingAreas[key]?.[0] ?? neighborhood;
                const stations = livingAreas[key]?.[1];
                const count = new Set(listings.map(apt => apt.name)).size;
                const sizeGroups = [...groupBy(listings, apt => apt.areaCategory)].sort(([a], [b]) => Number(a) - Number(b));
                return (
                  <details key={key} ref={element => { if (element) neighborhoodCards.current.set(key, element); else neighborhoodCards.current.delete(key); }} className="rounded-xl border border-slate-200 bg-white p-4">
                    <summary className="cursor-pointer text-slate-900">
                      <span className="font-bold">{area} 생활권</span>
                      <span className="ml-2 text-sm font-semibold text-blue-800">단지 {count}곳</span>
                      <span className="mt-1 block text-sm text-slate-600">{district} {neighborhood}{stations ? ` · 주요 역 ${stations}` : ''}</span>
                      <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                        {sizeGroups.map(([size, candidates]) => {
                          const prices = candidates.map(apt => apt.price);
                          const low = Math.min(...prices);
                          const high = Math.max(...prices);
                          return <span key={size}>전용 {size}㎡대 · {low === high ? formatPrice(low) : `${formatPrice(low)}~${formatPrice(high)}`}</span>;
                        })}
                      </span>
                    </summary>
                    {renderCards(listings, true)}
                  </details>
                );
              })}
              </div>
              </div>
            </div>
          )}
        </>}
        </>}
      </div>}
    </section>
  );
}
