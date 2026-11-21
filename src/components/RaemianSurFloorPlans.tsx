import { useState } from 'react';

type Plan = { label: string; area: string; image: string };

export function hasInlineFloorPlans(name: string, area?: string) {
  return name === '래미안슈르' || name === '과천래미안슈르' ||
    ((!area || area === '59') && ['이문아이파크자이', '트리우스 광명'].includes(name));
}

export function RaemianSurFloorPlans({ area, name = '래미안슈르' }: { area?: string; name?: string }) {
  const catalogName = name === '래미안슈르' ? '과천래미안슈르' : name;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const options = plans.filter(plan => !area || plan.area === area);
  const plan = options[selected];

  async function open() {
    if (status === 'loading' || status === 'ready') return;
    setStatus('loading');
    try {
      const response = await fetch('/api/housing/floor-plans/raemian-sur?' + new URLSearchParams({ name: catalogName }), { signal: AbortSignal.timeout(12000) });
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
    {status === 'ready' && !plan && <p className="mt-2 text-sm">{area && plans.length ? '해당 전용면적의 도면이 아직 등록되지 않았습니다.' : '확인된 평면도 이미지가 아직 등록되지 않았습니다.'}</p>}
    {plan && <figure className="mt-3 space-y-2">
      <label className="block text-sm">타입 <select className="ml-2 max-w-full rounded border border-slate-300 bg-white p-1" value={selected} onChange={event => setSelected(Number(event.target.value))}>
        {options.map((option, index) => <option key={option.label} value={index}>{option.label}</option>)}
      </select></label>
      <img className="mx-auto w-full max-w-xl rounded bg-white object-contain" alt={`${name} ${plan.label} 평면도`} loading="lazy" src={plan.image} referrerPolicy="no-referrer" />
      <figcaption className="text-xs text-slate-600">서버에 저장된 평면도</figcaption>
    </figure>}
  </details>;
}
