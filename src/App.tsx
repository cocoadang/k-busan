import {AnalysisQueueStatus} from './components/AnalysisQueueStatus';
import ApartmentBudgetSearch from './components/ApartmentBudgetSearch';
import { Header } from './components/Header.tsx';
import { Phase3Dashboard } from './components/Phase3Dashboard.tsx';

export default function App() {
  const { search, hash } = window.location;
  const legacyDashboard = /^#\/?(?:housing|plans|status|timeline|developments|news|strategy|redevelopment)(?:[/?]|$)/.test(hash);
  const view = new URLSearchParams(search).get('view');
  const redevelopment = view === 'redevelopment' || (view !== 'search' && legacyDashboard);
  const menuClass = (active: boolean) => `rounded-lg px-3 py-2 text-sm font-semibold ${active ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`;
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900 w-full max-w-full overflow-x-hidden min-w-0">
      <nav aria-label="서비스 메뉴" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" aria-current={!redevelopment ? 'page' : undefined} className={menuClass(!redevelopment)}>아파트 검색</a>
          <a href="?view=redevelopment" aria-current={redevelopment ? 'page' : undefined} className={menuClass(redevelopment)}>정비사업 분석</a>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0">
        {redevelopment ? <section aria-label="정비사업 분석">
          <Header />
          <AnalysisQueueStatus />
          <Phase3Dashboard />
        </section> : <ApartmentBudgetSearch />}
      </main>
    </div>
  );
}
