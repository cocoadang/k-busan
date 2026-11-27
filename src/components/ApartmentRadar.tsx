type Profile = {
  brand?: string;
  homes?: number;
  year?: number;
  station?: [string, number?];
  stationRoute?: { meters: number; description: string; source: string };
  school?: [string, number];
  schoolName?: string;
  schoolMapName?: string;
  schoolDistance?: { meters: number; source: string };
  schoolNote?: string;
  schoolSource?: string;
  schoolRoute?: { adjacent: boolean; crossingLanes: number[]; description: string };
  terrain?: '평탄' | '완만' | '일부 경사' | '언덕' | '가파른 언덕';
  sources: string[];
};

const profiles: ReadonlyMap<string, Profile> = new Map([
  ['힐스테이트 e편한세상 문정', { brand: '힐스테이트·e편한세상', year: 2024, homes: 1265, station: ['문정역', 13], school: ['서울문정초', 7], terrain: '언덕', stationRoute: { meters: 1120, description: '단지 기준점 → 문정역 · 서울시 보행 네트워크', source: 'https://imjangmap.co.kr/apt/A10022403' }, schoolDistance: { meters: 641, source: 'https://imjangmap.co.kr/apt/A10022403' }, sources: ['https://home.114.ai.kr/apt/47407', 'https://imjangmap.co.kr/gu/송파구', 'https://statnorth.kr/apt/서울/송파구/문정동-힐스테이트e편한세상문정-9123fa3af660', 'https://www.khba.or.kr/user/isale/isaleInfo.do?busiResuSeq=10&memSeq=2004-0048'] }],
  ['가락쌍용1차', { brand: '쌍용', homes: 2064, year: 1997, station: ['경찰병원역', 5], school: ['서울가주초', 1], terrain: '언덕', schoolRoute: { adjacent: true, crossingLanes: [], description: '서울가주초 후문 통학로 · 공개 단지 자료 기준' }, stationRoute: { meters: 519, description: '501동 → 경찰병원역 · 서울시 보행 네트워크', source: 'https://imjangmap.co.kr/apt/A13880806' }, schoolDistance: { meters: 220, source: 'https://imjangmap.co.kr/apt/A13880806' }, sources: ['https://www.geummaecatch.com/complex/598/review', 'https://d.namu.moe/w/가락쌍용1차아파트', 'https://imjangmap.co.kr/gu/송파구', 'https://www.songpa.go.kr/www/contents.do?key=5847', 'https://realty.daangn.com/complexes/10667566'] }],
  ['래미안슈르', { brand: '래미안', homes: 2899, year: 2008, station: ['정부과천청사역', 8], school: ['문원초', 5], schoolRoute: { adjacent: true, crossingLanes: [], description: '문원초 인접 통학로 · 공개 단지 자료 기준' }, terrain: '평탄', sources: ['https://www.geummaecatch.com/complex/22781/review', 'https://cdn.zippoom.com/부동산/경기-과천시-원문동-래미안슈르/wg7y0h', 'https://realty.daangn.com/complexes/14787855/topics/school-district', 'https://bigvalue.ai/dashboard/apartment/경기도/과천시/원문동/c01906547'] }],
  ['광장현대3단지', { brand: '현대', homes: 1056, year: 1990, station: ['강변역', 10], school: ['서울광남초', 3], terrain: '평탄', sources: ['https://juso.zzxxccvv.com/a/서울/광진구/광나루로/635', 'https://kbland.kr/se/c/735', 'https://realty.daangn.com/complexes/11100626', 'https://openapt.seoul.go.kr/openApt/index.do?aptCode=A14381415'] }],
  ['고덕 아이파크', { brand: '아이파크', station: ['고덕역', 7], school: ['서울묘곡초', 3], homes: 1142, year: 2011, terrain: '완만', schoolRoute: { adjacent: true, crossingLanes: [], description: '서울묘곡초 인접 통학로 · 공개 기사 기준' }, stationRoute: { meters: 739, description: '단지 기준점 → 고덕역 · 서울시 보행 네트워크', source: 'https://imjangmap.co.kr/apt/A13408003' }, schoolDistance: { meters: 340, source: 'https://imjangmap.co.kr/apt/A13408003' }, sources: ['https://realty.chosun.com/m/article.amp.html?contid=2017112701870', 'https://imjangmap.co.kr/apt/A13408003', 'https://realty.daangn.com/complexes/10654556'] }],
  ['청량리한신', { brand: '한신', homes: 960, year: 1997, station: ['청량리역', 14], terrain: '가파른 언덕', stationRoute: { meters: 1246, description: '단지 기준점 → 청량리역(1호선) · 서울시 보행 네트워크', source: 'https://imjangmap.co.kr/apt/A13086704' }, schoolDistance: { meters: 705, source: 'https://imjangmap.co.kr/apt/A13086704' }, schoolName: '서울홍릉초', schoolSource: 'https://council.ddm.go.kr/viewer/minutes.do?uid=8317', schoolNote: '청량교·홍릉근린공원 통학 동선은 구의회 회의록 기준. 카카오맵 기본 최단 도보 경로는 약 1km로 표시', sources: ['https://council.ddm.go.kr/viewer/minutes.do?uid=8317', 'https://imjangmap.co.kr/gu/동대문구', 'https://www.k-apt.go.kr/cmmn/introMmentPop.do?bjdCode=11&searchOccuDate=201606'] }],
  ['평촌 공작부영', { brand: '부영', year: 1993, homes: 1710, station: ['평촌역', 9], school: ['부림초', 4], terrain: '평탄', sources: ['https://realty.daangn.com/complexes/15076981/reviews/600969', 'https://realty.daangn.com/complexes/15076981', 'https://chungyakalji.com/complex/A43181406'] }],
  ['철산주공 12단지', { brand: '주공', homes: 1800, year: 1986, station: ['철산역', 3], school: ['광명광성초', 2], terrain: '평탄', sources: ['https://cdn.zippoom.com/부동산/경기-광명시-철산동-주공12단지/ov085k', 'https://realty.daangn.com/complexes/15028901/topics/transportation', 'https://realty.chosun.com/site/data/html_dir/2026/09/06/2026090600874.html'] }],
  ['철산주공 13단지', { brand: '주공', year: 1986, station: ['철산역', 2], stationRoute: { meters: 115, description: '단지 남쪽 끝 → 철산역 4번 출구 · 단지 북쪽 끝은 936m', source: 'https://naezipnow.com/notes/d6213257-f0c5-4e4b-b932-fc12a6995844' }, school: ['광명광성초', 1], homes: 2460, terrain: '평탄', sources: ['https://zippoom.com/부동산/경기-광명시-철산동-주공13단지/h3hgck/b', 'https://www.gm.go.kr/pt/partInfo/ud/newtown/gm_rebuild.jsp', 'https://realty.daangn.com/complexes/15028452'] }],
  ['대치 은마', { year: 1979, station: ['대치역', 1], homes: 4424, school: ['서울대곡초', 5], brand: '한보주택', terrain: '평탄', stationRoute: { meters: 140, description: '은마복지상가 → 대치역 3·4번 출구 · 강남구립 대치도서관 안내', source: 'https://library.gangnam.go.kr/dchlib/menu/10305/contents/40055/contents.do' }, sources: ['https://heyzip.kr/building/1168010600103160000', 'https://www.modueapt.com/subpage/info.php?idx=4349', 'https://openapt.seoul.go.kr/openApt/index.do?aptCode=A13583507', 'https://realty.daangn.com/complexes/10689421/topics/transportation', 'https://realty.daangn.com/complexes/10689421/topics/school-district'] }],
  ['길음 롯데캐슬클라시아', { brand: '롯데캐슬', homes: 2033, year: 2022, station: ['길음역', 10], school: ['서울미아초', 9], terrain: '평탄', stationRoute: { meters: 697, description: '109동 → 길음역 · 서울시 보행 네트워크', source: 'https://imjangmap.co.kr/apt/A10023926' }, schoolDistance: { meters: 591, source: 'https://imjangmap.co.kr/apt/A10023926' }, sources: ['https://zippoom.com/부동산/서울-성북구-길음동-롯데캐슬클라시아/uvbtlb', 'https://zipsaja.com/complexes/15567-길음동-롯데캐슬클라시아', 'https://www.mk.co.kr/news/realestate/12157064'] }],
  ['인덕원센트럴푸르지오', { brand: '푸르지오', homes: 408, year: 2001, station: ['인덕원역', 11], stationRoute: { meters: 1200, description: '의왕시 새롬길 21 단지 기준점 → 인덕원역 3번 출구 · 카카오맵 최단 도보 약 1.2km', source: 'https://map.kakao.com/link/search/%EC%9D%98%EC%99%95%EC%8B%9C%20%EC%83%88%EB%A1%AC%EA%B8%B8%2021' }, school: ['벌말초', 1], schoolRoute: { adjacent: true, crossingLanes: [], description: '의왕 포일동 단지 후문에서 벌말초까지 인접 통학로' }, terrain: '평탄', sources: ['https://www.goebc.kr/upload/sd-m/na/bbs_4520/2025/09/65946B99-4D64-C630-E957-6863E55B0F92.pdf', 'https://m.richgo.ai/realty/danji/a0cunQK?priceType=meme&pyeongType=25', 'https://realty.daangn.com/complexes/14640680/topics/school-district', 'https://zippoom.com/부동산/경기-의왕시-포일동-인덕원센트럴푸르지오/0z1qt9', 'https://www.aptfit.co.kr/complex/A43783103'] }],
  ['관악푸르지오', { brand: '푸르지오', homes: 2104, year: 2004, station: ['숭실대입구역', 19], terrain: '가파른 언덕', stationRoute: { meters: 1408, description: '단지 기준점 → 숭실대입구역 · 서울시 보행 네트워크', source: 'https://imjangmap.co.kr/apt/A15105302' }, schoolDistance: { meters: 919, source: 'https://imjangmap.co.kr/apt/A15105302' }, schoolName: '서울봉천초', sources: ['https://imjangmap.co.kr/apt/A15105302', 'https://zipsaja.com/complexes/7206-봉천동-관악푸르지오?area=85', 'https://statnorth.kr/apt/서울/관악구/봉천동-관악푸르지오-f27bf1e7fd70'] }],
  ['관악현대', { brand: '현대', homes: 1729, year: 1992, station: ['숭실대입구역', 12], terrain: '가파른 언덕', stationRoute: { meters: 994, description: '단지 기준점 → 숭실대입구역 · 서울시 보행 네트워크', source: 'https://imjangmap.co.kr/apt/A15105303' }, schoolDistance: { meters: 368, source: 'https://imjangmap.co.kr/apt/A15105303' }, schoolName: '서울봉현초', sources: ['https://imjangmap.co.kr/apt/A15105303', 'https://부동산계산기.com/실거래/서울특별시_관악구_봉천동/현대(관악)', 'https://statnorth.kr/apt/서울/관악구/봉천동-현대(관악)-9f8d847d6259'] }],
  ['이문아이파크자이', {
    homes: 4169, year: 2025, terrain: '언덕', station: ['외대앞역', 9],
    stationRoute: { meters: 838, description: '1·2단지 관리구역 기준점 → 외대앞역 · 서울시 보행 네트워크', source: 'https://imjangmap.co.kr/apt/A10020344' },
    schoolName: '서울청량초(1단지)·서울이문초(2단지)', schoolMapName: '서울청량초등학교',
    schoolDistance: { meters: 1137, source: 'https://imjangmap.co.kr/apt/A10020344' },
    schoolNote: '표시 거리는 서울청량초 경로 기준',
    sources: ['https://zipgap.kr/apt-info/A10020344', 'https://www.ddmnews.co.kr/news/505051'],
  }],
  ['올림픽파크포레온', {
    homes: 12032, year: 2024, station: ['둔촌동역'],
    schoolName: '서울둔촌초·서울위례초', schoolMapName: '서울둔촌초등학교',
    schoolNote: '단지 내 2개 학교 · 동별 통학구역',
    sources: ['https://zipgap.kr/apt-info/A10021122', 'https://www.olympicpark-foreon.com/pdf/sale_supply.pdf', 'https://www.yna.co.kr/view/AKR20250225116200004'],
  }],
  ['관악드림타운', {
    homes: 3544, year: 2003, terrain: '가파른 언덕', station: ['숭실대입구역', 16],
    stationRoute: { meters: 1165, description: '136동 → 숭실대입구역 · 서울시 보행 네트워크', source: 'https://imjangmap.co.kr/apt/A15180705' },
    schoolName: '서울구암초',
    schoolDistance: { meters: 774, source: 'https://imjangmap.co.kr/apt/A15180705' },
    sources: ['https://openapt.seoul.go.kr/commonPortal/programLink.do?aptCode=A15180705&jspNm=%2FopenApt%2FdMenu%2FdangiInfo%2FdangiInfo.open', 'https://ezr.land/book/?addr=서울특별시+관악구+봉천동+1712'],
  }],
  ['공덕파크자이', {
    homes: 288, year: 2015, terrain: '평탄', station: ['공덕역', 4],
    stationRoute: { meters: 356, description: '단지 기준점 → 공덕역(5·6호선·공항철도) · 서울시 보행 네트워크', source: 'https://imjangmap.co.kr/apt/A10027748' },
    schoolName: '서울염리초·서울용강초 공동학구', schoolMapName: '서울염리초등학교',
    schoolDistance: { meters: 383, source: 'https://imjangmap.co.kr/apt/A10027748' },
    schoolNote: '표시 거리는 서울염리초 경로 기준',
    sources: ['https://www.kbland.kr/se/c/28104', 'https://chungyakalji.com/complex/A10027748'],
  }],
]);

