import React,{useEffect,useState} from 'react';
export function AnalysisQueueStatus(){
  const [stats,setStats]=useState<Record<string,number>|null>(null);
  useEffect(()=>{let active=true;const read=()=>fetch('/api/analysis-queue').then(async r=>{if(!r.ok)throw Error();return r.json();}).then(j=>{if(active)setStats(j.stats);}).catch(()=>{});read();const timer=setInterval(read,60000);return()=>{active=false;clearInterval(timer);};},[]);
  if(!stats)return null;
  const pending=(stats.pending||0)+(stats.retry||0)+(stats.ready||0);
  return <details className="mb-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700">
    <summary className="flex min-h-[44px] cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <span className={`h-2 w-2 rounded-full ${pending?'bg-blue-600':'bg-emerald-600'}`} aria-hidden="true"/>
      <span>{pending?`분석·저장 대기 ${pending}건`:'자동 분석 대기 없음'}</span>
      {!!stats.needs_review&&<span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-900">확인 필요 {stats.needs_review}건</span>}
      <span className="ml-auto text-slate-500">처리 현황 보기⌄</span>
    </summary>
    <div className="border-t border-slate-100 px-4 py-3 leading-7" role="status">
      자료 분석 대기 {stats.pending||0}건 · 재시도 대기 {stats.retry||0}건 · 저장 중 {stats.ready||0}건 · 확인 필요 {stats.needs_review||0}건 · 검토 종결(사건 미등록) {stats.closed||0}건
      <p className="text-slate-600">미처리 자료는 다음 수집 때 이어서 분석합니다.</p>
    </div>
  </details>;
}
