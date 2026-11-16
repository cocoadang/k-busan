import React, { useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { HOUSING_DESTINATIONS } from '../data/housingDestinations';
import { getHousingMapLink, getHousingApartmentLink } from '../utils/housingLinks';

const regions = [...new Set(HOUSING_DESTINATIONS.map(c => c.region))];
export const HousingMapView: React.FC = () => {
  const [region, setRegion] = useState('전체');
  return <section aria-label="지도·시세 안내" className="space-y-6">
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:p-6 space-y-3">
      <h2 className="text-xl font-bold text-slate-900">지도·시세</h2>
      <p className="text-sm leading-6 text-slate-600">등록 아파트 31곳의 실거래가와 단지 외곽, 초등학교 위치·학생 수를 지도에서 확인하세요. 공식 통학구역도 선택해 볼 수 있습니다.</p>
      <a href={getHousingMapLink()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 font-bold text-sm text-white hover:bg-blue-800">
        <MapPin className="w-4 h-4" aria-hidden="true" /> K-housing 전체 지도 열기 <ExternalLink className="w-4 h-4" aria-hidden="true" />
        <span className="sr-only">(새 탭)</span>
      </a>
      <p className="text-xs text-slate-500">지도와 상세 분석은 K-housing의 새 탭에서 열립니다. 단지 외곽은 참고용 필지 경계이며, 학교 배정은 교육지원청 확인이 필요합니다.</p>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <h3 className="text-base font-bold text-slate-900">단지별 실거래가 분석</h3>
      <label className="ml-auto text-sm text-slate-600">지역
        <select value={region} onChange={e => setRegion(e.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 min-h-[44px]">
          <option value="전체">전체 지역</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {regions.filter(r => region === '전체' || region === r).map(r => <section key={r} aria-label={r + ' 단지'} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="font-bold text-slate-900">{r}</h4>
          <a href={getHousingMapLink(r)} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-700 underline py-2">지역 지도<span className="sr-only"> · {r} (새 탭)</span></a>
        </div>
        <ul className="space-y-1">{HOUSING_DESTINATIONS.filter(c => c.region === r).map(c => <li key={c.id}>
          <a href={getHousingApartmentLink(c.id)!} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 rounded-lg px-3 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-800">
            <span>{c.name}</span><ExternalLink className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" /><span className="sr-only">실거래가 분석 (새 탭)</span>
          </a>
        </li>)}</ul>
      </section>)}
    </div>
  </section>;
};
