import { curateNewsDocuments } from '../analyzer/relatednessGate.ts';
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { LayoutDashboard, History, MapPin, Newspaper, RefreshCw, Building, Calculator } from 'lucide-react';
import { ExtractedEvent, RedevelopmentProject } from '../types/redevelopment.ts';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry.ts';
import { FirestoreAreaDevelopmentDoc } from '../schema/firestoreSchema.ts';
import { AREA_DEVELOPMENTS_DATA } from '../data/areaDevelopmentsData.ts';
import { UnitPlanView } from './UnitPlanView.tsx';

// Only the default tab ([단지계획]) is in the initial bundle. The other tabs are loaded on
// demand; the subscription strategy tab (calculator + benchmark data) is the largest of them,
// and the status/timeline tabs carry the verified history data.
const HousingMapView = lazy(() => import('./HousingMapView.tsx').then(m => ({ default: m.HousingMapView })));

const loadProjectStatusView = () => import('./ProjectStatusView.tsx');
const loadProjectTimelineView = () => import('./ProjectTimelineView.tsx');
const loadAreaDevelopmentsView = () => import('./AreaDevelopmentsView.tsx');
const loadProjectNewsView = () => import('./ProjectNewsView.tsx');
const ProjectStatusView = lazy(() => loadProjectStatusView().then((m) => ({ default: m.ProjectStatusView })));
const ProjectTimelineView = lazy(() => loadProjectTimelineView().then((m) => ({ default: m.ProjectTimelineView })));
const AreaDevelopmentsView = lazy(() => loadAreaDevelopmentsView().then((m) => ({ default: m.AreaDevelopmentsView })));
const ProjectNewsView = lazy(() => loadProjectNewsView().then((m) => ({ default: m.ProjectNewsView })));
const SubscriptionStrategyView = lazy(() =>
  import('./SubscriptionStrategyView.tsx').then((m) => ({ default: m.SubscriptionStrategyView })));

// Warm the small tab chunks once the first screen is idle so switching tabs normally does not
// show the loading fallback. Failures are ignored here; lazy() retries when the tab is opened.
function prefetchTabViews() {
  for (const load of [loadProjectStatusView, loadProjectTimelineView, loadAreaDevelopmentsView, loadProjectNewsView]) {
    load().catch(() => {});
  }
}

const TabLoading: React.FC<{ label: string }> = ({ label }) => (
  <div role="status" className="p-6 text-sm text-slate-500">{label} 화면을 불러오는 중입니다…</div>
);

export type MainTabType = 'housing' | 'plans' | 'status' | 'timeline' | 'developments' | 'news' | 'strategy';

const MAIN_TABS: ReadonlyArray<{ id: MainTabType; label: string; Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }> }> = [
  { id: 'housing', label: '지도·시세', Icon: MapPin },
  { id: 'plans', label: '단지계획', Icon: Building },
  { id: 'status', label: '사업현황', Icon: LayoutDashboard },
  { id: 'timeline', label: '진행이력', Icon: History },
  { id: 'developments', label: '지역변화', Icon: MapPin },
  { id: 'news', label: '뉴스', Icon: Newspaper },
  { id: 'strategy', label: '청약전략', Icon: Calculator },
];

const TAB_IDS = new Set<MainTabType>(['housing', 'plans', 'status', 'timeline', 'developments', 'news', 'strategy']);
const DEFAULT_PROJECT_ID = 'chokjin-3';
const KNOWN_PROJECT_IDS = new Set(REDEVELOPMENT_SEED_PROJECTS.map((p) => p.id));

