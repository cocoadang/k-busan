type Profile = {
  brand?: string;
  homes?: number;
  year?: number;
  station?: [string, number];
  school?: [string, number];
  terrain?: '평탄' | '완만' | '언덕' | '가파른 언덕';
  sources: string[];
};

const profiles: ReadonlyMap<string, Profile> = new Map([
  ['힐스테이트 e편한세상 문정', { brand: '힐스테이트·e편한세상', year: 2024, homes: 1265, station: ['문정역', 13], school: ['서울문정초', 7], terrain: '언덕', sources: ['https://home.114.ai.kr/apt/47407', 'https://imjangmap.co.kr/gu/송파구', 'https://statnorth.kr/apt/서울/송파구/문정동-힐스테이트e편한세상문정-9123fa3af660', 'https://www.khba.or.kr/user/isale/isaleInfo.do?busiResuSeq=10&memSeq=2004-0048'] }],
  ['가락쌍용1차', { brand: '쌍용', homes: 2064, year: 1997, station: ['경찰병원역', 5], school: ['서울가주초', 1], terrain: '언덕', sources: ['https://imjangmap.co.kr/gu/송파구', 'https://www.songpa.go.kr/www/contents.do?key=5847', 'https://realty.daangn.com/complexes/10667566'] }],
  ['래미안슈르', { brand: '래미안', homes: 2899, year: 2008, station: ['정부과천청사역', 8], school: ['문원초', 5], sources: ['https://realty.daangn.com/complexes/14787855/topics/school-district', 'https://bigvalue.ai/dashboard/apartment/경기도/과천시/원문동/c01906547'] }],
  ['광장현대3단지', { brand: '현대', homes: 1056, year: 1990, station: ['강변역', 10], school: ['서울광남초', 3], sources: ['https://realty.daangn.com/complexes/11100626', 'https://openapt.seoul.go.kr/openApt/index.do?aptCode=A14381415'] }],
  ['고덕 아이파크', { brand: '아이파크', station: ['고덕역', 7], school: ['서울묘곡초', 3], homes: 1142, year: 2011, terrain: '완만', sources: ['https://imjangmap.co.kr/apt/A13408003', 'https://realty.daangn.com/complexes/10654556'] }],
  ['청량리한신', { brand: '한신', homes: 960, year: 1997, station: ['청량리역', 14], terrain: '가파른 언덕', sources: ['https://imjangmap.co.kr/gu/동대문구', 'https://www.k-apt.go.kr/cmmn/introMmentPop.do?bjdCode=11&searchOccuDate=201606'] }],
  ['평촌 공작부영', { brand: '부영', year: 1993, homes: 1710, station: ['평촌역', 9], school: ['부림초', 4], sources: ['https://realty.daangn.com/complexes/15076981', 'https://chungyakalji.com/complex/A43181406'] }],
  ['철산주공 12단지', { brand: '주공', homes: 1800, year: 1986, station: ['철산역', 3], school: ['광명광성초', 2], sources: ['https://realty.daangn.com/complexes/15028901/topics/transportation', 'https://realty.chosun.com/site/data/html_dir/2026/09/06/2026090600874.html'] }],
  ['철산주공 13단지', { brand: '주공', year: 1986, station: ['철산역', 2], school: ['광명광성초', 1], homes: 2460, sources: ['https://www.gm.go.kr/pt/partInfo/ud/newtown/gm_rebuild.jsp', 'https://realty.daangn.com/complexes/15028452'] }],
  ['대치 은마', { year: 1979, station: ['대치역', 1], homes: 4424, school: ['서울대곡초', 5], sources: ['https://openapt.seoul.go.kr/openApt/index.do?aptCode=A13583507', 'https://realty.daangn.com/complexes/10689421/topics/transportation', 'https://realty.daangn.com/complexes/10689421/topics/school-district'] }],
  ['길음 롯데캐슬클라시아', { brand: '롯데캐슬', homes: 2033, year: 2022, station: ['길음역', 10], school: ['서울미아초', 9], sources: ['https://zipsaja.com/complexes/15567-길음동-롯데캐슬클라시아', 'https://www.mk.co.kr/news/realestate/12157064'] }],
  ['인덕원센트럴푸르지오', { brand: '푸르지오', homes: 408, year: 2001, station: ['인덕원역', 11], school: ['벌말초', 1], sources: ['https://realty.daangn.com/complexes/15075173', 'https://www.aptfit.co.kr/complex/A43783103'] }],
  ['관악푸르지오', { brand: '푸르지오', homes: 2104, year: 2004, station: ['서울대입구역', 19], school: ['서울신남성초', 7], sources: ['https://zipsaja.com/complexes/7206-봉천동-관악푸르지오?area=85', 'https://statnorth.kr/apt/서울/관악구/봉천동-관악푸르지오-f27bf1e7fd70'] }],
  ['관악현대', { brand: '현대', homes: 1729, year: 1992, sources: ['https://statnorth.kr/apt/서울/관악구/봉천동-현대(관악)-9f8d847d6259'] }],
]);

