import { useState, type FormEvent } from 'react';

const apartments = [
  { name: '힐스테이트 e편한세상 문정', district: '서울 송파구', area: 59.94, price: 181000, date: '2026-10-29', floor: 4, time: 196, note: '학교 접근성과 주변 주거환경을 장점으로, 지하철역까지의 거리를 고려할 점으로 설명했습니다.', source: 'https://apt.silgeorae.com/apt/11710-rccmpt/' },
  { name: '가락쌍용1차', district: '서울 송파구', area: 59.92, price: 183500, date: '2026-11-04', floor: 1, time: 131, note: '송파·강남 생활권과 학군에 비해 가격 부담이 상대적으로 낮다는 평가입니다.', source: 'https://lottes.co.kr/apartments/garak-ssangyong-1.html' },
  { name: '래미안슈르', district: '경기 과천시', area: 59.97, price: 188000, date: '2026-11-07', floor: 7, time: 82, note: '비교한 구축 단지보다 주차와 거주 여건을 높게 봤고, 주변 신축이 단지에 미치는 영향도 짚었습니다.', source: 'https://mola.kr/transactions/apartments/863502fd-efe7-480c-accc-98aae958790a' },
  { name: '광장현대3단지', district: '서울 광진구', area: 84.97, price: 220000, date: '2026-10-09', floor: 7, time: 33, note: '광나루·강변역 접근과 광장동 학원가를 강점으로, 주차와 재건축 여건을 제약으로 평가했습니다.', source: 'https://budongsan.gwiin.co.kr/complex?name=%ED%98%84%EB%8C%803&sigungu=%EC%84%9C%EC%9A%B8+%EA%B4%91%EC%A7%84%EA%B5%AC' },
  { name: '고덕 아이파크', district: '서울 강동구', area: 84.98, price: 222000, date: '2026-11-05', floor: 11, time: 230, note: '고덕역 접근성과 학원가를 강점으로 봤습니다. 영상에서 장래 철도 계획에 대한 기대도 언급했습니다.', source: 'https://cy-on.kr/trades/8477/' },
];
const districts = [...new Set(apartments.map(({ district }) => district))].sort();
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
  const matches = query ? apartments.filter((apt) =>
    apt.price <= query.budget &&
    (!query.district || apt.district === query.district) &&
    (!query.size || Math.floor(apt.area) === Number(query.size))
  ).sort((first, second) => second.price - first.price) : [];

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Math.round(Number(budget) * 10000);
    if (Number.isSafeInteger(amount) && amount > 0) setQuery({ budget: amount, district, size });
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
          <button type="submit" className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">아파트 찾기</button>
        </form>
        <p className="mt-4 text-sm text-slate-300">시범 데이터 · 5개 단지 · 2026.11.20 확인한 신고 거래 기준 · 취득 부대비용 별도</p>
      </div>
      {query && <div className="mt-6" aria-live="polite">
        <h2 className="text-xl font-bold">{formatPrice(query.budget)} 이하 후보 {matches.length}곳</h2>
        <p className="mt-1 text-sm text-slate-600">{[query.district || '전체 지역', query.size ? `전용 ${query.size}㎡대` : '전체 면적', '예산에 가까운 순'].join(' · ')}. 현재 매물이나 호가는 별도로 확인해야 합니다.</p>
        {matches.length === 0 && <p className="mt-4 rounded-xl bg-white p-5 text-slate-700">시범 데이터에서 조건에 맞는 거래를 찾지 못했습니다. 지역이나 전용면적을 넓혀보세요.</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((apt) => <article key={apt.name} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-600">{apt.district} · 전용 {apt.area}㎡</p>
            <h3 className="mt-1 text-xl font-bold">{apt.name}</h3>
            <p className="mt-3 text-lg font-bold text-blue-800">{formatPrice(apt.price)}</p>
            <p className="text-sm text-slate-600">{apt.date} 계약 · {apt.floor}층</p>
            <p className="mt-4 flex-1 text-base text-slate-700">{apt.note}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-3 text-sm font-semibold text-blue-800">
              <a className="underline" href={`https://www.youtube.com/watch?v=TL_WqYQsUJw&t=${apt.time}s`} target="_blank" rel="noreferrer">입지 분석 영상</a>
              <a className="underline" href={apt.source} target="_blank" rel="noreferrer">신고 거래 확인</a>
            </div>
          </article>)}
        </div>
      </div>}
    </section>
  );
}