/** Reads "#/<tab>/<projectId>" so tabs survive refresh, sharing and the back button. */
export function parseDashboardHash(hash: string): { tab: MainTabType; projectId: string } {
  const [rawTab, rawProject] = hash.split('?')[0].replace(/^#\/?/, '').split('/');
  const tab = TAB_IDS.has(rawTab as MainTabType) ? (rawTab as MainTabType) : 'plans';
  const projectId = rawProject && KNOWN_PROJECT_IDS.has(decodeURIComponent(rawProject))
    ? decodeURIComponent(rawProject) : DEFAULT_PROJECT_ID;
  return { tab, projectId };
}

export function formatDashboardHash(tab: MainTabType, projectId: string): string {
  return `#/${tab}/${encodeURIComponent(projectId)}`;
}

const initialRoute = () =>
  typeof window === 'undefined' ? { tab: 'plans' as MainTabType, projectId: DEFAULT_PROJECT_ID } : parseDashboardHash(window.location.hash);

export const Phase3Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Main Tabs: [단지계획] [사업현황] [진행이력] [지역변화] [뉴스] (기본 탭: 단지계획)
  const [activeTab, setActiveTabState] = useState<MainTabType>(() => initialRoute().tab);

  // Selected project for [단지계획], [진행이력], and [지역변화] tabs
  const [selectedTimelineProject, setSelectedTimelineProjectState] = useState<string>(() => initialRoute().projectId);

  // Tab changes add a history entry (back button returns to the previous tab);
  // switching the project inside a tab only replaces the current entry.
  const setActiveTab = (tab: MainTabType) => {
    setActiveTabState(tab);
    const next = formatDashboardHash(tab, selectedTimelineProject);
    if (window.location.hash !== next) window.history.pushState(null, '', next);
  };
  const setSelectedTimelineProject = (projectId: string) => {
    setSelectedTimelineProjectState(projectId);
    window.history.replaceState(null, '', formatDashboardHash(activeTab, projectId));
  };

  useEffect(() => {
    const sync = () => {
      const route = parseDashboardHash(window.location.hash);
      setActiveTabState(route.tab);
      setSelectedTimelineProjectState(route.projectId);
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

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

  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(prefetchTabViews, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(prefetchTabViews, 1500);
    return () => window.clearTimeout(id);
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
    setSelectedTimelineProjectState(projectId);
    setActiveTabState('timeline');
    window.history.pushState(null, '', formatDashboardHash('timeline', projectId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div id="main-dashboard-container" className="space-y-4">
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
        {loadError && activeTab !== 'housing' && activeTab !== 'news' && activeTab !== 'strategy' && (
          <div role="status" className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-800">
            최신 데이터를 불러오지 못해 기본 수록 자료로 표시 중입니다.
          </div>
        )}
        {activeTab === 'housing' && <Suspense fallback={<TabLoading label="지도·시세" />}><HousingMapView events={events} /></Suspense>}
        {activeTab === 'status' && (
          <Suspense fallback={<TabLoading label="사업현황" />}>
            <ProjectStatusView
              projects={projects}
              events={events}
              selectedProjectId={selectedTimelineProject}
              onSelectProjectTimeline={handleSelectProjectTimeline}
            />
          </Suspense>
        )}

        {activeTab === 'timeline' && (
          <Suspense fallback={<TabLoading label="진행이력" />}>
            <ProjectTimelineView
              selectedProjectId={selectedTimelineProject}
              onSelectProject={(id) => setSelectedTimelineProject(id)}
              events={events}
            />
          </Suspense>
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
          <Suspense fallback={<TabLoading label="지역변화" />}>
            <AreaDevelopmentsView
              areaDevelopments={areaDevelopments}
              selectedProjectId={selectedTimelineProject}
              onSelectProject={(id) => setSelectedTimelineProject(id)}
            />
          </Suspense>
        )}

        {activeTab === 'news' && (
          <>
            {loadError && <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{loadError}</div>}
            {loading && !overviewData ? <div role="status" className="p-6 text-sm text-slate-500">뉴스를 불러오는 중입니다…</div> : (!loadError || overviewData) && (
              <Suspense fallback={<TabLoading label="뉴스" />}>
                <ProjectNewsView documents={documents} />
              </Suspense>
            )}
          </>
        )}

        {activeTab === 'strategy' && (
          <Suspense fallback={<TabLoading label="청약전략" />}>
            <SubscriptionStrategyView />
          </Suspense>
        )}
      </div>
    </div>
  );
};
