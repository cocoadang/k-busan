import React, { useState } from 'react';
import { Newspaper, ExternalLink, Calendar, Search } from 'lucide-react';
import { RawCollectedItem } from '../types/redevelopment.ts';

interface ProjectNewsViewProps {
  documents: (RawCollectedItem & { url?: string })[];
}

export const ProjectNewsView: React.FC<ProjectNewsViewProps> = ({ documents }) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  const filteredDocs = documents.filter((doc) => {
    // Project zone filter
    if (selectedFilter !== 'all') {
      const matchInProject = doc.projectId === selectedFilter;
      const matchInList = (doc as any).matchedProjectIds?.includes(selectedFilter);
      if (!matchInProject && !matchInList) return false;
    }

    // Search keyword filter
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      const inTitle = (doc.title || '').toLowerCase().includes(q);
      const inContent = (doc.content || '').toLowerCase().includes(q);
      const inSource = (doc.sourceName || '').toLowerCase().includes(q);
      if (!inTitle && !inContent && !inSource) return false;
    }

    return true;
  });

  const getProjectBadge = (doc: any) => {
    const ids: string[] = [];
    if (doc.projectId) ids.push(doc.projectId);
    if (doc.matchedProjectIds && Array.isArray(doc.matchedProjectIds)) {
      doc.matchedProjectIds.forEach((id: string) => {
        if (!ids.includes(id)) ids.push(id);
      });
    }

    const labels = ids.map((id) => {
      if (id === 'chokjin-3') return '촉진3구역';
      if (id === 'udong-3') return '우동3구역';
      if (id === 'samik-beach') return '삼익비치';
      if (id === 'gwacheon-5') return '과천 5단지';
      if (id === 'gwacheon-89') return '과천 8·9단지';
      if (id === 'gwacheon-10') return '과천 10단지';
      return id;
    });

    if (labels.length === 0) return '부산 정비사업';
    return labels.join(', ');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '발행일 미상';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.slice(0, 10);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return dateStr.slice(0, 10);
    }
  };

  return (
    <div id="project-news-view" className="space-y-4 sm:space-y-6 min-w-0">
      {/* Zone Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200 min-w-0">
        <div className="grid grid-cols-4 gap-1 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto min-w-0">
          <button
            id="news-filter-all"
            onClick={() => setSelectedFilter('all')}
            className={`min-h-[44px] px-1.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center break-keep ${
              selectedFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            전체
          </button>
          <button
            id="news-filter-chokjin-3"
            onClick={() => setSelectedFilter('chokjin-3')}
            className={`min-h-[44px] px-1 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center break-keep ${
              selectedFilter === 'chokjin-3'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            촉진3
          </button>
          <button
            id="news-filter-udong-3"
            onClick={() => setSelectedFilter('udong-3')}
            className={`min-h-[44px] px-1 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center break-keep ${
              selectedFilter === 'udong-3'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            우동3
          </button>
          <button
            id="news-filter-samik-beach"
            onClick={() => setSelectedFilter('samik-beach')}
            className={`min-h-[44px] px-1 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center break-keep ${
              selectedFilter === 'samik-beach'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            삼익비치
          </button>
          {([['gwacheon-5','과천 5단지'],['gwacheon-89','과천 8·9단지'],['gwacheon-10','과천 10단지']] as const).map(([id,label]) => (
            <button key={id} id={`news-filter-${id}`} onClick={() => setSelectedFilter(id)}
              className={`min-h-[44px] px-2 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${selectedFilter === id ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Keyword Search */}
        <div className="relative w-full sm:w-64 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="news-search-input"
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="기사 제목·키워드 검색..."
            className="w-full pl-9 pr-3.5 min-h-[44px] bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      {/* News Article List */}
      <div className="space-y-3 sm:space-y-4 min-w-0">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            총 <strong className="text-slate-900 font-bold">{filteredDocs.length}</strong>건의 기사 묶음
          </span>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs w-full min-w-0">
            <Newspaper className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700 mb-1 break-keep">
              수집된 뉴스가 없습니다.
            </h4>
            <p className="text-xs text-slate-500 break-keep">
              {searchKeyword
                ? '검색어와 일치하는 뉴스가 없습니다. 다른 검색어를 입력해 보세요.'
                : '현재 선택된 조건에 해당하는 관련 기사가 존재하지 않습니다.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredDocs.map((doc, idx) => {
              const url = doc.sourceUrl || doc.url || (doc as any).primarySourceUrl;
              const projectLabel = getProjectBadge(doc);

              return (
                <article
                  key={doc.id || `news-${idx}`}
                  id={`news-card-${doc.id || idx}`}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-3"
                >
                  {/* Meta Bar: Publisher, Published Date, Project Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        {doc.sourceName || '언론사'}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="flex items-center gap-1 font-mono text-slate-500">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDate(doc.publishedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {projectLabel}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {(doc.title || '').replace(/&nbsp;/gi, ' ')}
                  </h3>

                  {/* Summary */}
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {(doc.content || (doc as any).summary || '요약 정보가 없습니다.').replace(/&nbsp;/gi, ' ')}
                  </p>

                  {(doc as any).relatedReports?.length > 1 && (
                    <details className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                      <summary className="cursor-pointer font-semibold text-blue-700">관련 기사 · 재게시 출처 {(doc as any).relatedReports.length}건</summary>
                      <ul className="mt-2 space-y-2">
                        {(doc as any).relatedReports.map((report: any, index: number) => (
                          <li key={`${report.url}-${index}`}>
                            <span className="text-slate-400">{formatDate(report.publishedAt)} · </span>
                            <a href={report.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{report.sourceName || '출처'} — {report.title}</a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Bottom: Read Original */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                    {url && url !== '#' ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <span>원문 보기</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-slate-400 text-xs">원문 링크 없음</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
