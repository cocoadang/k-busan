import evidence from '../housing/songApartmentVideoEvidence.json';

export const songVideoUrl = (id: string, time: number) => `https://www.youtube.com/watch?v=${id}&t=${time}s`;

function formatTimestamp(time: number) {
  return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;
}

export function AdditionalSongEvidence({ apartmentName }: { apartmentName: string }) {
  const entries = evidence.flatMap(({ videoId, comparisons }) =>
    comparisons.filter(item => item.priceSearchName === apartmentName).map(item => ({ ...item, videoId })));
  if (!entries.length) return null;
  return <ul className="space-y-1">
    {entries.map(({ videoId, time, topic, note }) =>
      <li key={`${videoId}:${time}`}>
        <a className="text-blue-800 underline" href={songVideoUrl(videoId, time)} target="_blank" rel="noreferrer">
          추가 영상 · {topic} ({formatTimestamp(time)})
        </a>
        <span className="ml-2">{note}</span>
      </li>
    )}
  </ul>;
}

export function SongApartmentVideoEvidence() {
  return <section aria-labelledby="song-video-evidence-title" className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <h2 id="song-video-evidence-title" className="text-xl font-bold text-slate-900">영상에서 확인한 입지 비교</h2>
    <p className="mt-1 text-sm text-slate-600">송희구 작가의 영상 당시 조건부 의견입니다. 현재 시세나 사업 진행 상황을 뜻하지 않습니다. 실거래가 검색에 반영하지 않은 단지도 포함합니다.</p>
    {evidence.map(({ videoId, label, comparisons }) =>
      <div key={videoId} className="mt-5">
        <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {comparisons.map(({ name, topic, note, time, priceSearchName }) =>
            <li key={name} className="min-w-0 rounded-xl bg-slate-50 p-4">
              <h4 className="break-words font-bold text-slate-900">{name}</h4>
              <p className="mt-1 text-xs font-medium text-slate-600">{priceSearchName ? '기존 검색 단지 · 추가 영상 근거' : '영상 근거 확인 · 실거래 검색 미반영'}</p>
              <p className="mt-2 text-sm text-slate-700"><strong>{topic}</strong> · {note}</p>
              <a className="mt-2 inline-block text-sm font-semibold text-blue-800 underline"
                href={songVideoUrl(videoId, time)} target="_blank" rel="noreferrer">
                {name} 발언 보기 ({formatTimestamp(time)})
              </a>
            </li>
          )}
        </ul>
      </div>
    )}
  </section>;
}
