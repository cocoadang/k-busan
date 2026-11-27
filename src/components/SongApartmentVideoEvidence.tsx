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
