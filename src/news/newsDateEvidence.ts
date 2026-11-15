import type { RawCollectedItem } from "../types/redevelopment";
function day(y: number, m: number, d: number) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? date.toISOString().slice(0, 10)
    : undefined;
}
export function newsDateSupported(
  item: RawCollectedItem,
  date: string,
  quote: unknown,
) {
  if (!item.newsEvidence) return true;
  if (typeof quote !== "string" || quote.length < 3 || quote.length > 500)
    return false;
  const marker = "[본문]\n",
    at = item.content.indexOf(marker);
  if (at < 0 || !item.content.slice(at + marker.length).includes(quote))
    return false;
  const dates = new Set<string>();
  const add = (x: string | undefined) => {
    if (x) dates.add(x);
  };
  const publication = item.newsEvidence.publishedAt;
  const anchor = publication
    ? new Date(Date.parse(publication) + 9 * 3600000)
    : undefined;
  const y = anchor?.getUTCFullYear(),
    m = (anchor?.getUTCMonth() ?? 0) + 1,
    d = anchor?.getUTCDate();
  for (const match of quote.matchAll(
    /(20\d{2})\s*(?:년|[.\/-])\s*(\d{1,2})\s*(?:월|[.\/-])\s*(\d{1,2})\s*일?/g,
  ))
    add(day(+match[1], +match[2], +match[3]));
  if (y && d) {
    for (const match of quote.matchAll(
      /(?:(내년|지난해|작년|올해|오는|지난)\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/g,
    )) {
      if (/20\d{2}\s*년\s*$/.test(quote.slice(0, match.index))) continue;
      let year = y;
      if (match[1] === "내년") year++;
      if (["지난해", "작년"].includes(match[1] || "")) year--;
      if (match[1] === "지난" && +match[2] > m) year--;
      if (match[1] === "오는" && +match[2] < m) year++;
      add(day(year, +match[2], +match[3]));
    }
    for (const match of quote.matchAll(/(?:(지난|오는)\s*)?(\d{1,2})\s*일/g)) {
      const prefix = quote.slice(Math.max(0, match.index! - 12), match.index);
      if (/\d\s*월\s*$/.test(prefix)) continue;
      let month = m,
        year = y;
      if (match[1] === "지난" && +match[2] > d) {
        month--;
        if (!month) {
          month = 12;
          year--;
        }
      }
      if (match[1] === "오는" && +match[2] < d) {
        month++;
        if (month === 13) {
          month = 1;
          year++;
        }
      }
      add(day(year, month, +match[2]));
    }
    if (/전날|어제/.test(quote))
      add(new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10));
    if (/이날|오늘/.test(quote)) add(day(y, m, d));
  }
  return dates.has(date);
}