const axes = [
  ['브', '브랜드', '출처에서 확인한 브랜드 표기'],
  ['역', '역세권', '현재 운영역까지 출처에 표시된 도보 10분 이내'],
  ['대', '대단지', '기존 단지 기준 1,000세대 이상'],
  ['신', '신축', '사용승인 연도와 현재 한국시간 연도의 차이가 5년 이내'],
  ['평', '평지', '공개 지형 분석에서 평탄·완만으로 분류되면 충족'],
  ['초', '초등학교', '출처에 표시된 인근 초등학교까지 도보 5분 이내'],
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

function radarEntry(name: string) {
  const year = new Date(Date.now() + 9 * 3600_000).getUTCFullYear();
  const p = profiles.get(name);
  const values = [
    p?.brand ? { label: p.brand, pass: true } : null,
    p?.station ? { label: walk(p.station), pass: p.station[1] <= 10 } : null,
    p?.homes ? { label: `${p.homes.toLocaleString('ko-KR')}세대`, pass: p.homes >= 1000 } : null,
    p?.year ? { label: `${p.year}년 사용승인`, pass: year - p.year <= 5 } : null,
    p?.terrain ? { label: p.terrain + ' · 공개 지형 분석', pass: p.terrain === '평탄' || p.terrain === '완만' } : null,
    p?.school ? { label: walk(p.school), pass: p.school[1] <= 5 } : null,
  ];
  return { name, values, sources: p?.sources ?? [] };
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
        const positions = values.map((value, axis) => value ? point(axis, value.pass ? outerRadius : innerRadius) : null);
        const edges = positions.flatMap((from, axis) => {
          const to = positions[(axis + 1) % axes.length];
          return from && to ? [{ axis, from, to }] : [];
        });
        const complete = positions.every(position => position !== null);
        const color = colors[index];
        const outline = { stroke: color, strokeWidth: compact ? 3 : 2.5, strokeDasharray: linePatterns[index], strokeLinejoin: 'round' as const };
        return <g key={name}>
          {complete
            ? <polygon points={positions.map(position => position?.join(',')).join(' ')} fill={color} fillOpacity={compact ? 0.24 : 0.13} {...outline} />
            : <>
              <path d={edges.map(({ from, to }) => `M 150,125 L ${from.join(',')} L ${to.join(',')} Z`).join(' ')}
                fill={color} fillOpacity={compact ? 0.24 : 0.13} />
              {edges.map(({ axis, from, to }) => <line key={axis} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} {...outline} />)}
            </>}
          {positions.map((position, axis) => position && <circle key={axis} cx={position[0]} cy={position[1]} r={compact ? 3.5 : 3} fill={color} stroke="white" strokeWidth={1} />)}
        </g>;
      })}
    </svg>
  );
}

export function ApartmentRadarPreview({ name }: { name: string }) {
  const entry = radarEntry(name);
  const status = entry.values.map(value => value ? value.pass ? '충족' : '미달' : '미확인');
  return (
    <figure className="mt-3 flex flex-wrap items-center gap-x-2 rounded-xl bg-slate-50 px-2 py-1">
      <RadarChart entries={[entry]} compact />
      <figcaption className="min-w-0 text-xs text-slate-600">
        <span className="font-semibold text-slate-900">브역대신평초</span>
        <span className="mt-1 block">{status.filter(value => value === '충족').length}개 충족 · {status.filter(value => value === '미확인').length}개 미확인</span>
        <span className="sr-only">{axes.map(([, label], index) => `${label} ${status[index]}`).join(', ')}</span>
      </figcaption>
    </figure>
  );
}

export default function ApartmentRadar({ names }: { names: string[] }) {
  const entries = names.map((name, index) => ({ ...radarEntry(name), color: colors[index] }));

  return (
    <section className="mt-4 border-t border-slate-200 pt-4" aria-label="브역대신평초 비교">
      <h4 className="font-semibold">브역대신평초 입지 비교</h4>
      <p className="mt-1 text-sm text-slate-600">바깥쪽은 기준 충족, 안쪽은 기준 미달입니다. 미확인 축 주변은 선과 색을 비워 둡니다.</p>
      <div className="mt-2 grid items-start gap-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
        <RadarChart entries={entries} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[18rem] text-left text-sm">
            <thead><tr><th scope="col" className="p-2">비교 기준</th>{entries.map(({ name, color }, index) => <th scope="col" key={name} className="p-2"><svg className="mr-1 inline-block align-middle" width="22" height="10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" stroke={color} strokeWidth="2" strokeDasharray={linePatterns[index]} /></svg>{name}</th>)}</tr></thead>
            <tbody>
              {axes.map(([key, label, rule], i) => <tr key={key} className="border-t border-slate-200">
                <th scope="row" className="p-2 align-top">{label}<span className="block text-xs font-normal text-slate-600">{rule}</span></th>
                {entries.map(({ name, values }) => <td className="p-2 align-top" key={name}>{values[i] ? <>{values[i]?.label}<span className="block text-xs text-slate-600">{values[i]?.pass ? '충족' : '미달'}</span></> : <span className="text-slate-500">미확인</span>}</td>)}
              </tr>)}
              <tr className="border-t border-slate-200"><th scope="row" className="p-2">출처</th>{entries.map(({ name, sources }) => <td className="p-2" key={name}>{sources.length ? sources.map((url, i) => <a className="mr-2 text-blue-800 underline" key={url} href={url} target="_blank" rel="noreferrer">자료 {i + 1}</a>) : '미확인'}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-600">도보 시간은 출처의 추정치로 일부는 직선거리 환산값입니다. 출입구와 실제 경로에 따라 달라집니다. 평지는 공개 지형 분석의 분류를 사용합니다. 초등학교 배정은 주소별로 확인해야 합니다.</p>
    </section>
  );
}
