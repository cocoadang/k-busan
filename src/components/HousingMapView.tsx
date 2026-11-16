import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import DATA from '../data/busanHousingMap.json';
import type { BusanPrices } from '../housing/busanPriceApi';
import type { RedevelopmentProject } from '../types/redevelopment';
import { getHousingApartmentLink, getHousingLink } from '../utils/housingLinks';
import { HousingDestinationList } from './HousingDestinationList';
import './housingMap.css';
import { mapPriceLabel } from '../housing/mapDisplay';

const allPoints: L.LatLngTuple[] = [...DATA.apartments, ...DATA.projects].map(p => [p.latitude, p.longitude]);
const bounds = L.latLngBounds(allPoints).pad(0.15);
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const HousingMapView: React.FC<{projects?: RedevelopmentProject[]}> = ({projects = []}) => {
  const container = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), layers = useRef<L.LayerGroup | null>(null);
  const [area, setArea] = useState<'59'|'84'>('84');
  const [prices, setPrices] = useState<BusanPrices | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const [apartmentsOn, setApartmentsOn] = useState(true), [projectsOn, setProjectsOn] = useState(true), [outlinesOn, setOutlinesOn] = useState(true);
  const [selected, setSelected] = useState<string | null>(null), [tilesError, setTilesError] = useState(false);
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
    const instance = L.map(container.current, {scrollWheelZoom:false, zoomControl:false, minZoom:10, maxZoom:19}); map.current = instance;
    instance.fitBounds(bounds);
    L.control.zoom({zoomInTitle:'지도 확대',zoomOutTitle:'지도 축소'}).addTo(instance);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      referrerPolicy:'strict-origin-when-cross-origin', updateWhenIdle:true, keepBuffer:1,
    }).on('tileerror', () => setTilesError(true)).addTo(instance);
    layers.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize({pan:false})); observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; layers.current = null; };
  }, []);
  useEffect(() => {
    const group = layers.current; if (!group) return; group.clearLayers();
    if (apartmentsOn && outlinesOn) L.geoJSON(DATA.apartmentFootprints as GeoJsonObject, {
      style:{color:'#047857',weight:2,fillColor:'#10b981',fillOpacity:0.14},
      onEachFeature:(f, layer) => { layer.on('click', () => setSelected(f.properties.complexId)); },
    }).addTo(group);
    if (apartmentsOn) DATA.apartments.forEach((a,index) => {
      const label = error ? '조회 실패' : mapPriceLabel(currentPrices?.summaries[a.id]);
      const icon = L.divIcon({className:'busan-map-icon', iconSize:[1,1], iconAnchor:[0,0], html:`<span class="busan-map-dot"></span><span class="busan-price-tag ${index % 2 ? 'right' : 'left'}">${escape(a.name)}<b>${escape(label)}</b></span>`});
      const marker = L.marker([a.latitude,a.longitude],{icon,title:a.name,keyboard:true}).addTo(group).on('click',()=>setSelected(a.id));
      marker.getElement()?.setAttribute('aria-label',`아파트 ${a.name} ${label}`);
    });
    if (projectsOn) DATA.projects.forEach(p => {
      const icon = L.divIcon({className:'busan-map-icon',iconSize:[1,1],iconAnchor:[0,0],html:`<span class="busan-project-dot"></span><span class="busan-project-tag">${escape(p.name)} · 위치</span>`});
      const marker=L.marker([p.latitude,p.longitude],{icon,title:p.name,keyboard:true,zIndexOffset:100}).addTo(group).on('click',()=>setSelected(p.id));
      marker.getElement()?.setAttribute('aria-label',`정비사업 ${p.name} 위치 마커`);
    });
    return () => { group.clearLayers(); };
  },[area,currentPrices,error,apartmentsOn,projectsOn,outlinesOn]);
  useEffect(() => {
    const p=[...DATA.apartments,...DATA.projects].find(p=>p.id===selected);
    if (p) map.current?.setView([p.latitude,p.longitude],15,{animate:false});
  },[selected]);
  const apartment=DATA.apartments.find(a=>a.id===selected), project=DATA.projects.find(p=>p.id===selected);
  const summary=apartment ? currentPrices?.summaries[apartment.id] : undefined;
  const liveProject=project && projects.find(p=>p.id===project.id);
  const financialLink=project && getHousingLink(project.id);
  return <section aria-label="부산 아파트·정비사업 지도" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold text-slate-900">부산 지도·시세</h2><p className="text-sm text-slate-600 mt-1">등록 아파트 4곳과 촉진3·우동3·삼익비치 정비사업을 함께 봅니다.</p></div>
      <div className="flex gap-2" aria-label="실거래가 면적군">{(['59','84'] as const).map(a=><button key={a} type="button" aria-pressed={a===area} onClick={()=>setArea(a)} className={`rounded-lg px-3 py-2 min-h-[44px] text-sm font-bold ${a===area?'bg-blue-700 text-white':'bg-white border border-slate-300 text-slate-700'}`}>{a}㎡급</button>)}</div>
    </div>
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <label><input type="checkbox" checked={apartmentsOn} onChange={e=>setApartmentsOn(e.target.checked)} className="mr-2"/>아파트 실거래가</label>
      <label><input type="checkbox" checked={projectsOn} onChange={e=>setProjectsOn(e.target.checked)} className="mr-2"/>정비사업 위치</label>
      <label><input type="checkbox" checked={outlinesOn} onChange={e=>setOutlinesOn(e.target.checked)} className="mr-2"/>아파트 필지 외곽</label>
      <button type="button" onClick={()=>{setSelected(null);map.current?.fitBounds(bounds);}} className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-2 min-h-[44px]">부산 전체 보기</button>
    </div>
    <p className="text-xs text-slate-600">녹색: 기존 아파트 필지·가격 · 보라색: 정비사업 대표 위치. 세 사업은 지도용 공식 경계 좌표 미확보로 위치만 표시하며, 아파트 외곽을 사업구역으로 대신 사용하지 않습니다.</p>
    {error && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">실거래가를 불러오지 못했습니다. 위치와 단지 목록은 계속 사용할 수 있습니다. <button type="button" onClick={()=>setRetry(v=>v+1)} className="underline font-bold">가격 다시 조회</button></div>}
    {tilesError && <p role="status" className="text-sm text-amber-800">배경지도의 일부를 불러오지 못했습니다. 아래 목록에서 단지를 선택할 수 있습니다.</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div ref={container} role="region" aria-label="부산 통합 지도" className="busan-leaflet-map isolate relative z-0 h-[56vh] min-h-[360px] sm:h-[560px] rounded-xl border border-slate-200"/>
      <aside className="rounded-xl bg-white border border-slate-200 p-4 space-y-3" aria-label="지도 선택 정보">
        {!selected && <p className="text-sm text-slate-600">지도 마커나 아래 목록을 선택하면 상세 정보가 표시됩니다.</p>}
        {apartment && <><h3 className="font-bold text-lg">{apartment.name}</h3><p className="text-emerald-800 font-bold">{area}㎡급 · {error?'조회 실패':mapPriceLabel(summary)}</p>{summary?.month && <p className="text-xs text-slate-600">{summary.month.slice(0,4)}.{summary.month.slice(4)} 거래월 중앙값</p>}<p className="text-xs text-slate-500">단지별 실제 전용면적은 상세 분석에서 확인하세요. 녹색 외곽은 기존 아파트의 참고용 필지 경계입니다.</p><a className="block text-blue-700 underline py-2" href={getHousingApartmentLink(apartment.id)!} target="_blank" rel="noopener noreferrer">실거래가 상세 분석 (새 탭)</a>{apartment.id==='busan_samick_beach' && <a className="block text-purple-700 underline py-2" href="#/status/samik-beach">삼익비치 사업현황 보기</a>}</>}
        {project && <><h3 className="font-bold text-lg text-purple-800">{project.name}</h3>{liveProject && <p className="text-sm">사업 단계: {liveProject.stage}</p>}<p className="text-xs text-purple-800">위치 마커 · 사업구역 경계 미표시</p><p className="text-xs leading-5 text-slate-600">{project.positionNote}</p><p className="text-xs leading-5 text-slate-600">{project.boundaryNote}</p><a href={`#/status/${project.id}`} className="block py-2 text-blue-700 underline">사업현황·진행 정보 보기</a><a href={project.officialMapUrl} target="_blank" rel="noopener noreferrer" className="block py-2 text-blue-700 underline">부산시 공식 위치도 (새 탭)</a>{financialLink && <a href={financialLink.href} target="_blank" rel="noopener noreferrer" className="block py-2 text-blue-700 underline">{financialLink.label} (새 탭)</a>}</>}
        <div className="border-t border-slate-100 pt-3 space-y-1"><h3 className="text-sm font-bold">아파트 4곳</h3>{DATA.apartments.map(a=><button key={a.id} type="button" onClick={()=>{setSelected(a.id);setApartmentsOn(true);}} className="block w-full text-left text-sm text-emerald-800 hover:bg-emerald-50 rounded p-2">{a.name} · {error?'조회 실패':mapPriceLabel(currentPrices?.summaries[a.id])}</button>)}<h3 className="text-sm font-bold pt-2">정비사업 3곳</h3>{DATA.projects.map(p=><button key={p.id} type="button" onClick={()=>{setSelected(p.id);setProjectsOn(true);}} className="block w-full text-left text-sm text-purple-800 hover:bg-purple-50 rounded p-2">{p.name} · 위치 보기</button>)}</div>
      </aside>
    </div>
    <p className="text-xs text-slate-500">가격: K-housing·국토교통부 실거래가의 최근 거래월 중앙값{currentPrices ? ` · 조회 ${new Date(currentPrices.fetchedAt).toLocaleString('ko-KR')}` : ''}. 아파트 필지: {DATA.attribution} · {DATA.checkedAt} 확인. 표시 경계는 측량 성과가 아닙니다.</p>
    <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-bold text-sm">전국 지도·단지 상세 링크</summary><div className="mt-4"><HousingDestinationList /></div></details>
  </section>;
};
