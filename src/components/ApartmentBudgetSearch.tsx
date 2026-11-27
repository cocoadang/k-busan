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

type LocationGrades = ReturnType<typeof getApartmentLocationGrades>;

const locationTiers = [
  { level: 5, label: '최상급지', width: '44%', color: 'bg-slate-900 text-white' },
  { level: 4, label: '상급지', width: '58%', color: 'bg-blue-800 text-white' },
  { level: 3, label: '중급지', width: '72%', color: 'bg-blue-600 text-white' },
  { level: 2, label: '하급지', width: '86%', color: 'bg-blue-200 text-blue-950' },
  { level: 1, label: '최하급지', width: '100%', color: 'bg-slate-200 text-slate-900' },
] as const;

function radarPoint(axis: number, radius: number) {
  const angle = axis * Math.PI / 3;
  return { x: 80 + Math.sin(angle) * radius, y: 80 - Math.cos(angle) * radius };
}

function LocationHexagon({ grades }: { grades: LocationGrades }) {
  const vertices = grades.map(({ grade }, index) => grade === null ? null : radarPoint(index, grade * 10));
  const complete = vertices.every(point => point !== null);
  return (
    <svg viewBox="0 0 160 160" role="img"
      aria-label={grades.map(({ grade, estimate }, index) =>
        `${locationGradeAxes[index][1]} ${grade ?? (estimate === undefined ? '미확인' : `참고 ${estimate}`)}`
      ).join(', ')}
      className="h-36 w-36 shrink-0 sm:h-40 sm:w-40">
      {[1, 2, 3, 4, 5].map(level => (
        <polygon key={level} fill="none" stroke="#cbd5e1"
          points={locationGradeAxes.map((_, index) => {
            const { x, y } = radarPoint(index, level * 10);
            return `${x},${y}`;
          }).join(' ')} />
      ))}
      {locationGradeAxes.map(([short, label], index) => {
        const spoke = radarPoint(index, 50);
        const heading = radarPoint(index, 65);
        const { grade, estimate } = grades[index];
        return (
          <g key={label}>
            <line x1={80} y1={80} x2={spoke.x} y2={spoke.y} stroke="#e2e8f0" />
            <text x={heading.x} y={heading.y} textAnchor="middle" dominantBaseline="central"
              className="text-[12px] font-bold" fill={grade === null ? '#64748b' : '#1e293b'}>
              {short}{grade === null && estimate === undefined ? '?' : ''}
            </text>
          </g>
        );
      })}
      {complete && <polygon fill="#dbeafe" fillOpacity={0.85}
        points={vertices.map(point => `${point!.x},${point!.y}`).join(' ')} />}
      {vertices.map((point, index) => {
        const next = vertices[(index + 1) % vertices.length];
        const estimate = grades[index].estimate;
        if (point === null) {
          if (estimate === undefined) return null;
          const reference = radarPoint(index, estimate * 10);
          return <circle key={index} cx={reference.x} cy={reference.y} r={4}
            fill="white" stroke="#475569" strokeWidth={1.5} strokeDasharray="2 1" />;
        }
        return (
          <g key={index}>
            {next && <line x1={point.x} y1={point.y} x2={next.x} y2={next.y} stroke="#1d4ed8" strokeWidth={2} />}
            <circle cx={point.x} cy={point.y} r={3.4} fill="#1d4ed8" />
          </g>
        );
      })}
    </svg>
  );
}

