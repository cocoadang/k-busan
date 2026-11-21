type Profile = {
  brand?: string;
  homes?: number;
  year?: number;
  station?: [string, number];
  stationRoute?: { meters: number; description: string };
  school?: [string, number];
  schoolRoute?: { adjacent: boolean; crossingLanes: number[]; description: string };
  terrain?: '평탄' | '완만' | '일부 경사' | '언덕' | '가파른 언덕';
  sources: string[];
};

const profiles: ReadonlyMap<string, Profile> = new Map([
  ['힐스테이트 e편한세상 문정', { brand: '힐스테이트·e편한세상', year: 2024, homes: 1265, station: ['문정역', 13], school: ['서울문정초', 7], terrain: '언덕', sources: ['https://home.114.ai.kr/apt/47407', 'https://imjangmap.co.kr/gu/송파구', 'https://statnorth.kr/apt/서울/송파구/문정동-힐스테이트e편한세상문정-9123fa3af660', 'https://www.khba.or.kr/user/isale/isaleInfo.do?busiResuSeq=10&memSeq=2004-0048'] }],
  ['가락쌍용1차', { brand: '쌍용', homes: 2064, year: 1997, station: ['경찰병원역', 5], school: ['서울가주초', 1], terrain: '언덕', sources: ['https://imjangmap.co.kr/gu/송파구', 'https://www.songpa.go.kr/www/contents.do?key=5847', 'https://realty.daangn.com/complexes/10667566'] }],
  ['래미안슈르', { brand: '래미안', homes: 2899, year: 2008, station: ['정부과천청사역', 8], school: ['문원초', 5], schoolRoute: { adjacent: true, crossingLanes: [], description: '문원초 인접 통학로 · 공개 단지 자료 기준' }, terrain: '평탄', sources: ['https://www.geummaecatch.com/complex/22781/review', 'https://cdn.zippoom.com/부동산/경기-과천시-원문동-래미안슈르/wg7y0h', 'https://realty.daangn.com/complexes/14787855/topics/school-district', 'https://bigvalue.ai/dashboard/apartment/경기도/과천시/원문동/c01906547'] }],
  ['광장현대3단지', { brand: '현대', homes: 1056, year: 1990, station: ['강변역', 10], school: ['서울광남초', 3], terrain: '평탄', sources: ['https://juso.zzxxccvv.com/a/서울/광진구/광나루로/635', 'https://kbland.kr/se/c/735', 'https://realty.daangn.com/complexes/11100626', 'https://openapt.seoul.go.kr/openApt/index.do?aptCode=A14381415'] }],
  ['고덕 아이파크', { brand: '아이파크', station: ['고덕역', 7], school: ['서울묘곡초', 3], homes: 1142, year: 2011, terrain: '완만', schoolRoute: { adjacent: true, crossingLanes: [], description: '서울묘곡초 인접 통학로 · 공개 기사 기준' }, sources: ['https://realty.chosun.com/m/article.amp.html?contid=2017112701870', 'https://imjangmap.co.kr/apt/A13408003', 'https://realty.daangn.com/complexes/10654556'] }],
  ['청량리한신', { brand: '한신', homes: 960, year: 1997, station: ['청량리역', 14], terrain: '가파른 언덕', sources: ['https://imjangmap.co.kr/gu/동대문구', 'https://www.k-apt.go.kr/cmmn/introMmentPop.do?bjdCode=11&searchOccuDate=201606'] }],
  ['평촌 공작부영', { brand: '부영', year: 1993, homes: 1710, station: ['평촌역', 9], school: ['부림초', 4], sources: ['https://realty.daangn.com/complexes/15076981', 'https://chungyakalji.com/complex/A43181406'] }],
  ['철산주공 12단지', { brand: '주공', homes: 1800, year: 1986, station: ['철산역', 3], school: ['광명광성초', 2], sources: ['https://realty.daangn.com/complexes/15028901/topics/transportation', 'https://realty.chosun.com/site/data/html_dir/2026/09/06/2026090600874.html'] }],
  ['철산주공 13단지', { brand: '주공', year: 1986, station: ['철산역', 2], school: ['광명광성초', 1], homes: 2460, sources: ['https://www.gm.go.kr/pt/partInfo/ud/newtown/gm_rebuild.jsp', 'https://realty.daangn.com/complexes/15028452'] }],
  ['대치 은마', { year: 1979, station: ['대치역', 1], homes: 4424, school: ['서울대곡초', 5], brand: '한보주택', sources: ['https://www.modueapt.com/subpage/info.php?idx=4349', 'https://openapt.seoul.go.kr/openApt/index.do?aptCode=A13583507', 'https://realty.daangn.com/complexes/10689421/topics/transportation', 'https://realty.daangn.com/complexes/10689421/topics/school-district'] }],
  ['길음 롯데캐슬클라시아', { brand: '롯데캐슬', homes: 2033, year: 2022, station: ['길음역', 10], school: ['서울미아초', 9], sources: ['https://zipsaja.com/complexes/15567-길음동-롯데캐슬클라시아', 'https://www.mk.co.kr/news/realestate/12157064'] }],
  ['인덕원센트럴푸르지오', { brand: '푸르지오', homes: 408, year: 2001, station: ['인덕원역', 11], school: ['벌말초', 1], sources: ['https://realty.daangn.com/complexes/15075173', 'https://www.aptfit.co.kr/complex/A43783103'] }],
  ['관악푸르지오', { brand: '푸르지오', homes: 2104, year: 2004, station: ['서울대입구역', 19], school: ['서울신남성초', 7], sources: ['https://zipsaja.com/complexes/7206-봉천동-관악푸르지오?area=85', 'https://statnorth.kr/apt/서울/관악구/봉천동-관악푸르지오-f27bf1e7fd70'] }],
  ['관악현대', { brand: '현대', homes: 1729, year: 1992, sources: ['https://statnorth.kr/apt/서울/관악구/봉천동-현대(관악)-9f8d847d6259'] }],
]);

