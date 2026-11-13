const HOUSING_ORIGIN = 'https://k-housing-5he2zcaska-du.a.run.app';
export function getHousingLink(projectId: string): {href:string;label:string} | null {
  if (projectId === 'chokjin-3') return {href:`${HOUSING_ORIGIN}/?view=REDEVELOPMENT&lineage=chokjin3_redevelopment`,label:'사업성 분석 보기'};
  if (projectId === 'samik-beach') return {href:`${HOUSING_ORIGIN}/?view=ANALYSIS&complex=busan_samick_beach`,label:'실거래가 분석 보기'};
  return null;
}
