import { curateNewsDocuments } from '../analyzer/relatednessGate.ts';
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, History, MapPin, Newspaper, RefreshCw, Building, Calculator } from 'lucide-react';
import { ExtractedEvent, RedevelopmentProject } from '../types/redevelopment.ts';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry.ts';
import { FirestoreAreaDevelopmentDoc } from '../schema/firestoreSchema.ts';
import { AREA_DEVELOPMENTS_DATA } from '../data/areaDevelopmentsData.ts';
import { ProjectStatusView } from './ProjectStatusView.tsx';
import { ProjectTimelineView } from './ProjectTimelineView.tsx';
import { AreaDevelopmentsView } from './AreaDevelopmentsView.tsx';
import { ProjectNewsView } from './ProjectNewsView.tsx';
import { UnitPlanView } from './UnitPlanView.tsx';
import { SubscriptionStrategyView } from './SubscriptionStrategyView.tsx';

export type MainTabType = 'plans' | 'status' | 'timeline' | 'developments' | 'news' | 'strategy';

export const Phase3Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Main Tabs: [단지계획] [사업현황] [진행이력] [지역변화] [뉴스] (기본 탭: 단지계획)
  const [activeTab, setActiveTab] = useState<MainTabType>('plans');

  // Selected project for [단지계획], [진행이력], and [지역변화] tabs
  const [selectedTimelineProject, setSelectedTimelineProject] = useState<string>('chokjin-3');

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/storage/overview');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status?.available === false) throw new Error('Firestore unavailable');
        setLoadError(null);
        setOverviewData(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch storage overview:', err);
      setLoadError('뉴스 데이터를 불러오지 못했습니다. 새로고침하여 다시 시도해주세요. 이전 조회 결과가 있으면 그대로 표시합니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const projects: RedevelopmentProject[] =
    overviewData?.projects && overviewData.projects.length > 0
      ? overviewData.projects
      : (REDEVELOPMENT_SEED_PROJECTS as unknown as RedevelopmentProject[]);

  const events: ExtractedEvent[] = overviewData?.events || [];
  const documents = curateNewsDocuments(overviewData?.documents || [], REDEVELOPMENT_SEED_PROJECTS);
  const areaDevelopments: FirestoreAreaDevelopmentDoc[] =
    overviewData?.areaDevelopments && overviewData.areaDevelopments.length > 0
      ? overviewData.areaDevelopments
      : AREA_DEVELOPMENTS_DATA;

  // Handler for "[진행이력 보기]" button on ProjectStatusView cards
  const handleSelectProjectTimeline = (projectId: string) => {
    setSelectedTimelineProject(projectId);
    setActiveTab('timeline');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div id="main-dashboard-container" className="space-y-6">
      {/* Main Navigation Tabs: [단지계획] [사업현황] [진행이력] [지역변화] [뉴스] */}
      <div className="w-full border-b border-slate-200 min-w-0">
        <div className="flex items-center justify-between min-w-0">
          <nav
            id="main-navigation-tabs"
            className="flex items-center space-x-1 sm:space-x-2 -mb-px overflow-x-auto scrollbar-none flex-nowrap min-w-0 flex-1 py-0.5"
            aria-label="Tabs"
          >
            <button
              id="tab-btn-plans"
              onClick={() => setActiveTab('plans')}
              className={`min-h-[52px] sm:min-h-[56px] min-w-max shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer select-none break-keep ${
                activeTab === 'plans'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Building className="w-4 h-4 shrink-0" />
              <span>단지계획</span>
            </button>

            <button
              id="tab-btn-status"
              onClick={() => setActiveTab('status')}
              className={`min-h-[52px] sm:min-h-[56px] min-w-max shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer select-none break-keep ${
                activeTab === 'status'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>사업현황</span>
            </button>

            <button
              id="tab-btn-timeline"
              onClick={() => setActiveTab('timeline')}
              className={`min-h-[52px] sm:min-h-[56px] min-w-max shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer select-none break-keep ${
                activeTab === 'timeline'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>진행이력</span>
            </button>

            <button
              id="tab-btn-news"
              onClick={() => setActiveTab('news')}
              className={`min-h-[52px] sm:min-h-[56px] min-w-max shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer select-none break-keep ${
                activeTab === 'news'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Newspaper className="w-4 h-4 shrink-0" />
              <span>뉴스</span>
              {documents.length > 0 && (
                <span className="hidden sm:inline-block text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                  {documents.length}
                </span>
              )}
            </button>

            <button
              id="tab-btn-strategy"
              onClick={() => setActiveTab('strategy')}
              className={`min-h-[52px] sm:min-h-[56px] min-w-max shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer select-none break-keep ${
                activeTab === 'strategy'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Calculator className="w-4 h-4 shrink-0" />
              <span>청약전략</span>
            </button>
          </nav>

          {/* Subtle quick refresh */}
          <div className="flex items-center gap-1.5 pl-2 shrink-0">
            {lastUpdated && (
              <span className="hidden md:inline-block text-[11px] text-slate-400 font-mono">
                {lastUpdated.toLocaleTimeString('ko-KR')} 기준
              </span>
            )}
            <button
              id="quick-refresh-btn"
              onClick={fetchOverview}
              disabled={loading}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="데이터 새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content Panels */}
      <div id="tab-content-panel">
        {activeTab === 'status' && (
          <ProjectStatusView
            projects={projects}
            events={events}
            onSelectProjectTimeline={handleSelectProjectTimeline}
          />
        )}

        {activeTab === 'timeline' && (
          <ProjectTimelineView
            selectedProjectId={selectedTimelineProject}
            onSelectProject={(id) => setSelectedTimelineProject(id)}
            events={events}
          />
        )}

        {activeTab === 'plans' && (
          <UnitPlanView
            projects={projects}
            selectedProjectId={selectedTimelineProject}
            onSelectProject={(id) => setSelectedTimelineProject(id)}
          />
        )}

        {activeTab === 'developments' && (
          <AreaDevelopmentsView
            areaDevelopments={areaDevelopments}
            selectedProjectId={selectedTimelineProject}
            onSelectProject={(id) => setSelectedTimelineProject(id)}
          />
        )}

        {activeTab === 'news' && (
          <>
            {loadError && <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{loadError}</div>}
            {loading && !overviewData ? <div role="status" className="p-6 text-sm text-slate-500">뉴스를 불러오는 중입니다…</div> : (!loadError || overviewData) && <ProjectNewsView documents={documents} />}
          </>
        )}

        {activeTab === 'strategy' && (
          <SubscriptionStrategyView />
        )}
      </div>
    </div>
  );
};
