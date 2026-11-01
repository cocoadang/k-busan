import React from 'react';
import { Header } from './components/Header.tsx';
import { Phase3Dashboard } from './components/Phase3Dashboard.tsx';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900 w-full max-w-full overflow-x-hidden min-w-0">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0">
        {/* 부산 정비사업 분석: [단지계획] [사업현황] [진행이력] [지역변화] [뉴스] */}
        <Phase3Dashboard />
      </main>
    </div>
  );
}
