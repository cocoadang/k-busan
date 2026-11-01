import React, { useState } from 'react';
import { Play, CheckCircle, Terminal, RefreshCw, Layers, AlertTriangle } from 'lucide-react';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry.ts';
import { DefaultCollectorQueryBuilder } from '../collector/interfaces.ts';
import { safeFetchJson } from '../utils/httpJsonClient.ts';

export const CollectorSimulator: React.FC = () => {
  const [pollResult, setPollResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const queryBuilder = new DefaultCollectorQueryBuilder();

  const handleTestPollEndpoint = async () => {
    setLoading(true);
    try {
      const result = await safeFetchJson('/api/jobs/poll', { method: 'POST' }, '/api/jobs/poll');
      if (result.ok && result.data) {
        setPollResult({
          ...result.data,
          _httpStatus: result.status,
          _httpOk: true,
          _contentType: result.contentType,
        });
      } else {
        setPollResult({
          ...(result.data || {}),
          success: false,
          error: result.error || 'Request failed',
          _httpStatus: result.status,
          _httpOk: false,
          _contentType: result.contentType,
        });
      }
    } catch (err: any) {
      setPollResult({
        success: false,
        error: {
          code: 'NETWORK_FETCH_ERROR',
          message: err?.message || 'Failed to call /api/jobs/poll',
        },
        _httpStatus: 500,
        _httpOk: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            수집기 쿼리 생성기 & Cloud Scheduler 엔드포인트 테스트
          </h2>
          <p className="text-xs text-slate-500">
            각 구역의 aliases 및 locationKeywords 기반 수집 쿼리와 /api/jobs/poll 인터페이스 동작 검증
          </p>
        </div>

        <button
          onClick={handleTestPollEndpoint}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          /api/jobs/poll 시뮬레이션 호출
        </button>
      </div>

      {/* 프로젝트별 자동 생성 쿼리 뷰 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {REDEVELOPMENT_SEED_PROJECTS.map((project) => {
          const queries = queryBuilder.buildQueries(project);
          return (
            <div
              key={project.id}
              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">
                  {project.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                  {project.id}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-blue-600" />
                    주요 포털 검색 쿼리 (Primary Queries)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {queries.primaryQueries.map((q, idx) => (
                      <code
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-200 text-[11px]"
                      >
                        {q}
                      </code>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-purple-600" />
                    확장 조합 쿼리 (Extended Queries)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {queries.extendedQueries.map((q, idx) => (
                      <code
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[11px]"
                      >
                        {q}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 시뮬레이션 결과 JSON 모달/터미널 뷰 */}
      {pollResult && (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900 p-3.5 text-xs text-slate-200 font-mono">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>/api/jobs/poll 응답 결과 (Dry-run Payload)</span>
            </div>
            {pollResult._httpOk ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <CheckCircle className="w-3 h-3" />
                HTTP {pollResult._httpStatus || 200} OK
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-rose-400">
                <AlertTriangle className="w-3 h-3" />
                HTTP {pollResult._httpStatus || 500} ERROR
              </span>
            )}
          </div>
          <pre className="overflow-x-auto text-[11px] text-slate-300 leading-relaxed max-h-56">
            {JSON.stringify(pollResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
