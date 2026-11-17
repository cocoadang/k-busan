import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import DATA from '../data/busanHousingMap.json';
import type { BusanPrices } from '../housing/busanPriceApi';
import type { ExtractedEvent } from '../types/redevelopment';
import { getHousingApartmentLink, getHousingLink } from '../utils/housingLinks';
import { HousingDestinationList } from './HousingDestinationList';
import './housingMap.css';
import { mapPriceLabel } from '../housing/mapDisplay';
import { mapSelectionFromHash, mapSelectionHash } from '../housing/mapSelection';
import { resolveProjectStatutoryStage } from '../utils/redevelopmentStages';

const allPoints: L.LatLngTuple[] = [...DATA.apartments, ...DATA.projects].map(p => [p.latitude, p.longitude]);
const bounds = L.latLngBounds(allPoints).pad(0.15);
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const HousingMapView: React.FC<{events?: ExtractedEvent[]}> = ({events = []}) => {
  const container = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), layers = useRef<L.LayerGroup | null>(null);
  const selectionInfo = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [area, setArea] = useState<'59'|'84'>('84');
  const [prices, setPrices] = useState<BusanPrices | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const [apartmentsOn, setApartmentsOn] = useState(true), [projectsOn, setProjectsOn] = useState(true), [outlinesOn, setOutlinesOn] = useState(true);
  const [selected, setSelected] = useState<string | null>(() => mapSelectionFromHash(window.location.hash)), [tilesError, setTilesError] = useState(false);
  const interacted = useRef(false);
  const choose = (id: string | null) => {
    interacted.current = id !== selected;
    setSelected(id);
    if (DATA.apartments.some(a=>a.id===id)) setApartmentsOn(true);
    if (DATA.projects.some(p=>p.id===id)) setProjectsOn(true);
    const hash = mapSelectionHash(id, window.location.hash);
    if (window.location.hash !== hash) window.location.hash = hash;
    if (!id) map.current?.fitBounds(bounds,{padding:[48,48]});
  };
  useEffect(() => {
    const sync = () => { const next = mapSelectionFromHash(window.location.hash); setSelected(next); if(DATA.apartments.some(a=>a.id===next)) setApartmentsOn(true); if(DATA.projects.some(p=>p.id===next)) setProjectsOn(true); if(!next) map.current?.fitBounds(bounds,{padding:[48,48]}); };
    window.addEventListener('hashchange',sync); window.addEventListener('popstate',sync);
    return () => { window.removeEventListener('hashchange',sync); window.removeEventListener('popstate',sync); };
  },[]);
  const currentPrices = prices?.areaCategory === area ? prices : null;
  useEffect(() => {
    const controller = new AbortController(); let active = true; setError(false); setPrices(null);
    fetch('/api/housing/busan-prices?areaCategory=' + area, {signal:controller.signal}).then(async r => {
      if (!r.ok) throw new Error('가격 조회 실패'); const data = await r.json();
      if (data.areaCategory !== area) throw new Error('면적 불일치'); if (active) setPrices(data);
    }).catch(e => { if (active && e.name !== 'AbortError') setError(true); });
    return () => { active = false; controller.abort(); };
  }, [area,retry]);
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {scrollWheelZoom:true, zoomControl:false, minZoom:10, maxZoom:19}); map.current = instance;
    instance.fitBounds(bounds, {padding:[48,48]});
    L.control.zoom({zoomInTitle:'지도 확대',zoomOutTitle:'지도 축소'}).addTo(instance);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      referrerPolicy:'strict-origin-when-cross-origin', updateWhenIdle:true, keepBuffer:1,
    }).on('tileerror', () => setTilesError(true)).addTo(instance);
    layers.current = L.layerGroup().addTo(instance);
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => instance.invalidateSize({animate:false,pan:true,debounceMoveend:true}));
    }); observer.observe(container.current);
    return () => { observer.disconnect(); cancelAnimationFrame(resizeFrame); instance.remove(); map.current = null; layers.current = null; };
  }, []);
  useEffect(() => {
    const group = layers.current; if (!group) return; group.clearLayers();
    if (apartmentsOn && outlinesOn) L.geoJSON(DATA.apartmentFootprints as GeoJsonObject, {
      style:{color:'#047857',weight:2,fillColor:'#10b981',fillOpacity:0.14},
      onEachFeature:(f, layer) => { layer.on('click', () => choose(f.properties.complexId)); },
    }).addTo(group);
    if (apartmentsOn) DATA.apartments.forEach(a => {
      const label = error ? '조회 실패' : mapPriceLabel(currentPrices?.summaries[a.id]);
      const labelPosition = a.id==='busan_centum_park_2'?'right':a.id==='busan_namcheon_xi'?'lower':'left';
      const icon = L.divIcon({className:`busan-map-icon ${selected===a.id?'is-selected':''}`, iconSize:[1,1], iconAnchor:[0,0], html:`<span class="busan-map-dot"></span><span class="busan-price-tag ${labelPosition}"><span class="busan-marker-name">${escape(a.name)}</span><b>${escape(label)}</b></span>`});
      const marker = L.marker([a.latitude,a.longitude],{icon,title:a.name,keyboard:true,zIndexOffset:selected===a.id?1000:0}).addTo(group).on('click',()=>choose(a.id));
      marker.getElement()?.setAttribute('aria-label',`아파트 ${a.name} ${label}`);
    });
    if (projectsOn) DATA.projects.forEach(p => {
      const icon = L.divIcon({className:`busan-map-icon ${selected===p.id?'is-selected':''}`,iconSize:[1,1],iconAnchor:[0,0],html:`<span class="busan-project-dot"></span><span class="busan-project-tag">${escape(p.name.replace(' 정비사업',''))}<span class="busan-marker-name">정비사업 위치</span></span>`});
      const marker=L.marker([p.latitude,p.longitude],{icon,title:p.name,keyboard:true,zIndexOffset:selected===p.id?1000:100}).addTo(group).on('click',()=>choose(p.id));
      marker.getElement()?.setAttribute('aria-label',`정비사업 ${p.name} 위치 마커`);
    });
    return () => { group.clearLayers(); };
  },[area,currentPrices,error,apartmentsOn,projectsOn,outlinesOn,selected]);
  useEffect(() => {
    const p=[...DATA.apartments,...DATA.projects].find(p=>p.id===selected);
    if (p) {
      map.current?.setView([p.latitude,p.longitude],15,{animate:false});
      if (interacted.current && window.matchMedia('(max-width: 1023px)').matches) selectionInfo.current?.scrollIntoView({block:'nearest',behavior:'instant'});
      if (window.matchMedia('(min-width: 1024px)').matches) selectionInfo.current?.parentElement?.scrollTo({top:0,behavior:'instant'});
    }
    interacted.current = false;
  },[selected]);
  const apartment=DATA.apartments.find(a=>a.id===selected), project=DATA.projects.find(p=>p.id===selected);
  const pricedApartment=apartment || (project?.id==='samik-beach' ? DATA.apartments.find(a=>a.id==='busan_samick_beach') : undefined);
  const summary=pricedApartment ? currentPrices?.summaries[pricedApartment.id] : undefined;
  const projectStage=project && resolveProjectStatutoryStage(project.id, events.filter(e=>e.projectId===project.id)).currentStage;
  const financialLink=project && getHousingLink(project.id);
  const monthLabel = (month?: string | null) => month ? `${month.slice(0,4)}.${month.slice(4)} 거래월 중앙값` : '최근 거래월 중앙값';
  return <section aria-label="부산 아파트·정비사업 지도" className="housing-map-view space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold tracking-tight text-slate-900">부산 지도·시세</h2><p className="mt-1 text-sm text-slate-600">아파트 4곳 · 정비사업 3곳</p></div>
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" aria-label="실거래가 면적군">{(['59','84'] as const).map(a=><button key={a} type="button" aria-pressed={a===area} onClick={()=>setArea(a)} className={`min-h-[40px] rounded-lg px-4 text-sm font-bold ${a===area?'bg-blue-700 text-white shadow-sm':'text-slate-700 hover:bg-slate-100'}`}>{a}㎡급</button>)}</div>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
      <label className="inline-flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={apartmentsOn} onChange={e=>setApartmentsOn(e.target.checked)}/>실거래가</label>
      <label className="inline-flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={projectsOn} onChange={e=>setProjectsOn(e.target.checked)}/>정비사업</label>
      <label className="inline-flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={outlinesOn} onChange={e=>setOutlinesOn(e.target.checked)}/>아파트 필지</label>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={()=>choose(null)} className="min-h-[44px] rounded-lg px-3 font-semibold hover:bg-slate-100">부산 전체</button>
        <button type="button" aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)} className="min-h-[44px] rounded-lg px-3 font-semibold text-blue-700 hover:bg-blue-50">{expanded?'지도 기본 크기로':'지도 크게 보기'}</button>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-700"/>아파트·가격</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-700"/>정비사업 위치</span>
      <span className="text-slate-500">사업구역 경계는 표시하지 않습니다.</span>
    </div>
    {error && <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">실거래가를 불러오지 못했습니다. 위치와 목록은 이용할 수 있습니다. <button type="button" onClick={()=>setRetry(v=>v+1)} className="min-h-[44px] px-2 font-bold underline">가격 다시 조회</button></div>}
    {tilesError && <p role="status" className="text-sm text-amber-800">배경지도의 일부를 불러오지 못했습니다. 단지 목록에서 위치를 선택할 수 있습니다.</p>}
    <div className={`grid min-w-0 items-start gap-3 ${expanded?'':'lg:grid-cols-[minmax(0,1fr)_320px]'}`}>
      <div className={`relative min-w-0 min-h-[360px] ${expanded?'h-[max(560px,75dvh)]':'h-[52dvh] lg:min-h-[480px] lg:h-[min(70dvh,640px)]'}`}>
        {/* Leaflet owns this element's classes; only the outer wrapper resizes. */}
        <div ref={container} role="region" aria-label="부산 통합 지도" className="busan-leaflet-map isolate absolute inset-0 z-0 h-full w-full rounded-xl border border-slate-200"/>
        {selected && <button type="button" onClick={()=>selectionInfo.current?.scrollIntoView({block:'nearest',behavior:'instant'})} className="absolute bottom-7 right-3 z-[500] min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm lg:hidden">선택 정보 보기 ↓</button>}
      </div>
      <aside aria-label="지도 선택 정보" className={`housing-map-sidebar min-w-0 space-y-3 ${expanded?'lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0':'lg:max-h-[max(480px,min(70dvh,640px))] lg:overflow-y-auto lg:overscroll-contain lg:pr-1'}`}>
        <div ref={selectionInfo} tabIndex={-1} aria-live="polite" aria-atomic="true" className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4">
          {!selected && <><p className="text-base font-bold text-slate-900">어디가 궁금하세요?</p><p className="mt-2 text-sm leading-6 text-slate-600">지도나 목록에서 단지를 선택하면 가격과 사업 정보를 함께 볼 수 있습니다.</p></>}
          {selected && <>
            <span className={`inline-block rounded-full px-2 py-1 text-xs font-bold ${apartment?'bg-emerald-50 text-emerald-800':'bg-purple-50 text-purple-800'}`}>{apartment?'아파트 실거래가':'정비사업 · 위치'}</span>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900">{apartment?.name || project?.name}</h3>
            {pricedApartment && <div className="mt-3 border-t border-slate-100 pt-3"><div className="flex items-baseline justify-between gap-2"><span className="text-sm text-slate-600">{area}㎡급{project?' 기존 아파트':''}</span><strong className="text-2xl font-extrabold tabular-nums text-emerald-800">{error?'조회 실패':mapPriceLabel(summary)}</strong></div><p className="mt-1 text-sm text-slate-500">{monthLabel(summary?.month)}</p></div>}
            {projectStage && <p className="mt-3 text-sm leading-6 text-slate-700"><span className="text-slate-500">사업 단계</span><br/><strong>{projectStage}</strong></p>}
            {project && <><a href={`#/status/${project.id}`} className="mt-3 flex min-h-[44px] items-center justify-center rounded-lg bg-blue-700 px-3 text-sm font-bold text-white hover:bg-blue-800">사업현황·진행 정보</a><details className="mt-3 text-sm leading-6 text-slate-600"><summary className="cursor-pointer py-1">사업 위치·공식 자료 안내</summary><p className="mt-2">{project.positionNote}</p><p className="mt-2">{project.boundaryNote}</p><a href={project.officialMapUrl} target="_blank" rel="noopener noreferrer" className="block py-2 text-blue-700 underline">부산시 공식 위치도 ↗</a>{financialLink && <a href={financialLink.href} target="_blank" rel="noopener noreferrer" className="block py-2 text-blue-700 underline">{financialLink.label} ↗</a>}</details></>}
            {pricedApartment && <a href={getHousingApartmentLink(pricedApartment.id)!} target="_blank" rel="noopener noreferrer" className={`mt-2 flex min-h-[44px] items-center justify-center rounded-lg px-3 text-sm font-bold ${project?'border border-slate-200 text-blue-700 hover:bg-blue-50':'bg-blue-700 text-white hover:bg-blue-800'}`}>실거래가 상세 분석 ↗</a>}
            {apartment?.id==='busan_samick_beach' && <a className="mt-2 block py-2 text-center text-sm font-semibold text-blue-700" href="#/status/samik-beach">삼익비치 사업현황 보기</a>}
          </>}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">아파트 <span className="font-normal text-slate-500">4곳 · {area}㎡급</span></h3>
          {DATA.apartments.map(a=>{const s=currentPrices?.summaries[a.id];return <button key={a.id} type="button" aria-pressed={selected===a.id} onClick={()=>choose(a.id)} className={`housing-place-row flex min-h-[68px] w-full items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-left ${selected===a.id?'bg-emerald-50 ring-2 ring-inset ring-emerald-700':'hover:bg-slate-50'}`}><span className="min-w-0"><span className="block text-sm font-bold text-slate-900">{selected===a.id?'✓ ':''}{a.name}</span><span className="mt-1 block text-sm text-slate-500">{s?.month?`${s.month.slice(0,4)}.${s.month.slice(4)} 거래월`:'최근 거래월 기준'}</span></span><strong className="shrink-0 text-lg font-bold tabular-nums text-emerald-800">{error?'조회 실패':mapPriceLabel(s)}</strong></button>;})}
          <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">정비사업 <span className="font-normal text-slate-500">3곳 · 위치 표시</span></h3>
          {DATA.projects.map(p=><button key={p.id} type="button" aria-pressed={selected===p.id} onClick={()=>choose(p.id)} className={`housing-place-row flex min-h-[48px] w-full items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-left text-sm ${selected===p.id?'bg-purple-50 font-bold ring-2 ring-inset ring-purple-700 text-purple-900':'text-slate-800 hover:bg-slate-50'}`}><span>{selected===p.id?'✓ ':''}{p.name}</span><span className="shrink-0 text-purple-700" aria-hidden="true">→</span></button>)}
        </div>
      </aside>
    </div>
    <details className="rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600"><summary className="min-h-[44px] cursor-pointer py-3 font-semibold text-slate-700">지도 범례 · 가격 기준 · 출처</summary><div className="space-y-2 pb-4 leading-6"><p>녹색 외곽은 기존 아파트의 참고용 필지입니다. 보라색은 정비사업 대표 위치이며 사업구역 경계가 아닙니다.</p><p>가격: K-housing·국토교통부 실거래가의 최근 거래월 중앙값. 단지별 실제 전용면적은 상세 분석에서 확인하세요.{currentPrices ? ` 조회 ${new Date(currentPrices.fetchedAt).toLocaleString('ko-KR')}.` : ''}</p><p>아파트 필지: {DATA.attribution} · {DATA.checkedAt} 확인. 표시 경계는 측량 성과가 아닙니다.</p><p>PC: 드래그로 이동 · 휠로 확대/축소. 휴대전화: 손가락으로 이동 · 두 손가락으로 확대/축소.</p></div></details>
    <details className="rounded-xl border border-slate-200 bg-white px-4"><summary className="min-h-[44px] cursor-pointer py-3 text-sm font-semibold text-slate-700">전국 지도·단지 상세 링크</summary><div className="pb-4"><HousingDestinationList /></div></details>
  </section>;
};
