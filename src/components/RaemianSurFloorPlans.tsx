import { useState } from 'react';

type Plan = { label: string; area: string; image: string };

const published: Record<string, { source: string; plans: Plan[] }> = {
  '트리우스 광명': { source: '롯데캐슬 공식 분양 자료', plans: [
    {label: '59A', area: '59', image: 'https://www.lottecastle.co.kr/files/etc/2023/10/202310160136134080.jpg'},
    {label: '59B', area: '59', image: 'https://www.lottecastle.co.kr/files/etc/2023/10/202310160137050370.jpg'},
  ] },
  '이문아이파크자이': { source: '아이파크 공식 분양 자료', plans: ['59A', '59B', '59C'].map(label => ({
    label, area: '59', image: `https://cdn.i-park.com/ipark/imungrand/img/sub/1026/plane_${label.toLowerCase()}_01_grand.jpg`,
  })) },
};

export function hasInlineFloorPlans(name: string, area?: string) {
  return name === '래미안슈르' || name === '과천래미안슈르' || Boolean(published[name]?.plans.some(plan => !area || plan.area === area));
}

export function RaemianSurFloorPlans({ area, name = '래미안슈르' }: { area?: string; name?: string }) {
  const direct = published[name];
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const options = (direct?.plans ?? plans).filter(plan => !area || plan.area === area);
  const plan = options[selected];

  async function open() {
    if (direct || status === 'loading' || status === 'ready') return;
    setStatus('loading');
    try {
      const response = await fetch('/api/housing/floor-plans/raemian-sur', { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('FLOOR_PLAN_UNAVAILABLE');
      setPlans(await response.json() as Plan[]);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  return <details className="mt-3 w-full rounded-lg bg-slate-50 p-3" onToggle={event => { if (event.currentTarget.open) void open(); }}>
    <summary className="cursor-pointer font-semibold text-blue-800">평면도 보기</summary>
    {status === 'loading' && <p role="status" className="mt-2 text-sm">평면도 불러오는 중</p>}
    {status === 'error' && <p role="status" className="mt-2 text-sm">평면도를 불러오지 못했습니다. 닫았다가 다시 열어 주세요.</p>}
    {status === 'ready' && !plan && <p className="mt-2 text-sm">이 면적의 평면도가 아직 없습니다.</p>}
    {plan && (status === 'ready' || direct) && <figure className="mt-3 space-y-2">
      <label className="block text-sm">타입 <select className="ml-2 max-w-full rounded border border-slate-300 bg-white p-1" value={selected} onChange={event => setSelected(Number(event.target.value))}>
        {options.map((option, index) => <option key={option.label} value={index}>{option.label}</option>)}
      </select></label>
      <img className="mx-auto w-full max-w-xl rounded bg-white object-contain" alt={`${name} ${plan.label} 평면도`} loading="lazy" src={plan.image} referrerPolicy="no-referrer" />
      <figcaption className="text-xs text-slate-600">출처 {direct?.source ?? '제니의 스토리'}</figcaption>
    </figure>}
  </details>;
}
