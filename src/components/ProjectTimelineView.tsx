import { ProjectSelector } from './ProjectSelector.tsx';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry.ts';
import React, { useState } from 'react';
import {
  Calendar,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building2,
  Info,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { ExtractedEvent } from '../types/redevelopment.ts';
import { getDisplaySourceTier } from '../utils/sourceFormatter.ts';
import { STANDARD_REDEVELOPMENT_STAGES, resolveProjectStatutoryStage } from '../utils/redevelopmentStages.ts';

interface ProjectTimelineViewProps {
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  events: ExtractedEvent[];
}

export const ProjectTimelineView: React.FC<ProjectTimelineViewProps> = ({
  selectedProjectId,
  onSelectProject,
  events,
}) => {
  const [sortOrder, setSortOrder] = useState<'chronological' | 'reverse'>('chronological');

  const filteredEvents = events.filter((e) => e.projectId === selectedProjectId);

  // Sort events
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const timeA = new Date(a.eventDate || a.publishedAt || a.firstSeenAt || 0).getTime();
    const timeB = new Date(b.eventDate || b.publishedAt || b.firstSeenAt || 0).getTime();
    return sortOrder === 'chronological' ? timeA - timeB : timeB - timeA;
  });

  const project = REDEVELOPMENT_SEED_PROJECTS.find(p => p.id === selectedProjectId);
  const projectName = project?.name || '사업지 확인 필요';
  const projectType = project?.type || '정비사업';

  return (
    <div id="project-timeline-view" className="space-y-4 sm:space-y-6 min-w-0">
      {/* 1. Project Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200 min-w-0">
        <ProjectSelector selectedId={selectedProjectId} onSelect={onSelectProject} idPrefix="tab-select" />

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            id="btn-toggle-sort-order"
            onClick={() => setSortOrder(sortOrder === 'chronological' ? 'reverse' : 'chronological')}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            title="정렬 순서 전환"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="break-keep">{sortOrder === 'chronological' ? '과거 → 현재순' : '최신순 (역순)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Standard Redevelopment Process Reference Bar */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-xs text-slate-600">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-2">
          <Info className="w-4 h-4 text-blue-600" />
          <span>정비사업 표준 진행 절차 안내 (참고용)</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 overflow-x-auto pb-1">
          {STANDARD_REDEVELOPMENT_STAGES.map((st, idx) => (
            <React.Fragment key={st.step}>
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-medium text-slate-700 whitespace-nowrap">
                {st.name}
              </span>
              {idx < STANDARD_REDEVELOPMENT_STAGES.length - 1 && (
                <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          ※ 표준 진행 절차 안내입니다. 실제 사업장의 개별 사건과 날짜는 아래 공인·확인된 기록만을 표시합니다.
        </p>
      </div>

      {/* 3. Statutory Stage SSOT Status Card */}
      {(() => {
        const stageRes = resolveProjectStatutoryStage(selectedProjectId, filteredEvents);
        return (
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">현재 법정단계:</span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                  {stageRes.currentStage}
                </span>
                <span className="text-slate-300">→</span>
                <span className="text-xs font-semibold text-slate-500">다음 단계:</span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {stageRes.nextStage}
                </span>
              </div>
              {stageRes.lastVerifiedLegalEvent && (
                <div className="text-[11px] text-slate-400">
                  기준: {stageRes.lastVerifiedLegalEvent.eventDate} ({stageRes.lastVerifiedLegalEvent.noticeNumber || stageRes.lastVerifiedLegalEvent.title})
                </div>
              )}
            </div>
            {stageRes.subsequentPlanChangeEvidence && (
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                <span className="font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                  후속 변경고시
                </span>
                <span>
                  {stageRes.subsequentPlanChangeEvidence.eventDate} {stageRes.subsequentPlanChangeEvidence.title} ({stageRes.subsequentPlanChangeEvidence.noticeNumber})
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* 4. Timeline Items */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{projectName} 진행이력</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600">
                {sortedEvents.length}건
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              확인된 사건일자 기준 정비사업 주요 이벤트 및 행정 이력
            </p>
          </div>
        </div>

        {sortedEvents.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
            <h4 className="text-sm font-bold text-slate-700 mb-1">
              확인된 진행 이력이 없습니다.
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              현재 {projectName}에 대해 수집·검증된 공식 사건이 없습니다.
              실시간 뉴스 모니터링 및 향후 지자체 고시·공고 Backfill을 통해 검증된 사건만 기록됩니다.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-2.5 sm:before:left-3.5 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-slate-200">
            {sortedEvents.map((event, idx) => {
              const primarySource =
                event.primarySourceUrl
                  ? event.sources?.find((s) => s.url === event.primarySourceUrl) || event.sources?.[0]
                  : event.sources?.[0];

              const sourceName =
                primarySource?.source || (event as any).primarySource?.source || '부산 언론보도';

              const sourceTierInfo = getDisplaySourceTier(
                event.sourceTier || event.primarySourceTier,
                primarySource?.sourceType,
                sourceName
              );

              const originalUrl =
                event.primarySourceUrl || primarySource?.url || (event as any).primarySource?.url;

              const eventStage = event.eventType || event.category || '정비사업 진척';

              // 4. 핵심 행정 Milestone 판정 (조합설립인가 / 사업시행계획인가 / 관리처분계획인가 / 착공 / 일반분양 / 준공)
              const isKeyMilestone = [
                '조합설립인가',
                '사업시행계획인가',
                '사업시행인가',
                '관리처분계획인가',
                '관리처분계획 변경',
                '관리처분계획(변경)인가',
                '착공',
                '일반분양',
                '준공',
                '준공인가',
              ].some(
                (ms) =>
                  eventStage.includes(ms) ||
                  event.title.includes(ms)
              );

              // 1. actorType은 사건 주체 표기에만 사용 (association인 경우 '사건주체: 조합')
              const actorType =
                (event as any).actorType || (event.provenance as any)?.actorType;
              const actorLabel =
                actorType === 'association'
                  ? '조합'
                  : actorType === 'official'
                  ? '행정청'
                  : actorType === 'constructor'
                  ? '시공사'
                  : null;

              // 3. 링크 문구: documentUrlVerified 여부로 분기
              const isDocUrlVerified =
                (event as any).documentUrlVerified === true ||
                (event.provenance as any)?.documentUrlVerified === true;
              const linkText = isDocUrlVerified ? '원문 보기' : '출처 사이트';

              return (
                <div
                  key={event.id || `timeline-item-${idx}`}
                  id={`timeline-event-${event.id || idx}`}
                  className="relative group"
                >
                  {/* Timeline Dot */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-1.5 ${
                      isKeyMilestone ? 'w-4 h-4 -ml-[1px] ring-4 ring-blue-100' : 'w-3.5 h-3.5'
                    } rounded-full border-2 border-white shadow-xs ${sourceTierInfo.dotClass}`}
                  />

                  <div
                    className={`p-4 sm:p-5 rounded-xl border transition-all space-y-2.5 ${
                      isKeyMilestone
                        ? 'border-blue-200 bg-blue-50/25 shadow-xs hover:border-blue-300 hover:bg-blue-50/40'
                        : 'border-slate-200/90 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {/* Top Row: Date, Stage/Type, Milestone Tag, Source Tier, Verification */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 font-mono flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          {event.eventDate || event.publishedAt?.slice(0, 10) || '일자 미상'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isKeyMilestone
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {eventStage}
                        </span>
                        {actorLabel && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            주체: {actorLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* 1. 출처 배지: 반드시 sourceTier 기준 (공식자료/언론보도/사업주체) */}
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${sourceTierInfo.badgeClass}`}
                          title={sourceTierInfo.description}
                        >
                          {sourceTierInfo.label}
                        </span>

                        {/* 2. verificationStatus 명칭: verified -> '출처 확인', supported -> '보조 근거 확인' */}
                        {event.verificationStatus === 'verified' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                            <ShieldCheck className="w-3 h-3" />
                            출처 확인
                          </span>
                        )}
                        {event.verificationStatus === 'supported' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            보조 근거 확인
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h4
                      className={`text-sm sm:text-base font-bold leading-snug ${
                        isKeyMilestone ? 'text-slate-950 font-extrabold' : 'text-slate-900'
                      }`}
                    >
                      {event.title}
                    </h4>

                    {/* Summary */}
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {event.summary}
                    </p>

                    {/* Bottom Row: Source & Original Link */}
                    <div className="pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-slate-700">출처:</span>
                        <span>{sourceName}</span>
                        {(event as any).noticeNumber && (
                          <span className="text-[11px] text-slate-400 ml-1">
                            ({(event as any).noticeNumber})
                          </span>
                        )}
                      </div>

                      {originalUrl && originalUrl !== '#' ? (
                        <a
                          href={originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <span>{linkText}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">원문 링크 없음</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
