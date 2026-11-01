import React, { useEffect, useState } from 'react';
import { ShieldCheck, Check } from 'lucide-react';

export const PrinciplesBanner: React.FC = () => {
  const [officialStatus, setOfficialStatus] = useState('상태 확인 중');
  useEffect(() => {
    let alive = true;
    fetch('/api/status').then(async response => {
      if (!response.ok) throw new Error('상태 조회 실패');
      const data = await response.json();
      const labels: Record<string, string> = { active: '최근 조회 정상', failed: '최근 조회 실패',
        disabled: '설정으로 비활성', unavailable: '인증키 미설정',
        'configured / upstream not yet verified': '설정됨 · 실제 조회 미확인' };
      if (alive) setOfficialStatus(labels[data.officialApiStatus] || '상태 미확인');
    }).catch(() => { if (alive) setOfficialStatus('상태 조회 실패'); });
    return () => { alive = false; };
  }, []);
  const principles = [
    '뉴스 RSS와 새올 공식 API 수집: 설정 및 실제 조회 결과로 상태 확인',
    'REAL DATA OR EXPLICIT FAILURE 원칙 준수: 가짜 mock 데이터 일체 생성 금지, 실제 수집 자료만 사용',
    '기존 프로젝트(K-News, K-Housing, KTX) 파일/DB 일체 미접근·미수정 격리 원칙 유지',
    '5대 프로덕션 Firestore 컬렉션(projects, documents, events, collectionCycles, telegramDeliveries) 멱등 저장',
    'Telegram 발송 조건: 관련성 충족 + confidence >= 0.75 + importance >= 4 + 최신성(72h) + 1회 발송 멱등성',
    '외부 Cloud Scheduler (/api/jobs/poll) 주기 호출 체계 (내부 스케줄러 금지, POLL_JOB_SECRET 보호)',
    '수집 주기 감사 로그 기록: "왜 알림이 없었는가" 설명 가능한 감사 추적 보장',
    'Phase 3A 안전 규정: Cloud Run 배포, Cloud Scheduler 생성, 파일 삭제/파괴적 명령 금지',
  ];

  return (
    <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs mb-8">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white tracking-tight">
            Phase 3A 프로덕션 파이프라인 원칙 및 격리 현황 (System Compliance & Isolation)
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300">
            news-rss: 활성
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-amber-300">
            official-api: {officialStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
        {principles.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-emerald-900/80 border border-emerald-500/50 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
              <Check className="w-2.5 h-2.5" />
            </span>
            <span className="leading-snug">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
