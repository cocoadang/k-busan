import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import type { AssociationBoardConfig, RawCollectedItem, RedevelopmentProject } from '../types/redevelopment';

/** Legacy default (촉진3구역 board); the per-project config lives in the registry. */
export const ASSOCIATION_LIST_URL = 'https://dynamice.busan.go.kr/view.do?no=287';
type BoardSelector = Pick<AssociationBoardConfig, 'listUrl' | 'boardId' | 'areaId' | 'detailMenuNo' | 'titlePattern'>;
const DEFAULT_BOARD: BoardSelector = {
  listUrl: ASSOCIATION_LIST_URL, boardId: 'BBSMSTR_000000000080', areaId: 'BARA_0000000000151', detailMenuNo: '329', titlePattern: '촉진\\s*3',
};
const HOURS72 = 72 * 3600000;
export function canonicalAssociationUrl(value: string): string {
  const url = new URL(value, ASSOCIATION_LIST_URL);
  if (url.hostname !== 'dynamice.busan.go.kr' || url.protocol !== 'https:') throw new Error('UNTRUSTED_BOARD_URL');
  for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
  url.hash = '';
  url.searchParams.sort();
  return url.toString();
}
function clean(text: string) { return text.replace(/\s+/g, ' ').trim(); }
export function parseKstDate(text: string): string | undefined {
  const m = text.match(/(20\d{2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return undefined;
  const [y, mo, d] = m.slice(1, 4).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return undefined;
  const h = Number(m[4] || 0), min = Number(m[5] || 0), sec = Number(m[6] || 0);
  if (h > 23 || min > 59 || sec > 59) return undefined;
  return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}+09:00`;
}
export interface BoardEntry { title: string; url: string; publishedAt: string; }
export function parseAssociationList(html: string, board: BoardSelector = DEFAULT_BOARD): { entries: BoardEntry[]; nextUrl?: string; oldestPublishedAt?: string } {
  const $ = load(html);
  const listUrl = board.listUrl, listNo = new URL(listUrl).searchParams.get('no');
  const detailBase = `https://dynamice.busan.go.kr/home/${board.areaId}/view.do?no=${board.detailMenuNo}&pgMode=view`;
  const titleRe = new RegExp(board.titlePattern);
  // The live portal uses cards and move_view(id, board, area), not direct links.
  const cards = $('.board-list-ul > li');
  if (cards.length) {
    const entries: BoardEntry[] = [], dates: string[] = [];
    cards.each((_, row) => {
      const card = $(row), a = card.children('a').first();
      const call = (a.attr('onclick') || '').match(/move_view\(\s*['"](\d+)['"]\s*,\s*['"](BBSMSTR_\d+)['"]\s*,\s*['"](BARA_\d+)['"]\s*\)/);
      const publishedAt = parseKstDate(card.find('.left-box').text());
      const title = clean(card.find('.b-tit').clone().find('span').remove().end().text());
      if (!call || !publishedAt || !title || call[2] !== board.boardId) throw new Error('BOARD_PARSE_UNVERIFIED: 카드 링크 또는 게시일 확인 실패');
      dates.push(publishedAt);
      if (call[3] === board.areaId) {
        entries.push({title, publishedAt, url: canonicalAssociationUrl(`/home/${call[3]}/view.do?no=${board.detailMenuNo}&pgMode=view&ntt_id=${call[1]}`)});
      }
    });
    const current = Number($('#boardFrm input[name="pageIndex"]').val());
    if (!Number.isInteger(current) || current < 1) throw new Error('BOARD_PARSE_UNVERIFIED: 페이지 번호 확인 실패');
    const pageNumbers = $('.board-paging a').map((_, el) => Number(($(el).attr('onclick') || '').match(/linkPage\((\d+)\)/)?.[1] || 0)).get();
    let nextUrl: string | undefined;
    if (pageNumbers.some(n => n > current)) {
      const u = new URL(listUrl);
      $('#boardFrm input[name],#boardFrm select[name]').each((_, el) => {
        const name = $(el).attr('name')!, value = String($(el).val() || '');
        if (['no','pgMode','searchCondition','searchKeyword'].includes(name) && value) u.searchParams.set(name,value);
      });
      u.searchParams.set('pageIndex',String(current + 1));
      nextUrl = canonicalAssociationUrl(u.toString());
    }
    const descending = dates.every((d,i) => i === 0 || Date.parse(d) <= Date.parse(dates[i-1]));
    return {entries, nextUrl, oldestPublishedAt: descending ? dates.at(-1) : undefined};
  }
  const entries = new Map<string, BoardEntry>();
  let recognized = false, malformed = false;
  $('tr, li').each((_, row) => {
    const block = $(row), text = clean(block.text());
    if (!titleRe.test(text)) return;
    block.find('a').each((_, link) => {
      const a = $(link), title = clean(a.text());
      if (!titleRe.test(title)) return;
      let href = a.attr('href') || '';
      if (!href.includes('ntt_id=')) {
        const script = a.attr('onclick') || href;
        const id = script.match(/ntt_id\s*[=:]\s*['"]?(\d+)/)?.[1];
        if (id) href = `${detailBase}&ntt_id=${id}`;
      }
      if (!href.includes('ntt_id=')) return;
      recognized = true;
      const publishedAt = parseKstDate(text);
      if (!publishedAt) { malformed = true; return; }
      try {
        const url = canonicalAssociationUrl(href);
        if (!url.includes(`/${board.areaId}/`)) return;
        entries.set(url, { title, url, publishedAt });
      } catch { malformed = true; }
    });
  });
  const explicitEmpty = /등록된\s*(게시물|자료|글)이?\s*(없|존재하지)/.test($.text());
  const knownBoard = /입찰/.test($('title,h1,h2,h3,caption').text()) && $('table').length > 0;
  const otherRows = $('a[href*="ntt_id="]').length > 0;
  if (malformed || (!recognized && !explicitEmpty && !(knownBoard && otherRows))) throw new Error('BOARD_PARSE_UNVERIFIED: 목록 구조 또는 게시일 확인 실패');
  const next = $('a').filter((_, el) => /^(다음|다음페이지|next|>)$/i.test(clean($(el).text()) || $(el).attr('title') || '')).first().attr('href');
  let nextUrl: string | undefined;
  if (next && !next.startsWith('javascript')) {
    const candidate = canonicalAssociationUrl(next);
    if (new URL(candidate).searchParams.get('no') === listNo) nextUrl = candidate;
  }
  return { entries: [...entries.values()], nextUrl };
}
export function parseAssociationDetail(html: string, url: string) {
  const $ = load(html);
  $('script,style,nav,header,footer').remove();
  const content = $('.board-view-contants,.bbs_view_cont,.board_view_cont,.view_cont,.view_conts,.bbs_content,.board_view_content,#nttCn,.board_view,.bbs_view').first();
  if (!content.length) throw new Error('DETAIL_PARSE_UNVERIFIED: 공고 본문 확인 실패');
  const attachments: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    // Public download control observed on the official board. Parse its arguments;
    // never evaluate JavaScript, follow private links, or infer an attachment ID.
    const call = href.match(/^javascript:fn_egov_downFile\('([A-Za-z0-9%+/=_-]+)','(\d+)'\)$/);
    if (call && $(el).hasClass('board-view-fileDown')) {
      const download = new URL('/cmm/fms/FileDown.do', url);
      // A browser percent-decodes a javascript: URL before evaluating its body.
      // The public function then encodeURIComponent()s the decoded argument.
      // Mirror that one decode/encode cycle; do not repeatedly decode file IDs.
      download.searchParams.set('atchFileId', decodeURIComponent(call[1]));
      download.searchParams.set('fileSn', call[2]);
      attachments.push(canonicalAssociationUrl(download.toString()));
    }
    if (/download|getFile|fileDown|\.pdf|\.hwp|\.hwpx|\.docx/i.test(href)) {
      try { attachments.push(canonicalAssociationUrl(new URL(href, url).toString())); } catch { /* external downloads are not followed */ }
    }
  });
  const text = clean(content.text());
  if (text.length < 10 && !attachments.length) throw new Error('DETAIL_PARSE_UNVERIFIED: 공고 본문 확인 실패');
  return { content: text, attachments: [...new Set(attachments)], detailVerified: text.length >= 10 };
}
export async function readAssociationHtml(fetcher: typeof fetch, url: string, timeoutMs=15000): Promise<string> {
  const safeUrl = (value: string, base?: string) => {
    const u = new URL(value, base);
    if (u.hostname !== 'dynamice.busan.go.kr' || !u.pathname.endsWith('/view.do') || !['http:','https:'].includes(u.protocol)) throw new Error('BOARD_REDIRECT_REJECTED');
    // Keep the official request encrypted, including legacy http redirects.
    u.protocol = 'https:'; u.port = ''; return u.toString();
  };
  for (let attempt=0; attempt<2; attempt++) {
    try {
      let target=safeUrl(url);
      const signal=AbortSignal.timeout(timeoutMs);
      for(let hop=0; hop<4; hop++) {
        const r=await fetcher(target,{signal,redirect:'manual',headers:{Accept:'text/html,application/xhtml+xml'}});
        if([301,302,303,307,308].includes(r.status)) {
          const location=r.headers.get('location'); if(!location)throw new Error('BOARD_REDIRECT_WITHOUT_LOCATION');
          await r.body?.cancel(); target=safeUrl(location,target); continue;
        }
        if(!r.ok)throw new Error(`BOARD_HTTP_${r.status}`);
        const html=await r.text();if(!/^\s*</.test(html))throw new Error('BOARD_NON_HTML_RESPONSE');
        return html;
      }
      throw new Error('BOARD_REDIRECT_LIMIT');
    } catch(e:any) {
      const nestedCodes=e?.cause?.errors?.map((cause:any)=>cause.code).filter(Boolean).join(',');
      const code=e?.cause?.code || nestedCodes || e?.name || 'UNKNOWN';
      const transient=/TIMEOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN/i.test(String(code)) || e?.message==='fetch failed';
      if(attempt===0 && transient) continue;
      // Codes only; no credentials, headers or environment values in diagnostics.
      throw new Error(`${e?.message || 'BOARD_FETCH_FAILED'} [${code}]`);
    }
  }
  throw new Error('BOARD_FETCH_FAILED');
}
export class AssociationNoticeCollector {
  constructor(private fetcher: typeof fetch = fetch, private clock: () => Date = () => new Date()) {}
  async fetchForProject(project: RedevelopmentProject, options: { timeoutMs?: number; maxPages?: number } = {}) {
    const items: RawCollectedItem[] = [], errors: string[] = [];
    const board = project.associationBoard;
    if (!board) return { items, error: undefined, configured: false };
    const now = this.clock();
    const read = (url: string) => readAssociationHtml(this.fetcher,url,options.timeoutMs || 15000);
    let pagesRead=0;
    let next: string | undefined = board.listUrl;
    const visited = new Set<string>(), seen = new Set<string>();
    try {
      for (let page = 0; next && page < (options.maxPages || 5); page++) {
        if (visited.has(next)) throw new Error('BOARD_PAGINATION_LOOP');
        visited.add(next);
        const parsed = parseAssociationList(await read(next), board);
        pagesRead++;
        for (const entry of parsed.entries) {
          const age = now.getTime() - Date.parse(entry.publishedAt);
          // Date-only notices are conservatively measured from KST midnight.
          if (age < 0 || age > HOURS72 || seen.has(entry.url)) continue;
          seen.add(entry.url);
          let content = entry.title, attachmentUrls: string[] = [], detailVerified = false;
          try {
            const detail = parseAssociationDetail(await read(entry.url), entry.url);
            content = detail.content || entry.title; attachmentUrls = detail.attachments; detailVerified = detail.detailVerified;
            // HTML verification does not verify linked attachment contents.
            if (!detailVerified || attachmentUrls.length > 0) errors.push(`상세 확인 미완료 ${entry.url}: ATTACHMENT_CONTENT_UNVERIFIED`);
          }
          catch (e) { errors.push(`상세 확인 실패 ${entry.url}: ${(e as Error).message}`); }
          const nttId = new URL(entry.url).searchParams.get('ntt_id');
          const fingerprint = `association:${project.id}:${nttId}`;
          items.push({ id: createHash('sha256').update(fingerprint).digest('hex'), projectId: project.id,
            sourceTier: 'official', sourceType: 'official-web', sourceName: board.sourceName,
            sourceUrl: entry.url, title: entry.title, content, publishedAt: entry.publishedAt, collectedAt: now.toISOString(),
            rawFingerprint: fingerprint, matchedKeywords: [...board.matchedKeywords], actorType: 'association', detailVerified, attachmentUrls,
            attachmentContentStatus: attachmentUrls.length ? 'unverified' : 'not_applicable' });
        }
        next = parsed.oldestPublishedAt && now.getTime() - Date.parse(parsed.oldestPublishedAt) > HOURS72 ? undefined : parsed.nextUrl;
      }
      if (next) errors.push('BOARD_PAGINATION_LIMIT: 전체 최근 공고 확인 미완료');
    } catch (e) { errors.push(`조합 게시판 수집 실패: ${(e as Error).message}`); }
    return { items, pagesRead, error: errors.length ? errors.join('; ') : undefined, configured: true };
  }
}