export const locationGradeAxes = [
  [
    "브",
    "브랜드",
    "2026년 국토부 토목건축 시공능력평가 순위. 1–3위 5점, 4–10위 4점, 11–20위 3점, 21–50위 2점, 51위 이하 1점. 순위가 확인된 공동 시공사는 가장 높은 순위 적용."
  ],
  [
    "역",
    "역세권",
    "지도에 공개된 단지 기준점·대표 동 또는 확인된 단지 출입구에서 운영 중인 역까지의 보행 경로. 300m 이하 5점, 500m 이하 4점, 750m 이하 3점, 1,000m 이하 2점, 그 초과 1점."
  ],
  [
    "대",
    "대단지",
    "기존 단지 기준 2,000세대 이상 5점, 1,500 이상 4점, 1,000 이상 3점, 500 이상 2점, 500 미만 1점."
  ],
  [
    "신",
    "신축",
    "현재 한국 연도와 사용승인 연도 차이. 5년 이하 5점, 10년 이하 4점, 15년 이하 3점, 25년 이하 2점, 그 초과 1점."
  ],
  [
    "평",
    "평지",
    "공개 지형 자료 분류 기준. 평탄 5점, 완만 4점, 일부 경사 3점, 언덕 2점, 가파른 언덕 1점."
  ],
  [
    "초",
    "초등학교",
    "배정 학교까지 대표 통학로 기준. 단지 인접·차도 횡단 없음 5점, 비인접·횡단 없음 4점, 1~2차선 차도 1회 횡단 3점, 3~4차선 차도 1회 또는 1~2차선 차도 2회 이상 2점, 5차선 이상 또는 3~4차선 차도를 포함해 2회 이상 횡단 1점."
  ]
] as const;
const walk = (place?: [string, number?]) => place?.[1] ? `${place[0]} 도보 약 ${place[1]}분` : place?.[0];
const meters = (distance: number) => `${distance.toLocaleString('ko-KR')}m`;

