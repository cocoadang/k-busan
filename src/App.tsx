import { unifiedHousingLinks } from './utils/housingLinks';
import { floorPlanGaps, RaemianSurFloorPlans } from './components/RaemianSurFloorPlans';
import largeApartments from './housing/largeApartmentCatalog.json';
import floorPlans from './housing/largeApartmentFloorPlans.json';

function FloorPlanCatalog() {
  const sources: Record<string, {url: string; source: string} | null> = floorPlans;
  return <section aria-labelledby="floor-plan-title">
    <h1 id="floor-plan-title" className="text-2xl font-bold">대단지 평면도</h1>
    <p className="mt-2 text-sm text-slate-600">서울·광명·과천·분당 3,000세대 이상 조사 목록. 원본에서 전용면적과 타입을 확인할 수 있습니다.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {largeApartments.apartments.map(apt => {
        const plan = floorPlanGaps[apt.name]?.source ?? sources[apt.name];
        return <article key={apt.name} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold">{apt.name}</h2>
          <p className="mt-1 text-sm text-slate-600">{[apt.city, apt.district, apt.neighborhood].filter(Boolean).join(' ')} · {apt.households.toLocaleString('ko-KR')}세대</p>
          <RaemianSurFloorPlans name={apt.name} />
          {plan && <a className="mt-2 inline-block text-xs text-blue-800 underline" href={plan.url} target="_blank" rel="noreferrer">출처 · {plan.source}</a>}
        </article>;
      })}
    </div>
  </section>;
}

import {AnalysisQueueStatus} from './components/AnalysisQueueStatus';
import ApartmentTradeHistory from './components/ApartmentTradeHistory';
import ApartmentBudgetSearch from './components/ApartmentBudgetSearch';
import { Header } from './components/Header.tsx';
import { Phase3Dashboard } from './components/Phase3Dashboard.tsx';

export default function App() {
  const { search, hash } = window.location;
  const legacyDashboard = /^#\/?(?:housing|plans|status|timeline|developments|news|strategy|redevelopment)(?:[/?]|$)/.test(hash);
  const params = new URLSearchParams(search);
  const view = params.get('view');
  const plans = view === 'floor-plans';
  const history = view === 'trade-history';
  const redevelopment = !plans && !history && (view === 'redevelopment' || (view !== 'search' && legacyDashboard));
  const searchActive = !redevelopment && !plans && !history;
  const menuClass = (active: boolean) => `rounded-lg px-3 py-2 text-sm font-semibold ${active ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`;
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900 w-full max-w-full overflow-x-hidden min-w-0">
      <nav aria-label="서비스 메뉴" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" aria-current={searchActive ? 'page' : undefined} className={menuClass(searchActive)}>아파트 검색</a>
          {unifiedHousingLinks && <a href="/market/?view=MAP" className={menuClass(false)}>지도·시세</a>}
          <a href="?view=trade-history" aria-current={history ? 'page' : undefined} className={menuClass(history)}>실거래 이력</a>
          <a href="?view=floor-plans" aria-current={plans ? 'page' : undefined} className={menuClass(plans)}>평면도</a>
          <a href="?view=redevelopment" aria-current={redevelopment ? 'page' : undefined} className={menuClass(redevelopment)}>정비사업 분석</a>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0">
        {plans ? <FloorPlanCatalog /> : history ? <ApartmentTradeHistory initialComplex={params.get('complex')} /> : redevelopment ? <section aria-label="정비사업 분석">
          <Header />
          <AnalysisQueueStatus />
          <Phase3Dashboard />
        </section> : <ApartmentBudgetSearch />}
      </main>
    </div>
  );
}