function LocationPyramid({ matches }: { matches: Listing[] }) {
  const ranked = matches.map(apt => {
    const grades = getApartmentLocationGrades(apt.name);
    const confirmed = grades.flatMap(({ grade }) => grade === null ? [] : [grade]);
    const average = confirmed.length ? confirmed.reduce((sum, grade) => sum + grade, 0) / confirmed.length : null;
    return { apt, grades, average, confirmed: confirmed.length };
  });
  const ungraded = ranked.filter(({ average }) => average === null);
  const groups = locationTiers.map(tier => ({
    ...tier,
    entries: ranked.filter(({ average }) => average !== null && Math.round(average) === tier.level),
  }));
  return (
    <section aria-labelledby="location-grades" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 id="location-grades" className="text-lg font-bold">입지 등급표</h2>
      <p className="mt-1 text-sm text-slate-600">확인된 항목의 평균을 반올림해 5단으로 표시합니다. 6개 미만이면 잠정이며, 참고 점수는 평균에서 제외합니다.</p>
      <div className="mt-5 space-y-3">
        {groups.map(({ level, label, width, color, entries }) => (
          <section key={level} aria-label={label}>
            <h3 style={{ width }} className={`mx-auto flex min-h-9 min-w-32 items-center justify-center gap-2 rounded-md px-2 text-center text-sm font-semibold ${color}`}>
              {label} <span className="text-xs font-normal">{entries.length}건</span>
            </h3>
            {entries.length > 0 && <ul className="mx-auto mt-2 grid max-w-5xl gap-2 md:grid-cols-2">
              {entries.map(entry => <LocationCard key={`${entry.apt.name}:${entry.apt.areaCategory}`} {...entry} />)}
            </ul>}
          </section>
        ))}
        {ungraded.length > 0 && <section aria-label="등급 산정 대기">
          <h3 className="text-sm font-semibold text-slate-700">등급 산정 대기</h3>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {ungraded.map(entry => <LocationCard key={`${entry.apt.name}:${entry.apt.areaCategory}`} {...entry} />)}
          </ul>
        </section>}
      </div>
    </section>
  );
}

function LocationCard({ apt, grades, average, confirmed }: {
  apt: Listing; grades: LocationGrades; average: number | null; confirmed: number;
}) {
  return (
    <li className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <div className="min-w-0 flex-1 basis-32">
          <h4 className="font-bold text-slate-900">{apt.name}</h4>
          <p className="mt-1 text-sm text-slate-700">{apt.area}㎡ · {formatPrice(apt.price)}</p>
          {average !== null && <p className="mt-2 text-sm font-semibold text-blue-900">
            {average.toFixed(1)}/5{confirmed < locationGradeAxes.length && ` · 잠정 (${confirmed}/6 확인)`}
          </p>}
          {grades.map(({ grade, summary, estimate, pending }, index) => grade === null && summary ? (
            <p key={locationGradeAxes[index][0]} className="mt-1 text-xs leading-relaxed text-slate-600">
              {locationGradeAxes[index][1]} · {summary}{estimate === undefined ? ` · ${pending}` : ` · 참고 ${estimate}/5`}
            </p>
          ) : null)}
        </div>
        <LocationHexagon grades={grades} />
      </div>
      <details className="mt-1 border-t border-slate-200 pt-2 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">항목별 점수·근거</summary>
        <dl className="mt-2 space-y-2">
          {grades.map(({ grade, estimate, label, pending, source }, index) => {
            const [key, axis, rule] = locationGradeAxes[index];
            const score = grade === null ? (estimate === undefined ? '미확인' : `참고 ${estimate}/5`) : `${grade}/5`;
            return (
              <div key={key}>
                <dt className="font-medium text-slate-900" title={rule}>{axis} · {score}</dt>
                <dd className="text-xs leading-relaxed text-slate-600">
                  {[label, grade === null && estimate === undefined && pending].filter(Boolean).join(' · ') || '근거 자료 확인 필요'}
                  {source && <a href={source} target="_blank" rel="noreferrer" className="ml-2 text-blue-800 underline"
                    aria-label={`${apt.name} ${axis} 출처`}>출처</a>}
                </dd>
              </div>
            );
          })}
        </dl>
      </details>
    </li>
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
          <LocationPyramid matches={matches} />
        ) : <p className="rounded-xl bg-white p-5 text-slate-700">조건에 맞는 신고 거래가 없습니다.</p>)}
      </div>}
    </section>
  );
}
