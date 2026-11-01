import React from 'react';
import { RedevelopmentProject } from '../types/redevelopment.ts';
import { MapPin, Tag, Building, Hash, ExternalLink, Layers } from 'lucide-react';

export const RegistryCard: React.FC<{ project: RedevelopmentProject }> = ({ project }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-700">
              <Hash className="w-3 h-3 mr-0.5" />
              {project.id}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {project.city} {project.district}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              모니터링 활성
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 leading-snug">
            {project.name}
          </h3>
        </div>
      </div>

      <p className="text-xs text-slate-600 mb-4 line-clamp-2 leading-relaxed">
        {project.description}
      </p>

      {/* 필수 필드 메타데이터 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
        <div>
          <div className="text-slate-400 mb-1 flex items-center gap-1 font-medium">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            시공사 및 규모
          </div>
          <div className="font-semibold text-slate-800">{project.builder || '-'}</div>
          <div className="text-slate-500 text-[11px] mt-0.5">
            계획: 약 {project.estimatedUnits?.toLocaleString()}세대 ({project.type})
          </div>
        </div>

        <div>
          <div className="text-slate-400 mb-1 flex items-center gap-1 font-medium">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            현재 사업 단계
          </div>
          <div className="font-semibold text-slate-800">{project.stage || '-'}</div>
          <div className="text-slate-500 text-[11px] mt-0.5">
            관할: {project.district}청 건축과
          </div>
        </div>
      </div>

      {/* Aliases (별칭) */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
          <Tag className="w-3.5 h-3.5 text-blue-600" />
          등록 별칭 (aliases)
          <span className="text-slate-400 font-normal">({project.aliases.length}개)</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {project.aliases.map((alias) => (
            <span
              key={alias}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-white text-slate-700 border border-slate-200"
            >
              {alias}
            </span>
          ))}
        </div>
      </div>

      {/* Location Keywords (위치 키워드) */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
          위치 키워드 (locationKeywords)
          <span className="text-slate-400 font-normal">({project.locationKeywords.length}개)</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {project.locationKeywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50/70 text-emerald-800 border border-emerald-200/60"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* Official Links */}
      {project.officialSourceUrls && project.officialSourceUrls.length > 0 && (
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>연계 공식 고시공고 소스</span>
          <div className="flex gap-2">
            {project.officialSourceUrls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5 hover:underline"
              >
                고시 링크 {idx + 1}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
