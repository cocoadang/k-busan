import { ProjectSelector } from './ProjectSelector.tsx';
import React, { useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { FirestoreAreaDevelopmentDoc } from '../schema/firestoreSchema.ts';

interface AreaDevelopmentsViewProps {
  areaDevelopments: FirestoreAreaDevelopmentDoc[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
}

export const AreaDevelopmentsView: React.FC<AreaDevelopmentsViewProps> = ({
  areaDevelopments,
  selectedProjectId: initialProjectId = 'chokjin-3',
  onSelectProject,
}) => {
  const [activeProject, setActiveProject] = useState<string>(initialProjectId);

  const handleSelect = (id: string) => {
    setActiveProject(id);
    if (onSelectProject) {
      onSelectProject(id);
    }
  };

  // Filter developments for the active project
  const filteredDevelopments = areaDevelopments.filter((dev) =>
    dev.affectedProjectIds?.includes(activeProject)
  );

  // Sorting: direct first, then regional
  const sortedDevelopments = [...filteredDevelopments].sort((a, b) => {
    if (a.relevanceLevel === 'direct' && b.relevanceLevel !== 'direct') return -1;
    if (a.relevanceLevel !== 'direct' && b.relevanceLevel === 'direct') return 1;
    return a.title.localeCompare(b.title, 'ko');
  });

  const getRelevanceLabel = (level: string) => {
    switch (level) {
      case 'direct':
        return '직접 영향';
      case 'regional':
        return '권역 영향';
      default:
        return level;
    }
  };

  const getRelevanceBadgeClass = (level: string) => {
    switch (level) {
      case 'direct':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'regional':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getImpactDirectionLabel = (direction: string) => {
    switch (direction) {
      case 'positive':
        return '긍정';
      case 'negative':
        return '부정';
      case 'mixed':
        return '복합';
      case 'uncertain':
        return '불확실';
      default:
        return direction;
    }
  };

  const getImpactBadgeClass = (direction: string) => {
    switch (direction) {
      case 'positive':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'negative':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'mixed':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'uncertain':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div id="area-developments-view" className="space-y-4 sm:space-y-6 min-w-0">
      {/* 1. Project Selector Tabs: [촉진3구역] [우동3구역] [삼익비치] */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200 min-w-0">
        <ProjectSelector selectedId={activeProject} onSelect={handleSelect} idPrefix="tab-dev" />

        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium shrink-0 self-end sm:self-auto">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="break-keep">관련 개발계획 {sortedDevelopments.length}건</span>
        </div>
      </div>

      {/* 2. Development Cards List */}
      {sortedDevelopments.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
          해당 사업지에 연결된 확인된 개발계획이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedDevelopments.map((dev) => {
            const linkText = dev.documentUrlVerified ? '원문 보기' : '출처 사이트';
            const statusDisplay = dev.planStage
              ? `${dev.status} · ${dev.planStage}`
              : dev.status;

            return (
              <div
                key={dev.developmentId}
                id={`development-card-${dev.developmentId}`}
                className="p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Category & Relevance & Impact Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* 카테고리 */}
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {dev.category}
                    </span>

                    {/* 진행상태 */}
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                      {statusDisplay}
                    </span>

                    {/* 관련성: 직접 영향 / 권역 영향 */}
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getRelevanceBadgeClass(
                        dev.relevanceLevel
                      )}`}
                    >
                      {getRelevanceLabel(dev.relevanceLevel)}
                    </span>

                    {/* 영향방향: 긍정 / 복합 / 불확실 / 부정 */}
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getImpactBadgeClass(
                        dev.impactDirection
                      )}`}
                    >
                      {getImpactDirectionLabel(dev.impactDirection)}
                    </span>
                  </div>

                  {/* 계획명 */}
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {dev.title}
                  </h3>

                  {/* 간단한 영향 설명 */}
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {dev.impactReason}
                  </p>
                </div>

                {/* Footer: Source & Link */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="text-slate-500 font-medium">
                    <span>출처: </span>
                    <span className="text-slate-700 font-semibold">{dev.sourceName}</span>
                  </div>

                  {dev.sourceUrl && (
                    <a
                      href={dev.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                    >
                      <span>{linkText}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
