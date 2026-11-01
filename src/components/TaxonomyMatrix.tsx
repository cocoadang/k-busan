import React from 'react';
import { ALL_ANALYSIS_CATEGORIES, AnalysisCategory } from '../types/redevelopment.ts';
import { ShieldCheck, Newspaper, BellRing, GitMerge, Check, AlertCircle } from 'lucide-react';

export const TaxonomyMatrix: React.FC = () => {
  const categoryDescriptions: Record<AnalysisCategory, string> = {
    사업단계: '구역지정, 조합설립, 사업시행인가, 관리처분인가, 착공 등 진척',
    사업성: '비례율, 세대수 변경, 일반분양 비율, 사업수익성 변동',
    공사비: '3.3㎡당 공사비 증액 요구, 한국부동산원 검증, 시공사 협상',
    분담금: '조합원 추정 분담금 통지, 감정평가액, 추가 분담금 이슈',
    시공사: '입찰 공고, 우선협상대상자 선정, 시공권 해지 또는 재선정',
    설계: '외관 특화, 층수 상향/하향, 스카이브릿지, 세대 평면 변경',
    인허가: '건축심의, 경관심의, 교육영향평가, 교통영향평가, 고시공고',
    총회: '정기/임시 총회 공고, 대의원회, 조합 임원 해임/선출 안건',
    분쟁: '비대위 결성, 조합장 직무정지 가처분, 시공사 법적 소송',
    분양: '일반분양 일정, 모델하우스 오픈, 분양가 심의 결과',
    청약: '특별공급/일반공급 청약 경쟁률, 미분양/완판 동향',
    주변개발: '부전역 복합환승센터, 해운대 관광특구, 인근 구역 연계 호재',
    시장: '부산 부동산 시장 심리, 규제지역 완화/지정, 금리 및 대출 동향',
  };

  const importanceScales = [
    {
      level: 5,
      label: '결정적 변화',
      color: 'bg-rose-50 text-rose-800 border-rose-200',
      badge: 'bg-rose-600 text-white',
      desc: '시공사 교체/선정 확정, 조합인가 취소, 관리처분인가 완료, 공사 전면 중단 등 사업 향방을 결정짓는 핵심 사건',
      telegram: true,
    },
    {
      level: 4,
      label: '주요 사업 변곡점',
      color: 'bg-orange-50 text-orange-800 border-orange-200',
      badge: 'bg-orange-500 text-white',
      desc: '공사비 증액 갈등 표면화, 시공사 입찰 공고, 정비계획 중대 변경 고시, 정기총회 핵심 안건 가결/부결',
      telegram: true,
    },
    {
      level: 3,
      label: '일반 사업 진척',
      color: 'bg-blue-50 text-blue-800 border-blue-200',
      badge: 'bg-blue-500 text-white',
      desc: '통상적 총회 소집 공고, 정비계획 경미한 변경, 환경영향평가 주민공람, 일상 행정 인허가 접수',
      telegram: false,
    },
    {
      level: 2,
      label: '통상 보도 및 시황',
      color: 'bg-slate-50 text-slate-800 border-slate-200',
      badge: 'bg-slate-400 text-white',
      desc: '인근 재개발 시세 언급, 부산 정비사업 종합 기획 기사 내 단순 사례 언급, 부동산 전문가 칼럼',
      telegram: false,
    },
    {
      level: 1,
      label: '단순 언급 / 노이즈',
      color: 'bg-slate-50 text-slate-600 border-slate-200',
      badge: 'bg-slate-300 text-slate-700',
      desc: '기사 본문 말미의 단순 단지명 나열, 사업과 무관한 주변 지리적 명칭 언급 등 노이즈 데이터',
      telegram: false,
    },
  ];

  return (
    <div className="space-y-6 mb-8">
      {/* 13대 분석 카테고리 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              정비사업 13대 AI 분석 카테고리
            </h2>
            <p className="text-xs text-slate-500">
              Gemini 모델이 수집된 기사/공식자료를 분석할 때 분류하는 표준 도메인 범주
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            총 13개 카테고리
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {ALL_ANALYSIS_CATEGORIES.map((cat, idx) => (
            <div
              key={cat}
              className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                  {idx + 1}
                </span>
                <span className="text-xs font-bold text-slate-800">{cat}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                {categoryDescriptions[cat]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 중요도 평가 및 텔레그램 발송 기준 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                중요도 1~5 평가 및 Telegram 발송 기준
              </h2>
              <p className="text-xs text-slate-500">
                중요도 4 이상인 핵심 이벤트만 Telegram 알림 발송
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-rose-100 text-rose-800">
              <BellRing className="w-3.5 h-3.5" />
              <span>발송 기준: &gt;= 4</span>
            </div>
          </div>

          <div className="space-y-2">
            {importanceScales.map((scale) => (
              <div
                key={scale.level}
                className={`p-3 rounded-lg border ${scale.color} flex items-start justify-between gap-3`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 ${scale.badge}`}
                  >
                    Level {scale.level}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-900 mb-0.5">
                      {scale.label}
                    </div>
                    <div className="text-[11px] opacity-90 leading-snug">
                      {scale.desc}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {scale.telegram ? (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white">
                      <Check className="w-2.5 h-2.5" />
                      텔레그램 발송
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                      저장만 (알림 제외)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 소스 티어 및 이벤트 병합 원칙 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Source Tier 구분 & 이벤트 중복 병합 원칙
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              공식 고시와 언론 기사를 분리하고, 다수 매체의 동일 사건을 단일 이벤트로 압축
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900">
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  sourceTier: official
                </div>
                <div className="text-[11px] text-emerald-800 leading-snug">
                  부산시보, 부산진구보, 해운대구보 등 지자체 인허가 고시·공고 원문. 행정적 구속력을 갖는 1차 공식 자료.
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-900">
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <Newspaper className="w-4 h-4 text-blue-700" />
                  sourceTier: news
                </div>
                <div className="text-[11px] text-blue-800 leading-snug">
                  부산일보, 국제신문, 연합뉴스, 경제지 등 언론 보도. 시장 반응, 분쟁 정황, 시공사 제안 등 심층 정황.
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-1.5">
                <GitMerge className="w-4 h-4 text-purple-600" />
                이벤트 중복 병합 (Event Deduplication)
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed mb-2">
                예를 들어 촉진3구역 시공사 공사비 합의 또는 총회 결과에 대해 5개 언론사가 일제히 보도한 경우,
                개별 기사마다 텔레그램 메시지를 5회 발송하지 않고 <strong>1건의 통합 이벤트(RedevelopmentEvent)</strong>로
                병합하여 단일 브리핑 메시지만 발송합니다.
              </p>
              <div className="text-[11px] text-slate-500 flex items-center gap-1 bg-white p-2 rounded border border-slate-100">
                <AlertCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>병합 기준: 동일 프로젝트 + 동일 사건 시그니처 + 72시간 윈도우</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
