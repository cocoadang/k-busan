import {AnalysisQueueStatus} from './components/AnalysisQueueStatus';
import ApartmentBudgetSearch from './components/ApartmentBudgetSearch';
import { Header } from './components/Header.tsx';
import { Phase3Dashboard } from './components/Phase3Dashboard.tsx';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900 w-full max-w-full overflow-x-hidden min-w-0">
      <nav aria-label="서비스 메뉴" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="font-bold text-slate-900">아파트 찾기</a>
          <a href="#redevelopment" className="text-sm font-semibold text-blue-800 hover:underline">정비사업 분석</a>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0">
        <ApartmentBudgetSearch />
        <section id="redevelopment" aria-label="정비사업 분석" className="mt-12 scroll-mt-4">
          <Header />
          <AnalysisQueueStatus />
          <Phase3Dashboard />
        </section>
      </main>
    </div>
  );
}
