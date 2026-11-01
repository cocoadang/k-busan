import { curateNewsDocuments } from '../analyzer/relatednessGate.ts';
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
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

// The subscription strategy tab (calculator + benchmark data) is the largest part of the
// bundle and is not on the first screen, so it is loaded on demand.
const SubscriptionStrategyView = lazy(() =>
  import('./SubscriptionStrategyView.tsx').then((m) => ({ default: m.SubscriptionStrategyView })));

export type MainTabType = 'plans' | 'status' | 'timeline' | 'developments' | 'news' | 'strategy';

const MAIN_TABS: ReadonlyArray<{ id: MainTabType; label: string; Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }> }> = [
  { id: 'plans', label: '단지계획', Icon: Building },
  { id: 'status', label: '사업현황', Icon: LayoutDashboard },
  { id: 'timeline', label: '진행이력', Icon: History },
  { id: 'developments', label: '지역변화', Icon: MapPin },
  { id: 'news', label: '뉴스', Icon: Newspaper },
  { id: 'strategy', label: '청약전략', Icon: Calculator },
];

export const Phase3Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Main Tabs: [단지계획] [사업현황] [진행이력] [지역변화] [뉴스] (기본 탭: 단지계획)
  const [activeTab, setActiveTab] = useState<MainTabType>('plans');

  // Selected project for [단지계획], [진행이력], and [지역변화] tabs
  const [selectedTimelineProject, setSelectedTimelineProject] = useState<string>('chokjin-3');

  const overviewRequest = useRef<AbortController | null>(null);

  const fetchOverview = async () => {
    // A newer refresh supersedes any request still in flight.
    overviewRequest.current?.abort();
    const controller = new AbortController();
    overviewRequest.current = controller;
    setLoading(true);
    try {
      const res = await fetch('/api/storage/overview', { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!(res.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('Non-JSON response');
      }
      const data = await res.json();
      if (data.status?.available === false) throw new Error('Firestore unavailable');
      setLoadError(null);
      setOverviewData(data);
      setLastUpdated(new Date());
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      console.error('Failed to fetch storage overview:', err);
      setLoadError('최신 데이터를 불러오지 못했습니다. 새로고침하여 다시 시도해주세요. 이전 조회 결과나 기본 수록 자료가 있으면 그대로 표시합니다.');
    } finally {
      if (overviewRequest.current === controller) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    return () => overviewRequest.current?.abort();
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
      {/* Main Navigation Tabs: [단지계획] [사업현황] [진행이력] [지역변화] [뉴스] [청약전략] */}
      <div className="w-full border-b border-slate-200 min-w-0">
        <div className="flex items-center justify-between min-w-0">
          <nav
            id="main-navigation-tabs"
            className="flex items-center space-x-1 sm:space-x-2 -mb-px overflow-x-auto scrollbar-none flex-nowrap min-w-0 flex-1 py-0.5"
            aria-label="주요 메뉴"
            role="tablist"
          >
            {MAIN_TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                id={`tab-btn-${id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                aria-controls="tab-content-panel"
                onClick={() => setActiveTab(id)}
                className={`min-h-[52px] sm:min-h-[56px] min-w-max shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer select-none break-keep ${
                  activeTab === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
                {id === 'news' && documents.length > 0 && (
                  <span className="hidden sm:inline-block text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                    {documents.length}
                  </span>
                )}
              </button>
            ))}
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
              aria-label="데이터 새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content Panels */}
      <div id="tab-content-panel" role="tabpanel">
        {loadError && activeTab !== 'news' && activeTab !== 'strategy' && (
          <div role="status" className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-800">
            최신 데이터를 불러오지 못해 기본 수록 자료로 표시 중입니다.
          </div>
        )}
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
            // Remount per project so no state from the previous project renders even for one frame.
            key={selectedTimelineProject}
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
          <Suspense fallback={<div role="status" className="p-6 text-sm text-slate-500">청약전략 화면을 불러오는 중입니다…</div>}>
            <SubscriptionStrategyView />
          </Suspense>
        )}
      </div>
    </div>
  );
};
