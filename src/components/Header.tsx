import React from 'react';
import { Building2 } from 'lucide-react';

export const Header: React.FC<{
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  loading?: boolean;
}> = ({ lastUpdated, onRefresh, loading }) => {
  return (
    <header id="main-header" className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs w-full min-w-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[56px] sm:h-16 py-2 sm:py-0 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white shadow-sm shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight break-keep">
              부산 정비사업 분석
            </h1>
          </div>
        </div>

        {onRefresh && (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {lastUpdated && (
              <span className="hidden sm:inline-block text-xs text-slate-400 font-mono">
                기준: {lastUpdated.toLocaleTimeString('ko-KR')}
              </span>
            )}
            <button
              id="header-refresh-btn"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-50 min-h-[36px]"
            >
              <span>{loading ? '갱신 중...' : '새로고침'}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
