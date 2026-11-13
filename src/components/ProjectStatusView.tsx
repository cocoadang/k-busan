import { getHousingLink } from '../utils/housingLinks';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry.ts';
import React from 'react';
import { Building2, ArrowRight, Calendar, AlertCircle } from 'lucide-react';
import { ExtractedEvent, RedevelopmentProject } from '../types/redevelopment.ts';
import { getNextRedevelopmentStage, resolveProjectStatutoryStage } from '../utils/redevelopmentStages.ts';

interface ProjectStatusViewProps {
  projects: RedevelopmentProject[];
  events: ExtractedEvent[];
  onSelectProjectTimeline: (projectId: string) => void;
}

export const ProjectStatusView: React.FC<ProjectStatusViewProps> = ({
  projects,
  events,
  onSelectProjectTimeline,
}) => {
  const displayProjects = REDEVELOPMENT_SEED_PROJECTS.map(seed =>
    projects.find(project => project.id === seed.id) || seed);

  return (
    <div id="project-status-view" className="space-y-4 sm:space-y-6 min-w-0">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 min-w-0">
        {displayProjects.map((project) => {
          const housingLink = getHousingLink(project.id);
          const projectEvents = events.filter((e) => e.projectId === project.id);
          // Sort by eventDate descending to get the most recent verified event
          const sortedEvents = [...projectEvents].sort((a, b) => {
            const dateA = new Date(a.eventDate || a.publishedAt || a.firstSeenAt || 0).getTime();
            const dateB = new Date(b.eventDate || b.publishedAt || b.firstSeenAt || 0).getTime();
            return dateB - dateA;
          });

          const latestEvent = sortedEvents[0] || null;

          // 1. 사업명
          const projectName = project.name || '자료 확인 필요';
          const shortName =
            project.id === 'chokjin-3'
              ? '촉진3구역'
              : project.id === 'udong-3'
              ? '우동3구역'
              : project.id === 'samik-beach'
              ? '삼익비치'
              : project.name;

          // 2. 지역
          const location =
            project.district === project.city ? project.city :
            project.district && project.city
              ? `${project.city} ${
                  project.id === 'chokjin-3'
                    ? '부산진구 범전동 일원'
                    : project.id === 'udong-3'
                    ? '해운대구 우동 일원'
                    : project.id === 'samik-beach'
                    ? '수영구 남천동 일원'
                    : project.district
                }`
              : '자료 확인 필요';

          // 3. 현재 사업단계 및 다음 정비사업 단계 (verified 진행이력 SSOT 기준 산출)
          const stageResolution = resolveProjectStatutoryStage(project.id, projectEvents);
          const currentStage = stageResolution.currentStage;
          const nextStage =
            stageResolution.nextStage ||
            project.nextStage ||
            getNextRedevelopmentStage(currentStage);

          // 4. 최근 주요 변화
          const recentChange = latestEvent
            ? latestEvent.title || latestEvent.summary || '자료 확인 필요'
            : '자료 확인 필요';

          // 5. 최근 업데이트 날짜
          const latestUpdateDate = latestEvent?.eventDate
            ? latestEvent.eventDate
            : '자료 확인 필요';

          return (
            <div
              key={project.id}
              id={`status-card-${project.id}`}
              className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 min-w-0"
            >
              <div className="space-y-4 sm:space-y-5 min-w-0">
                {/* Header: Name and Region */}
                <div className="border-b border-slate-100 pb-3.5 sm:pb-4 min-w-0">
                  <div className="flex flex-col gap-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                        {shortName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          project.type === '재건축'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {project.type || '재개발'}
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight break-keep">
                      {projectName}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                      <p className="flex items-center gap-1.5 break-keep">
                        <span className="font-medium text-slate-700 shrink-0">지역:</span>
                        <span>{location}</span>
                      </p>
                      {project.generalSaleStatus && (
                        <p className="flex items-center gap-1.5 break-keep">
                          <span className="font-medium text-slate-700 shrink-0">일반분양:</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                            {project.generalSaleStatus}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stage Info Grid: 1-col on mobile, 2-col on sm+ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 min-w-0">
                  <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 min-w-0">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1">
                      현재 사업단계
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 break-keep">
                      {currentStage}
                    </div>
                    {stageResolution.subsequentPlanChangeEvidence && (
                      <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
                        <span className="font-semibold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                          후속
                        </span>
                        <span className="truncate">
                          {stageResolution.subsequentPlanChangeEvidence.eventDate} 정비계획 변경
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl bg-blue-50/50 border border-blue-100/60 min-w-0">
                    <div className="text-[11px] font-semibold text-blue-600 mb-1">
                      다음 정비사업 단계
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-blue-950 break-keep">
                      {nextStage}
                    </div>
                  </div>
                </div>

                {/* Recent Changes Box */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/60 border border-slate-200/80 space-y-2 min-w-0">
                  <div className="flex items-center justify-between text-[11px] gap-2">
                    <span className="font-semibold text-slate-700 flex items-center gap-1 shrink-0">
                      최근 주요 변화
                    </span>
                    <span className="text-slate-400 flex items-center gap-1 font-mono text-[10px] sm:text-[11px] shrink-0">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {latestUpdateDate}
                    </span>
                  </div>

                  {recentChange === '자료 확인 필요' ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 italic py-1 break-keep">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span>자료 확인 필요 (등록된 최근 이벤트 없음)</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-800 leading-relaxed font-medium line-clamp-2 break-keep">
                      {recentChange}
                    </p>
                  )}
                </div>
              </div>

              {/* Action: View Timeline */}
              <div className="pt-4 sm:pt-5 mt-4 sm:mt-5 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                {housingLink && <a href={housingLink.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-blue-200 text-blue-800 text-xs font-semibold min-h-[44px]">{housingLink.label}</a>}
                <button
                  id={`btn-view-timeline-${project.id}`}
                  onClick={() => onSelectProjectTimeline(project.id)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer group min-h-[44px]"
                >
                  <span>진행이력 보기</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
