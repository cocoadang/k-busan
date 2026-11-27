/// <reference types="vite/client" />

import { HOUSING_DESTINATIONS } from '../data/housingDestinations';

export const unifiedHousingLinks = import.meta.env?.VITE_APT_UNIFIED_HOUSING === 'true';
const HOUSING_ORIGIN = 'https://k-housing-5he2zcaska-du.a.run.app';
export const housingHome = unifiedHousingLinks ? '/market/' : HOUSING_ORIGIN + '/';

function housingUrl(params: Record<string, string>): string {
  return housingHome + '?' + new URLSearchParams(params).toString();
}
export function getHousingLink(projectId: string, areaCategory?: '59'|'84'): {href:string;label:string} | null {
  if (projectId === 'chokjin-3') return {href:housingUrl({ view: 'REDEVELOPMENT', lineage: 'chokjin3_redevelopment' }),label:'사업성 분석 보기'};
  if (projectId === 'samik-beach') return {href:getHousingApartmentLink('busan_samick_beach',areaCategory)!,label:'실거래가 분석 보기'};
  return null;
}

export function getHousingMapLink(region?: string): string {
  return housingUrl({
    view: 'MAP',
    ...(region && HOUSING_DESTINATIONS.some(c => c.region === region) ? { region } : {}),
  });
}

export function getHousingApartmentLink(complexId: string, areaCategory?: '59'|'84'): string | null {
  if (!HOUSING_DESTINATIONS.some(c => c.id === complexId)) return null;
  return housingUrl({
    view: 'ANALYSIS', complex: complexId, ...(areaCategory ? { areaCategory } : {}),
  });
}
