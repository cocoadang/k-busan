import React from 'react';
import {
  CalendarClock,
  Cloud,
  FileSearch,
  CheckCircle2,
  Sparkles,
  GitMerge,
  Database,
  Send,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

export const ArchitectureFlow: React.FC = () => {
  const steps = [
    {
      id: 1,
      name: 'Cloud Scheduler',
      sub: '외부 cron 트리거 (30분 주기)',
      icon: CalendarClock,
      color: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    },
    {
      id: 2,
      name: 'Cloud Run',
      sub: '/api/jobs/poll 호출 수신',
      icon: Cloud,
      color: 'bg-blue-50 border-blue-200 text-blue-700',
    },
    {
      id: 3,
      name: '자료 수집',
      sub: '공식 고시(official) + 언론 보도(news)',
      icon: FileSearch,
      color: 'bg-sky-50 border-sky-200 text-sky-700',
    },
    {
      id: 4,
      name: '관련성 판별',
      sub: '촉진3/우동3 별칭 & 위치 키워드',
      icon: CheckCircle2,
      color: 'bg-teal-50 border-teal-200 text-teal-700',
    },
    {
      id: 5,
      name: 'Gemini AI 분석',
      sub: '13개 카테고리 & 중요도 1~5 평가',
      icon: Sparkles,
      color: 'bg-purple-50 border-purple-200 text-purple-700',
    },
    {
      id: 6,
      name: '이벤트 중복 병합',
      sub: '동일 사건 다수 언론보도 1건화',
      icon: GitMerge,
      color: 'bg-amber-50 border-amber-200 text-amber-700',
    },
    {
      id: 7,
      name: '전용 Firestore',
      sub: '독립 DB 격리 저장',
      icon: Database,
      color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    },
    {
      id: 8,
      name: 'Telegram 전송',
      sub: '중요도 >= 4 이벤트 브리핑',
      icon: Send,
      color: 'bg-rose-50 border-rose-200 text-rose-700',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            시스템 파이프라인 아키텍처 (System Pipeline)
          </h2>
          <p className="text-xs text-slate-500">
            내부 루프 없이 Cloud Scheduler가 외부에서 주기적으로 트리거하는 이벤트 주도형 구조
          </p>
        </div>
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>ENABLE_INTERNAL_SCHEDULER = false 준수</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="relative flex flex-col">
              <div
                className={`p-3 rounded-xl border ${step.color} flex-1 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-5 h-5 rounded-full bg-white/80 flex items-center justify-center text-[10px] font-bold text-slate-700 shadow-2xs">
                      {step.id}
                    </span>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold leading-tight mb-1">
                    {step.name}
                  </div>
                </div>
                <div className="text-[10px] opacity-80 leading-tight">
                  {step.sub}
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
