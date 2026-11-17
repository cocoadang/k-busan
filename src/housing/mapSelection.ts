import DATA from '../data/busanHousingMap.json';
const apartments = new Set(DATA.apartments.map(p => p.id));
const projects = new Set(DATA.projects.map(p => p.id));
export function mapSelectionFromHash(hash: string): string | null {
  const [path, query = ''] = hash.split('?');
  const [tab, id] = path.replace(/^#\/?/, '').split('/');
  if (tab !== 'housing') return null;
  const place = new URLSearchParams(query).get('place');
  if (place === 'all') return null;
  if (place && apartments.has(place)) return place;
  return projects.has(id) ? id : null;
}
export function mapSelectionHash(id: string | null, current: string): string {
  if (id && projects.has(id)) return `#/housing/${id}`;
  const candidate = current.split('?')[0].split('/')[2];
  const project = id === 'busan_samick_beach' ? 'samik-beach' : projects.has(candidate) ? candidate : 'chokjin-3';
  return `#/housing/${project}?place=${id && apartments.has(id) ? encodeURIComponent(id) : 'all'}`;
}