const rankingSource = 'https://www.molit.go.kr/USR/NEWS/dtl.jsp?id=95092271';
const contractors: ReadonlyMap<string, [string, number]> = new Map([
  ['래미안슈르', ['삼성물산', 1]],
  ['힐스테이트 e편한세상 문정', ['현대엔지니어링', 4]],
  ['가락쌍용1차', ['쌍용건설', 19]],
  ['광장현대3단지', ['현대건설', 2]],
  ['관악현대', ['현대건설', 2]],
  ['고덕 아이파크', ['아이파크현대산업개발', 10]],
  ['청량리한신', ['한신공영', 29]],
  ['길음 롯데캐슬클라시아', ['롯데건설', 7]],
  ['인덕원센트럴푸르지오', ['대우건설', 5]],
  ['관악푸르지오', ['대우건설', 5]],
  ['이문아이파크자이', ['GS건설', 3]],
  ['올림픽파크포레온', ['현대건설', 2]],
  ['관악드림타운', ['삼성물산', 1]],
  ['공덕파크자이', ['GS건설', 3]],
]);
const terrainGrades = { 평탄: 5, 완만: 4, '일부 경사': 3, 언덕: 2, '가파른 언덕': 1 };
const stationThresholds = [300, 500, 750, 1000];
const gradeBelow = (value: number, thresholds: number[]) => 5 - thresholds.filter(limit => value > limit).length;
export function getApartmentLocationGrades(name: string) {
  const year = new Date(Date.now() + 9 * 3600_000).getUTCFullYear();
  const p = profiles.get(name);
  const contractor = contractors.get(name);
  const station = p?.stationRoute;
  const school = p?.schoolRoute;
  const schoolName = p?.schoolName ?? p?.school?.[0];
  const schoolDistance = p?.schoolDistance;
  const schoolLabel = schoolDistance
    ? `${schoolName} · 도보 ${meters(schoolDistance.meters)}`
    : p?.schoolName ?? walk(p?.school);
  const widestCrossing = Math.max(0, ...(school?.crossingLanes ?? []));
  const crossings = school?.crossingLanes.length ?? 0;
  const schoolGrade = school
    ? widestCrossing >= 5 || (widestCrossing >= 3 && crossings > 1) ? 1
      : widestCrossing >= 3 || crossings > 1 ? 2
      : crossings === 1 ? 3 : school.adjacent ? 5 : 4
    : null;
  return [
    { label: contractor ? `${contractor[0]} · ${contractor[1]}위` : p?.brand, grade: contractor ? gradeBelow(contractor[1], [3, 10, 20, 50]) : null, source: contractor ? rankingSource : undefined },
    {
      label: station ? `${meters(station.meters)} · ${station.description}` : walk(p?.station),
      pending: '보행 경로 거리 확인 필요',
      grade: station ? gradeBelow(station.meters, stationThresholds) : null,
      summary: station ? undefined : walk(p?.station),
      source: station?.source,
    },
    { label: p?.homes ? `${p.homes.toLocaleString('ko-KR')}세대` : null, grade: p?.homes ? 1 + [500, 1000, 1500, 2000].filter(limit => p.homes! >= limit).length : null },
    { label: p?.year ? `${p.year}년 사용승인 · ${year - p.year}년 경과` : null, grade: p?.year ? gradeBelow(year - p.year, [5, 10, 15, 25]) : null },
    { label: p?.terrain ? p.terrain + ' · 공개 지형 자료' : null, grade: p?.terrain ? terrainGrades[p.terrain] : null },
    {
      label: [
        schoolLabel,
        p?.schoolNote,
        school ? `${school.description} · ${crossings ? `최대 ${widestCrossing}차선, ${crossings}회 횡단` : '차도 횡단 없음'}` : null,
      ].filter(Boolean).join(' · '),
      pending: schoolName ? '통학로 횡단 조건 확인 필요' : '배정 학교 확인 필요',
      grade: schoolGrade,
      summary: schoolLabel,
      source: p?.schoolSource ?? schoolDistance?.source,
    },
  ];
}
