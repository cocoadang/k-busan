type Profile = {
  brand?: string;
  homes?: number;
  year?: number;
  station?: [string, number];
  school?: [string, number];
  sources: string[];
};

const profiles: ReadonlyMap<string, Profile> = new Map([
  ['힐스테이트 e편한세상 문정', { brand: '힐스테이트·e편한세상', year: 2024, sources: ['https://www.khba.or.kr/user/isale/isaleInfo.do?busiResuSeq=10&memSeq=2004-0048'] }],
  ['가락쌍용1차', { brand: '쌍용', homes: 2064, year: 1997, station: ['경찰병원역', 5], school: ['서울가주초', 1], sources: ['https://www.songpa.go.kr/www/contents.do?key=5847', 'https://realty.daangn.com/complexes/10667566'] }],
  ['래미안슈르', { brand: '래미안', homes: 2899, year: 2008, sources: ['https://bigvalue.ai/dashboard/apartment/경기도/과천시/원문동/c01906547'] }],
  ['광장현대3단지', { brand: '현대', homes: 1056, sources: ['https://openapt.seoul.go.kr/openApt/index.do?aptCode=A14381415'] }],
  ['고덕 아이파크', { brand: '아이파크', station: ['고덕역', 7], school: ['서울묘곡초', 3], sources: ['https://realty.daangn.com/complexes/10654556'] }],
  ['청량리한신', { brand: '한신', homes: 960, year: 1997, sources: ['https://www.k-apt.go.kr/cmmn/introMmentPop.do?bjdCode=11&searchOccuDate=201606'] }],
  ['평촌 공작부영', { brand: '부영', year: 1993, sources: ['https://chungyakalji.com/complex/A43181406'] }],
  ['철산주공 12단지', { brand: '주공', homes: 1800, year: 1986, station: ['철산역', 3], school: ['광명광성초', 2], sources: ['https://realty.daangn.com/complexes/15028901/topics/transportation', 'https://realty.chosun.com/site/data/html_dir/2026/09/06/2026090600874.html'] }],
  ['철산주공 13단지', { brand: '주공', year: 1986, station: ['철산역', 2], school: ['광명광성초', 1], sources: ['https://realty.daangn.com/complexes/15028452'] }],
  ['대치 은마', { year: 1979, station: ['대치역', 1], sources: ['https://realty.daangn.com/complexes/10689421/topics/school-district'] }],
  ['길음 롯데캐슬클라시아', { brand: '롯데캐슬', homes: 2033, year: 2022, sources: ['https://www.mk.co.kr/news/realestate/12157064'] }],
  ['인덕원센트럴푸르지오', { brand: '푸르지오', homes: 408, year: 2001, sources: ['https://www.aptfit.co.kr/complex/A43783103'] }],
  ['관악푸르지오', { brand: '푸르지오', homes: 2104, year: 2004, sources: ['https://statnorth.kr/apt/서울/관악구/봉천동-관악푸르지오-f27bf1e7fd70'] }],
  ['관악현대', { brand: '현대', homes: 1729, year: 1992, sources: ['https://statnorth.kr/apt/서울/관악구/봉천동-현대(관악)-9f8d847d6259'] }],
]);

const axes = [
  ['브', '브랜드', '출처에서 확인한 브랜드 표기'],
  ['역', '역세권', '현재 운영역까지 출처에 표시된 도보 10분 이내'],
  ['대', '대단지', '기존 단지 기준 1,000세대 이상'],
  ['신', '신축', '사용승인 연도와 현재 한국시간 연도의 차이가 5년 이내'],
  ['평', '평지', '보행 경사 실측 자료 확인 필요'],
  ['초', '초등학교', '출처에 표시된 인근 초등학교까지 도보 5분 이내'],
] as const;
const colors = ['#1d4ed8', '#047857', '#a21caf'];
const point = (axis: number, radius: number) => {
  const angle = (axis * 60 - 90) * Math.PI / 180;
  return [150 + Math.cos(angle) * radius, 125 + Math.sin(angle) * radius] as const;
};
const rings = [35, 75];
const walk = (place?: [string, number]) => place ? `${place[0]} 도보 약 ${place[1]}분` : null;

export default function ApartmentRadar({ names }: { names: string[] }) {
  const year = new Date(Date.now() + 9 * 3600_000).getUTCFullYear();
  const entries = names.map((name, index) => {
    const p = profiles.get(name);
    const values = [
      p?.brand ? { label: p.brand, pass: true } : null,
      p?.station ? { label: walk(p.station), pass: p.station[1] <= 10 } : null,
      p?.homes ? { label: `${p.homes.toLocaleString('ko-KR')}세대`, pass: p.homes >= 1000 } : null,
      p?.year ? { label: `${p.year}년 사용승인`, pass: year - p.year <= 5 } : null,
      null,
      p?.school ? { label: walk(p.school), pass: p.school[1] <= 5 } : null,
    ];
    return { name, color: colors[index], values, sources: p?.sources ?? [] };
  });

  return (
    <section className="mt-4 border-t border-slate-200 pt-4" aria-label="브역대신평초 비교">
      <h4 className="font-semibold">브역대신평초 입지 비교</h4>
      <p className="mt-1 text-sm text-slate-600">바깥쪽은 기준 충족, 안쪽은 기준 미달입니다. 점이 없는 축은 미확인입니다.</p>
      <div className="mt-2 grid items-start gap-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
        <svg viewBox="0 0 300 250" className="mx-auto w-full max-w-xs" aria-hidden="true">
          {rings.map(radius => <polygon key={radius} points={axes.map((_, i) => point(i, radius).join(',')).join(' ')} fill="none" stroke="#cbd5e1" />)}
          {axes.map(([key, label], i) => {
            const [x, y] = point(i, 75);
            const [lx, ly] = point(i, 106);
            return <g key={key}><line x1={150} y1={125} x2={x} y2={y} stroke="#e2e8f0" /><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#334155">{label}</text></g>;
          })}
          {entries.map(({ name, color, values }, index) => <g key={name}>
            {values.map((value, i) => {
              if (!value) return null;
              const [x, y] = point(i, (value.pass ? 75 : 35) + (index - (entries.length - 1) / 2) * 7);
              return <circle key={i} cx={x} cy={y} r={3.5} fill={color} stroke="white" strokeWidth={1} />;
            })}
          </g>)}
        </svg>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[18rem] text-left text-sm">
            <thead><tr><th scope="col" className="p-2">비교 기준</th>{entries.map(({ name, color }) => <th scope="col" key={name} className="p-2"><span style={{ color }} aria-hidden="true">● </span>{name}</th>)}</tr></thead>
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
      <p className="text-xs text-slate-600">도보 시간은 출처의 추정치이며 단지 출입구에 따라 달라집니다. 초등학교 배정은 주소별로 확인해야 합니다.</p>
    </section>
  );
}