const axes = [
  [
    "브",
    "브랜드",
    "2026년 국토부 토목건축 시공능력평가 순위. 1–3위 5점, 4–10위 4점, 11–20위 3점, 21–50위 2점, 51위 이하 1점. 순위가 확인된 공동 시공사는 가장 높은 순위 적용."
  ],
  [
    "역",
    "역세권",
    "대표 단지 출입구에서 운영 중인 역 출입구까지 실제 보행 경로. 300m 이하 5점, 500m 이하 4점, 750m 이하 3점, 1,000m 이하 2점, 그 초과 1점."
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
const colors = ['#087e8b', '#1d4ed8', '#a21caf'];
const point = (axis: number, radius: number) => {
  const angle = (axis * 60 - 90) * Math.PI / 180;
  return [150 + Math.cos(angle) * radius, 125 + Math.sin(angle) * radius] as const;
};
const outerRadius = 85;
const innerRadius = 34;
const rings = [17, innerRadius, 51, 68, outerRadius];
const walk = (place?: [string, number]) => place ? `${place[0]} 도보 약 ${place[1]}분` : null;

const rankingSource = 'https://www.molit.go.kr/USR/NEWS/dtl.jsp?id=95092271';
const contractors: ReadonlyMap<string, [string, number]> = new Map([
  ['래미안슈르', ['삼성물산', 1]],
  ['힐스테이트 e편한세상 문정', ['현대엔지니어링', 4]],
  ['가락쌍용1차', ['쌍용건설', 19]],
  ['광장현대3단지', ['현대건설', 2]],
  ['고덕 아이파크', ['아이파크현대산업개발', 10]],
  ['청량리한신', ['한신공영', 29]],
  ['길음 롯데캐슬클라시아', ['롯데건설', 7]],
  ['인덕원센트럴푸르지오', ['대우건설', 5]],
  ['관악푸르지오', ['대우건설', 5]],
]);
const terrainGrades = { 평탄: 5, 완만: 4, '일부 경사': 3, 언덕: 2, '가파른 언덕': 1 };
const gradeBelow = (value: number, thresholds: number[]) => 5 - thresholds.filter(limit => value > limit).length;
const gradeText = (grade: number | null) => grade === null ? '미확인' : `${grade}/5점`;
const legend = '바깥쪽일수록 높은 점수입니다. 가장 안쪽의 빈 점은 미확인이며, 연결 점선은 위치를 안내합니다.';

function radarEntry(name: string) {
  const year = new Date(Date.now() + 9 * 3600_000).getUTCFullYear();
  const p = profiles.get(name);
  const contractor = contractors.get(name);
  const school = p?.schoolRoute;
  const widestCrossing = Math.max(0, ...(school?.crossingLanes ?? []));
  const crossings = school?.crossingLanes.length ?? 0;
  const schoolGrade = school
    ? widestCrossing >= 5 || (widestCrossing >= 3 && crossings > 1) ? 1
      : widestCrossing >= 3 || crossings > 1 ? 2
      : crossings === 1 ? 3 : school.adjacent ? 5 : 4
    : null;
  const values = [
    { label: contractor ? `${contractor[0]} · ${contractor[1]}위` : p?.brand, grade: contractor ? gradeBelow(contractor[1], [3, 10, 20, 50]) : null },
    { label: p?.stationRoute ? `${p.stationRoute.meters}m · ${p.stationRoute.description}` : walk(p?.station), grade: p?.stationRoute ? gradeBelow(p.stationRoute.meters, [300, 500, 750, 1000]) : null },
    { label: p?.homes ? `${p.homes.toLocaleString('ko-KR')}세대` : null, grade: p?.homes ? 1 + [500, 1000, 1500, 2000].filter(limit => p.homes! >= limit).length : null },
    { label: p?.year ? `${p.year}년 사용승인 · ${year - p.year}년 경과` : null, grade: p?.year ? gradeBelow(year - p.year, [5, 10, 15, 25]) : null },
    { label: p?.terrain ? p.terrain + ' · 공개 지형 자료' : null, grade: p?.terrain ? terrainGrades[p.terrain] : null },
    { label: school ? `${school.description} · ${crossings ? `최대 ${widestCrossing}차선, ${crossings}회 횡단` : '차도 횡단 없음'}` : walk(p?.school), grade: schoolGrade },
  ];
  const sources = [...(p?.sources ?? []), ...(contractor ? [rankingSource] : [])];
  return { name, values, sources };
}

const linePatterns = [undefined, '7 4', '2 3'];

function RadarChart({ entries, compact = false }: { entries: ReturnType<typeof radarEntry>[]; compact?: boolean }) {
  return (
    <svg viewBox="0 0 280 244" className={compact ? "h-40 w-44 max-w-full shrink-0" : "mx-auto w-full max-w-xs"} aria-hidden="true">
      {rings.map(radius => (
        <polygon key={radius} points={axes.map((_, axis) => point(axis, radius).join(',')).join(' ')}
          fill="none" stroke={radius === outerRadius ? '#8799ab' : '#c2cdd7'} />
      ))}
      {axes.map(([key, label], axis) => {
        const [x, y] = point(axis, outerRadius);
        const [labelX, labelY] = point(axis, compact ? 106 : 109);
        return <g key={key}>
          <line x1={150} y1={125} x2={x} y2={y} stroke="#c2cdd7" />
          <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" fontSize={compact ? 20 : 13} fontWeight="600" fill="#334155">{compact ? key : label}</text>
        </g>;
      })}
      {entries.map(({ name, values }, index) => {
        const positions = values.map((value, axis) => point(axis, value.grade === null ? 8 : rings[value.grade - 1]));
        const color = colors[index];
        const outline = { stroke: color, strokeWidth: compact ? 3 : 2.5, strokeDasharray: linePatterns[index] };
        return <g key={name}>
          <polygon points={positions.map(position => position.join(',')).join(' ')} fill={color} fillOpacity={compact ? 0.24 : 0.13} />
          {positions.map(([x, y], axis) => {
            const next = (axis + 1) % axes.length;
            const unknown = values[axis].grade === null || values[next].grade === null;
            return <line key={axis} x1={x} y1={y} x2={positions[next][0]} y2={positions[next][1]}
              {...outline} strokeDasharray={unknown ? '1 5' : outline.strokeDasharray} strokeLinecap="round" />;
          })}
          {positions.map(([x, y], axis) => (
            <circle key={axis} cx={x} cy={y} r={compact ? 3.5 : 3}
              fill={values[axis].grade === null ? 'white' : color} stroke={values[axis].grade === null ? color : 'white'} strokeWidth={1.5} />
          ))}
        </g>;
      })}
    </svg>
  );
}

export function ApartmentRadarPreview({ name }: { name: string }) {
  const entry = radarEntry(name);
  const status = entry.values.map(value => gradeText(value.grade));
  return (
    <figure className="mt-3 flex flex-wrap items-center gap-x-2 rounded-xl bg-slate-50 px-2 py-1">
      <RadarChart entries={[entry]} compact />
      <figcaption className="min-w-0 text-xs text-slate-600">
        <span className="font-semibold text-slate-900">브역대신평초</span>
        <span className="mt-1 block">{status.filter(value => value !== '미확인').length}개 평가 · {status.filter(value => value === '미확인').length}개 미확인</span>
        <span className="sr-only">{axes.map(([, label], index) => `${label} ${status[index]}`).join(', ')}</span>
        <details className="mt-2">
          <summary className="cursor-pointer font-medium text-blue-800">육각형 기준 보기</summary>
          <p className="mt-1">{legend}</p>
          <dl className="mt-2 space-y-1">
            {axes.map(([key, label, rule], index) => <div key={key}>
              <dt className="inline font-semibold">{label} · {status[index]}</dt>
              <dd>{entry.values[index].label && <span className="block">{entry.values[index].label}</span>}{rule}</dd>
            </div>)}
          </dl>
        </details>
      </figcaption>
    </figure>
  );
}

export default function ApartmentRadar({ names }: { names: string[] }) {
  const entries = names.map((name, index) => ({ ...radarEntry(name), color: colors[index] }));

  return (
    <section className="mt-4 border-t border-slate-200 pt-4" aria-label="브역대신평초 비교">
      <h4 className="font-semibold">브역대신평초 입지 비교</h4>
      <p className="mt-1 text-sm text-slate-600">{legend}</p>
      <div className="mt-2 grid items-start gap-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
        <RadarChart entries={entries} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[18rem] text-left text-sm">
            <thead><tr><th scope="col" className="p-2">비교 기준</th>{entries.map(({ name, color }, index) => <th scope="col" key={name} className="p-2"><svg className="mr-1 inline-block align-middle" width="22" height="10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" stroke={color} strokeWidth="2" strokeDasharray={linePatterns[index]} /></svg>{name}</th>)}</tr></thead>
            <tbody>
              {axes.map(([key, label, rule], i) => <tr key={key} className="border-t border-slate-200">
                <th scope="row" className="p-2 align-top">{label}<span className="block text-xs font-normal text-slate-600">{rule}</span></th>
                {entries.map(({ name, values }) => <td className="p-2 align-top" key={name}>{values[i].label}<span className="block text-xs text-slate-600">{gradeText(values[i].grade)}</span></td>)}
              </tr>)}
              <tr className="border-t border-slate-200"><th scope="row" className="p-2">출처</th>{entries.map(({ name, sources }) => <td className="p-2" key={name}>{sources.length ? sources.map((url, i) => <a className="mr-2 text-blue-800 underline" key={url} href={url} target="_blank" rel="noreferrer">자료 {i + 1}</a>) : '미확인'}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-600">참고 도보 시간은 일부 직선거리 환산값이며 역·학교 점수에는 반영하지 않습니다. 역 출입구, 통학로와 배정 학교는 단지 주소와 동에 따라 달라질 수 있습니다.</p>
    </section>
  );
}
