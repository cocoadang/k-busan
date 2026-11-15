import { pacedOfficialFetch } from './officialRequestGovernor';
import { createHash } from 'crypto';
import { load } from 'cheerio';
import { parseKstDate } from './associationCollector';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { RawCollectedItem, RedevelopmentProject } from '../types/redevelopment';

/**
 * KST (Korea Standard Time, UTC+9) Date string helper (YYYYMMDD)
 */
export function getKstDateString(offsetDays = 0, baseDate = new Date()): string {
  const kst = new Date(baseDate.getTime() + (9 * 60 + offsetDays * 24 * 60) * 60000);
  return `${kst.getUTCFullYear()}${String(kst.getUTCMonth()+1).padStart(2,'0')}${String(kst.getUTCDate()).padStart(2,'0')}`;
}

export interface SaeolRawNoticeItem {
  ttlNm?: string;
  mngNo?: string;
  regDt?: string;
  ancmntNo?: string;
  manageNo?: string;
  seq?: string;
  noticeNo?: string;
  ancmntNm?: string;
  title?: string;
  sj?: string;
  ancmntTitle?: string;
  pbltnYmd?: string;
  regDate?: string;
  pbltnDt?: string;
  date?: string;
  tkcgDeptNm?: string;
  deptNm?: string;
  tkcgDept?: string;
  seNm?: string;
  ancmntSeNm?: string;
  gubun?: string;
  ancmntUrl?: string;
  detailUrl?: string;
  linkUrl?: string;
  url?: string;
  ancmntCn?: string;
  content?: string;
  [key: string]: any;
}

export interface SaeolFetchResponse {
  success: boolean;
  httpStatus: number;
  resultCode: string;
  totalCount: number;
  pageNo: number;
  numOfRows: number;
  items: SaeolRawNoticeItem[];
  error?: string;
  rawFieldNames: string[];
}

/**
 * Official Administration Notices Collector
 * Integrates with Busan Metropolitan City Saeol Notice Open API:
 * - Base: https://apis.data.go.kr/6260000/SaeolAncmntInfoService
 * - Operation: /getSaeolAncmntInfo
 *
 * Rules:
 * - Reads API key strictly from process.env.DATA_GO_KR_API_KEY
 * - Never prints or logs the API key
 * - Queries the latest seven calendar dates (KST) in monitoring cycles
 * - Deterministic alias filtering before semantic analysis
 * - Stable document key generation to prevent duplicates across cycles
 * - Strictly REAL DATA OR EXPLICIT FAILURE (Fail-closed)
 */
export class OfficialNoticeCollector {
  private readonly baseUrl = 'https://apis.data.go.kr/6260000/SaeolAncmntInfoService/getSaeolAncmntInfo';
  private readonly sourceName = '부산광역시 새올고시정보';

  /**
   * Safe access to API Key (Never logged or printed)
   */
  private getApiKey(): string | undefined {
    const key = process.env.DATA_GO_KR_API_KEY?.trim();
    if (!key) return undefined;
    // URLSearchParams encodes once; accept the portal's encoded or raw key.
    try { return /%[0-9a-f]{2}/i.test(key) ? decodeURIComponent(key) : key; }
    catch { return key; }
  }

  public getRegisteredEndpoints() {
    return {
      'busan-saeol-api': {
        name: this.sourceName,
        url: this.baseUrl,
        sourceType: 'official-api',
      },
    };
  }

  /**
   * Execute a single page request to the Saeol Notice API
   */
  private lastCheck?: { success: boolean; httpStatus: number; resultCode: string; checkedAt: string };

  public getLastCheck() { return this.lastCheck ? { ...this.lastCheck } : undefined; }

  public async fetchRawPage(params: Parameters<OfficialNoticeCollector['requestRawPage']>[0]): Promise<SaeolFetchResponse> {
    const result = await this.requestRawPage(params);
    this.lastCheck = { success: result.success, httpStatus: result.httpStatus,
      resultCode: result.resultCode, checkedAt: new Date().toISOString() };
    return result;
  }

  private async requestRawPage(params: {
    pbltnYmd: string;
    pageNo?: number;
    numOfRows?: number;
    tkcgDeptNm?: string;
    seNm?: string;
    timeoutMs?: number;
  }): Promise<SaeolFetchResponse> {
    const apiKey = this.getApiKey();
    const pageNo = params.pageNo || 1;
    const numOfRows = params.numOfRows || 50;
    const timeoutMs = params.timeoutMs || 8000;

    // Fail-Closed: API Key missing -> Explicit failure without mock generation
    if (!apiKey) {
      return {
        success: false,
        httpStatus: 401,
        resultCode: 'API_KEY_MISSING',
        totalCount: 0,
        pageNo,
        numOfRows,
        items: [],
        error: 'DATA_GO_KR_API_KEY 환경변수가 설정되지 않음 (공식 API 미검증 / Fail-Closed)',
        rawFieldNames: [],
      };
    }

    const queryParams = new URLSearchParams();
    queryParams.set('serviceKey', apiKey);
    queryParams.set('pageNo', String(pageNo));
    queryParams.set('numOfRows', String(numOfRows));
    queryParams.set('resultType', 'json');
    queryParams.set('pbltnYmd', params.pbltnYmd);

    if (params.tkcgDeptNm) {
      queryParams.set('tkcgDeptNm', params.tkcgDeptNm);
    }
    if (params.seNm) {
      queryParams.set('seNm', params.seNm);
    }

    const requestUrl = `${this.baseUrl}?${queryParams.toString()}`;
    let observedHttpStatus = 0;
    try {
      const response = await pacedOfficialFetch(requestUrl, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'BusanRedevelopmentNewsMonitor/1.0',
        },
      });

      const httpStatus = response.status;
      observedHttpStatus = httpStatus;
      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();

      const isJson =
        contentType.includes('application/json') ||
        contentType.includes('+json') ||
        contentType.includes('text/json');

      // The gateway can return XML errors even when resultType=json.
      let parsed: any;
      try {
        if (!isJson && responseText.trim().startsWith('<')) {
          if (XMLValidator.validate(responseText) !== true) throw new Error('Invalid XML');
          parsed = new XMLParser({ parseTagValue: false }).parse(responseText);
        } else {
          parsed = JSON.parse(responseText);
        }
      } catch {
        return { success: false, httpStatus, resultCode: 'INVALID_API_RESPONSE',
          totalCount: 0, pageNo, numOfRows, items: [],
          error: `공식 API 응답 파싱 실패 (HTTP ${httpStatus})`, rawFieldNames: [] };
      }

      const responseHeader = parsed.response?.header || parsed.result;
      const responseCode = String(responseHeader?.resultCode ?? 'UNKNOWN');
      if (response.ok && ['03', '3'].includes(responseCode) && responseHeader?.resultMsg === 'NODATA_ERROR') {
        return { success: true, httpStatus, resultCode: responseCode, totalCount: 0,
          pageNo, numOfRows, items: [], rawFieldNames: Object.keys(responseHeader) };
      }

      // Check for OpenAPI_ServiceResponse error format (e.g. key errors)
      if (parsed.OpenAPI_ServiceResponse?.cmmMsgHeader) {
        const header = parsed.OpenAPI_ServiceResponse.cmmMsgHeader;
        const errMsg = header.errMsg || header.returnAuthMsg || 'API 에러 응답';
        const returnReasonCode = header.returnReasonCode || 'UNKNOWN';
        return {
          success: false,
          httpStatus,
          resultCode: returnReasonCode,
          totalCount: 0,
          pageNo,
          numOfRows,
          items: [],
          error: `부산 새올고시 API 오류: ${errMsg} (Code: ${returnReasonCode}) [HTTP ${httpStatus}]`,
          rawFieldNames: Object.keys(header),
        };
      }

      // Normal Response Structure: response.header & response.body
      const header = responseHeader;
      const body = parsed.response?.body;
      const resultCode = String(header?.resultCode ?? 'UNKNOWN');

      if (!response.ok || (resultCode !== '00' && resultCode !== '0')) {
        const resultMsg = header?.resultMsg || 'API 응답 비정상 코드';
        return {
          success: false,
          httpStatus,
          resultCode,
          totalCount: 0,
          pageNo,
          numOfRows,
          items: [],
          error: `부산 새올고시 API 비정상 코드 반환: ${resultMsg} (Code: ${resultCode})`,
          rawFieldNames: header ? Object.keys(header) : [],
        };
      }

      if (!body || !/^\d+$/.test(String(body.totalCount ?? '')) || !Number.isSafeInteger(Number(body.totalCount))) return { success: false, httpStatus, resultCode: 'BODY_UNVERIFIED', totalCount: 0, pageNo, numOfRows, items: [], error: '새올 API 응답 본문 확인 실패', rawFieldNames: [] };
      const totalCount = Number(body.totalCount);
      let rawItems: SaeolRawNoticeItem[] = [];

      if (body?.items?.item) {
        if (Array.isArray(body.items.item)) {
          rawItems = body.items.item;
        } else if (typeof body.items.item === 'object') {
          rawItems = [body.items.item];
        }
      }

      const rawFieldNames = rawItems.length > 0 ? Object.keys(rawItems[0]) : body ? Object.keys(body) : [];
      const expected = Math.min(numOfRows, Math.max(0, totalCount - (pageNo - 1) * numOfRows));
      if (rawItems.length !== expected || rawItems.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
        return { success: false, httpStatus, resultCode: 'ITEMS_UNVERIFIED', totalCount, pageNo, numOfRows,
          items: [], error: '새올 API 총건수와 페이지 항목 불일치 (수집 미완료)', rawFieldNames };
      }

      return {
        success: true,
        httpStatus,
        resultCode,
        totalCount,
        pageNo,
        numOfRows,
        items: rawItems,
        rawFieldNames,
      };
    } catch (err: any) {
      return {
        success: false,
        httpStatus: observedHttpStatus,
        resultCode: 'NETWORK_OR_TIMEOUT_ERROR',
        totalCount: 0,
        pageNo,
        numOfRows,
        items: [],
        error: `부산 새올고시 API 연결/본문 수신 실패 [${err?.cause?.code || err?.name || 'UNKNOWN'}]`,
        rawFieldNames: [],
      };
    }
  }

  /**
   * Fetch all notices for a given date with pagination handling
   */
  public async fetchAllNoticesForDate(
    pbltnYmd: string,
    options: { timeoutMs?: number; maxPages?: number } = {}
  ): Promise<{
    success: boolean;
    httpStatus: number;
    resultCode: string;
    totalCount: number;
    items: SaeolRawNoticeItem[];
    error?: string;
    rawFieldNames: string[];
  }> {
    const maxPages = options.maxPages || 5;
    // Government gateways intermittently drop connections. Retry only transport
    // failures, never authentication, malformed data or incomplete pagination.
    const readPage = async (params: Parameters<OfficialNoticeCollector['fetchRawPage']>[0]) => {
      let result = await this.fetchRawPage(params);
      if (result.resultCode === 'NETWORK_OR_TIMEOUT_ERROR') {
        await new Promise(resolve => setTimeout(resolve, Math.min(250, params.timeoutMs || 8000)));
        result = await this.fetchRawPage(params);
      }
      return result;
    };
    const firstPage = await readPage({
      pbltnYmd,
      pageNo: 1,
      numOfRows: 50,
      timeoutMs: options.timeoutMs,
    });

    if (!firstPage.success) {
      return {
        success: false,
        httpStatus: firstPage.httpStatus,
        resultCode: firstPage.resultCode,
        totalCount: 0,
        items: [],
        error: firstPage.error,
        rawFieldNames: firstPage.rawFieldNames,
      };
    }

    const allItems: SaeolRawNoticeItem[] = [...firstPage.items];
    const totalCount = firstPage.totalCount;
    const numOfRows = firstPage.numOfRows;
    const totalPages = Math.min(Math.ceil(totalCount / numOfRows), maxPages);
    const errors: string[] = [];
    if (Math.ceil(totalCount / numOfRows) > maxPages) errors.push('새올 API 페이지 제한: 전체 확인 미완료');

    // Fetch subsequent pages if totalCount > 50
    for (let page = 2; page <= totalPages; page++) {
      const nextPage = await readPage({
        pbltnYmd,
        pageNo: page,
        numOfRows,
        timeoutMs: options.timeoutMs,
      });
      if (nextPage.success && nextPage.items.length > 0) {
        allItems.push(...nextPage.items);
      } else if (!nextPage.success) errors.push(nextPage.error || '새올 후속 페이지 실패');
    }

    return {
      success: errors.length === 0,
      httpStatus: firstPage.httpStatus,
      resultCode: firstPage.resultCode,
      totalCount,
      items: allItems,
      rawFieldNames: firstPage.rawFieldNames,
      error: errors.length ? errors.join('; ') : undefined,
    };
  }

  /**
   * Deterministic filter: Matches project aliases and administrative keywords
   */
  public filterNoticesForProject(
    rawNotices: SaeolRawNoticeItem[],
    project: RedevelopmentProject
  ): RawCollectedItem[] {
    const matchedItems: RawCollectedItem[] = [];
    const seenStableKeys = new Set<string>();

    for (const raw of rawNotices) {
      const title = (raw.ttlNm || raw.ancmntNm || raw.title || raw.sj || raw.ancmntTitle || '').trim();
      const content = (raw.ancmntCn || raw.content || '').trim();
      const combinedText = `${title} ${content}`;

      if (!combinedText) continue;

      // Check alias match
      const matchedAliases = project.aliases.filter((alias) => combinedText.includes(alias));
      if (matchedAliases.length === 0) continue;

      // Check administrative/redevelopment context
      const hasContext =
        combinedText.includes('인가') ||
        combinedText.includes('고시') ||
        combinedText.includes('공고') ||
        combinedText.includes('정비') ||
        combinedText.includes('촉진') ||
        combinedText.includes('재개발') ||
        combinedText.includes('조합') ||
        combinedText.includes('시공') ||
        combinedText.includes('선정') ||
        combinedText.includes('입찰');

      if (!hasContext) continue;

      const pbltnYmd = raw.pbltnYmd || raw.regDate || raw.pbltnDt || raw.date || raw.regDt || '';
      const deptNm = raw.tkcgDeptNm || raw.deptNm || raw.tkcgDept || '';
      const seNm = raw.seNm || raw.ancmntSeNm || raw.gubun || '';
      const noticeNo = raw.mngNo || raw.ancmntNo || raw.manageNo || raw.seq || raw.noticeNo || '';
      const rawUrl = (raw.ancmntUrl || raw.detailUrl || raw.linkUrl || raw.url || '').trim();

      // Stable Document Key: 기관 + 고시번호 + 게재일자 (또는 noticeNo)
      const stableDocKey = noticeNo
        ? `saeol_${noticeNo}`
        : `${deptNm}_${noticeNo}_${title.slice(0, 30)}_${pbltnYmd}`;

      if (seenStableKeys.has(stableDocKey)) {
        continue;
      }
      seenStableKeys.add(stableDocKey);

      const stableHash = createHash('sha256').update(stableDocKey).digest('hex').slice(0, 16);

      // ISO formatted publishedAt date
      let isoPublishedAt = new Date().toISOString();
      if (pbltnYmd.length === 8) {
        const y = pbltnYmd.slice(0, 4);
        const m = pbltnYmd.slice(4, 6);
        const d = pbltnYmd.slice(6, 8);
        isoPublishedAt = `${y}-${m}-${d}T00:00:00+09:00`;
      }

      matchedItems.push({
        id: `official_saeol_${stableHash}`,
        projectId: project.id,
        sourceTier: 'official',
        sourceType: 'official-api',
        sourceName: this.sourceName,
        sourceUrl: rawUrl || `${this.baseUrl}?pbltnYmd=${pbltnYmd}&noticeNo=${noticeNo || stableHash}`,
        title,
        content: content || `[공식 행정 고시·공고] ${title} (${deptNm || '지자체'} / ${seNm || '고시'} 제${noticeNo || 'N/A'}호)`,
        author: deptNm || undefined,
        publishedAt: isoPublishedAt,
        collectedAt: new Date().toISOString(),
        rawFingerprint: `${project.id}_${stableDocKey}`,
        matchedKeywords: matchedAliases,
        noticeNumber: noticeNo || undefined,
        department: deptNm || undefined,
        sectionType: seNm || undefined,
      });
    }

    return matchedItems;
  }

  /**
   * Per-cycle memo of date queries. Every Busan project needs the same 7 dates; without this
   * each project re-downloaded identical pages. Active only between beginRun() and endRun().
   */
  private runDateCache: Map<string, ReturnType<OfficialNoticeCollector['fetchAllNoticesForDate']>> | null = null;

  public beginRun(): void {
    this.runDateCache = new Map();
  }

  public endRun(): void {
    this.runDateCache = null;
  }

  private fetchDateShared(ymd: string, options: { timeoutMs?: number }) {
    if (!this.runDateCache) return this.fetchAllNoticesForDate(ymd, options);
    let pending = this.runDateCache.get(ymd);
    if (!pending) {
      pending = this.fetchAllNoticesForDate(ymd, options);
      this.runDateCache.set(ymd, pending);
    }
    return pending;
  }

  /**
   * Standard Monitoring Cycle Fetch
   * Queries the latest seven calendar dates (KST) to handle midnight boundaries
   */
  public async fetchForProject(
    project: RedevelopmentProject,
    options: { timeoutMs?: number; targetDates?: string[]; budgetMs?: number } = {}
  ): Promise<{
    items: RawCollectedItem[];
    error?: string;
    sourceName: string;
    targetUrl: string;
    httpStatus?: number;
    totalNoticesChecked: number;
    dateBreakdown: Record<string, { totalCount: number; matchedCount: number }>;
  }> {
    const targetDates = options.targetDates || Array.from({ length: 7 }, (_, day) => getKstDateString(-day));
    const allNotices: SaeolRawNoticeItem[] = [];
    const dateBreakdown: Record<string, { totalCount: number; matchedCount: number }> = {};
    const errors: string[] = [];
    let lastHttpStatus: number | undefined;

    // Bound gateway pressure to three dates at a time. A failed date must not
    // serialize seven retry windows and starve the durable analysis queue.
    const results = new Array<Awaited<ReturnType<OfficialNoticeCollector['fetchDateShared']>>>(targetDates.length);
    let nextDate = 0;
    const deadline = Date.now() + Math.min(60000, Math.max(1, options.budgetMs || 45000));
    await Promise.all(Array.from({ length: Math.min(3, targetDates.length) }, async () => {
      while (nextDate < targetDates.length) {
        const index = nextDate++;
        const remaining = deadline - Date.now();
        results[index] = remaining <= 0
          ? {success:false,httpStatus:0,resultCode:'COLLECTION_BUDGET_EXHAUSTED',totalCount:0,items:[],rawFieldNames:[],error:'SAEOL_BUDGET_EXHAUSTED: 해당 날짜 확인 미완료'}
          : await this.fetchDateShared(targetDates[index], { timeoutMs: Math.min(options.timeoutMs || 15000, Math.max(1, Math.floor(remaining / 2))) });
      }
    }));
    for (const [index, ymd] of targetDates.entries()) {
      const result = results[index];
      if (!result.success) {
        errors.push(`[${ymd}] ${result.error}`);
        lastHttpStatus = result.httpStatus;
        dateBreakdown[ymd] = { totalCount: 0, matchedCount: 0 };
      } else {
        lastHttpStatus = result.httpStatus;
        const matched = this.filterNoticesForProject(result.items, project);
        dateBreakdown[ymd] = {
          totalCount: result.totalCount,
          matchedCount: matched.length,
        };
        allNotices.push(...result.items);
      }
    }

    const filteredItems = this.filterNoticesForProject(allNotices, project);

    return {
      items: filteredItems,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      sourceName: this.sourceName,
      targetUrl: this.baseUrl,
      httpStatus: lastHttpStatus,
      totalNoticesChecked: allNotices.length,
      dateBreakdown,
    };
  }

  /**
   * Historical Backfill Query for a specific past date (YYYYMMDD)
   */
  public async historicalBackfill(
    pbltnYmd: string,
    project: RedevelopmentProject,
    options: { timeoutMs?: number } = {}
  ): Promise<{
    success: boolean;
    httpStatus: number;
    resultCode: string;
    totalCount: number;
    matchedItems: RawCollectedItem[];
    error?: string;
    rawFieldNames: string[];
  }> {
    const result = await this.fetchAllNoticesForDate(pbltnYmd, options);

    if (!result.success) {
      return {
        success: false,
        httpStatus: result.httpStatus,
        resultCode: result.resultCode,
        totalCount: 0,
        matchedItems: [],
        error: result.error,
        rawFieldNames: result.rawFieldNames,
      };
    }

    const matchedItems = this.filterNoticesForProject(result.items, project);

    return {
      success: true,
      httpStatus: result.httpStatus,
      resultCode: result.resultCode,
      totalCount: result.totalCount,
      matchedItems,
      rawFieldNames: result.rawFieldNames,
    };
  }
}


export const BUSAN_NOTICE_LIST = 'https://www.busan.go.kr/nbgosi';
// Independently verified missing notice; fetch its real page, never seed its text.
const RECOVERY_NOTICE = 'https://www.busan.go.kr/nbgosi/view?gosiGbn=N&sno=79798';
export function canonicalCityNoticeUrl(value: string): string {
  const u = new URL(value, BUSAN_NOTICE_LIST);
  if (u.protocol !== 'https:' || u.hostname !== 'www.busan.go.kr' || u.pathname !== '/nbgosi/view' || !/^\d+$/.test(u.searchParams.get('sno') || '')) throw new Error('INVALID_CITY_NOTICE_URL');
  const canonical = new URL('/nbgosi/view', BUSAN_NOTICE_LIST);
  canonical.searchParams.set('sno', u.searchParams.get('sno')!);
  canonical.searchParams.set('gosiGbn', u.searchParams.get('gosiGbn') || 'N');
  return canonical.toString();
}
const cityClean = (s: string) => s.replace(/\s+/g, ' ').trim();
export async function readCityNoticeHtml(fetcher: typeof fetch, url: string, timeoutMs=15000): Promise<string> {
  const safeUrl = (value: string, base?: string) => {
    const u = new URL(value, base);
    if (!['www.busan.go.kr','busan.go.kr'].includes(u.hostname) || !u.pathname.startsWith('/nbgosi') || !['http:','https:'].includes(u.protocol)) throw new Error('CITY_REDIRECT_REJECTED');
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
          const location=r.headers.get('location'); if(!location)throw new Error('CITY_REDIRECT_WITHOUT_LOCATION');
          await r.body?.cancel(); target=safeUrl(location,target); continue;
        }
        if(!r.ok)throw new Error(`CITY_HTTP_${r.status}`);
        const html=await r.text();if(!/^\s*</.test(html))throw new Error('CITY_NON_HTML_RESPONSE');
        return html;
      }
      throw new Error('CITY_REDIRECT_LIMIT');
    } catch(e:any) {
      const nestedCodes=e?.cause?.errors?.map((cause:any)=>cause.code).filter(Boolean).join(',');
      const code=e?.cause?.code || nestedCodes || e?.name || 'UNKNOWN';
      const transient=/TIMEOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN/i.test(String(code)) || e?.message==='fetch failed';
      if(attempt===0 && transient) {
        await new Promise(resolve=>setTimeout(resolve,250));
        continue;
      }
      // Codes only; no credentials, headers or environment values in diagnostics.
      throw new Error(`${e?.message || 'CITY_FETCH_FAILED'} [${code}]`);
    }
  }
  throw new Error('CITY_FETCH_FAILED');
}
export const CITY_LIST_TRANSIENT_EMPTY = 'CITY_LIST_TRANSIENT_EMPTY';
export function parseCityNoticeList(html: string) {
  const $ = load(html), entries: {title:string;url:string;publishedAt:string;noticeNumber:string}[] = [];
  let malformed = false;
  $('tr').each((_, row) => {
    const r = $(row), a = r.find('a[href*="sno="]').first();
    if (!a.length) return;
    try {
      const date = parseKstDate(r.text());
      if (!date) throw new Error('MISSING_DATE');
      entries.push({title:cityClean(a.text()),url:canonicalCityNoticeUrl(a.attr('href')!),publishedAt:date,noticeNumber:cityClean(r.find('td').first().text())});
    } catch { malformed = true; }
  });
  // The Busan board intermittently answers a valid page with a "데이터가 없습니다" table and a
  // single-page pager (seen on ~15% of requests, 2026-11). That is a server glitch, not the end
  // of the list, so it is reported as a retryable condition and never as "no notices".
  if (!entries.length && !malformed && /데이터가\s*없습니다/.test($('table').text())) throw new Error(CITY_LIST_TRANSIENT_EMPTY);
  const empty = /등록된\s*(게시물|자료|글)(?:이|가)?\s*(없|존재하지)|검색된\s*(자료|결과)가?\s*없/.test($.text());
  if (malformed || (!entries.length && !empty)) throw new Error('CITY_LIST_PARSE_UNVERIFIED');
  const pageLinks = new Map<number,string>();
  $('a[href]').each((_,el)=>{
    try {
      const u=new URL($(el).attr('href')!,BUSAN_NOTICE_LIST);
      const page=Number(u.searchParams.get('curPage'));
      if(u.protocol==='https:' && u.hostname==='www.busan.go.kr' && u.pathname==='/nbgosi' && Number.isInteger(page) && page>1) pageLinks.set(page,u.toString());
    } catch { /* Non-URL pagination controls are not guessed. */ }
  });
  return {entries, empty, pageLinks};
}
export function parseCityNoticeDetail(html:string, url:string) {
  const $ = load(html); $('script,style,nav,header,footer').remove();
  const text = cityClean($('body').text() || $.text());
  const title = cityClean($('h4,h3,h2,h1').toArray().map(el=>$(el).text()).find(t=>/정비|재개발|재건축/.test(t)) || '');
  const dateText = text.match(/공고일자\s*(20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})/)?.[1];
  const publishedAt = dateText && parseKstDate(dateText);
  const noticeNumber = text.match(/고시공고번호\s*([\d-]+)/)?.[1];
  const start = text.indexOf('내용', text.indexOf('고시공고번호'));
  if (!title || !publishedAt || !noticeNumber || start < 0) throw new Error('CITY_DETAIL_PARSE_UNVERIFIED');
  let content = text.slice(start + 2);
  content = content.split('페이지 만족도')[0].split('자료관리 담당부서')[0].slice(0,20000).trim();
  if (content.length < 20) throw new Error('CITY_DETAIL_CONTENT_MISSING');
  const attachments:string[]=[];
  $('a[href]').each((_,el)=>{const href=$(el).attr('href')!;if(/download|fileDown|\.pdf|\.hwpx?/i.test(href)){const u=new URL(href,url);if(u.protocol==='https:' && u.hostname==='www.busan.go.kr')attachments.push(u.toString());}});
  return {title,publishedAt,noticeNumber,content,attachments:[...new Set(attachments)]};
}
const CITY_TRANSIENT_RETRIES = 3;
export class BusanCityNoticeCollector {
  constructor(private fetcher:typeof fetch=pacedOfficialFetch, private clock:()=>Date=()=>new Date(), private retryDelayMs=1000) {}
  async fetchForProjects(projects:readonly RedevelopmentProject[], options:{timeoutMs?:number;maxPages?:number;maxRequests?:number;budgetMs?:number}={}) {
    const now=this.clock(), items:RawCollectedItem[]=[],errors:string[]=[];
    const maxPages=Math.min(20,Math.max(1,options.maxPages||20));
    const maxRequests=Math.min(40,Math.max(1,options.maxRequests||40));
    const budget=AbortSignal.timeout(Math.min(60000,Math.max(1,options.budgetMs||60000)));
    let requests=0, stopped:string|undefined;
    const boundedFetch:typeof fetch=async(input,init)=>{
      if(stopped)throw new Error(stopped);
      if(budget.aborted)throw new Error('CITY_BUDGET_EXHAUSTED');
      if(requests>=maxRequests)throw new Error('CITY_REQUEST_LIMIT');
      requests++;
      const response=await this.fetcher(input,{...init,signal:AbortSignal.any([budget,...(init?.signal?[init.signal]:[])])});
      if(response.status===403 || response.status===429)stopped=`CITY_HTTP_${response.status}`;
      return response;
    };
    const read=(url:string)=>readCityNoticeHtml(boundedFetch,url,options.timeoutMs||15000);
    const seenPages=new Set<string>();let previousDate=Infinity;
    const candidates=new Map<string,{title?:string}>();let complete=false;
    let nextPageUrl:string|undefined=BUSAN_NOTICE_LIST;
    const aliasMatch=(text:string,project:RedevelopmentProject)=>project.aliases.filter(a=>text.replace(/\s/g,'').includes(a.replace(/\s/g,'')));
    try {
      for(let page=1;page<=maxPages;page++){
        if(!nextPageUrl) throw new Error('CITY_NEXT_PAGE_UNVERIFIED');
        // Retry a page that comes back as the server's spurious empty table (see parser note).
        let parsed:ReturnType<typeof parseCityNoticeList>|undefined;
        for(let attempt=0;;attempt++){
          try { parsed=parseCityNoticeList(await read(nextPageUrl)); break; }
          catch(e){
            if((e as Error).message!==CITY_LIST_TRANSIENT_EMPTY || attempt>=CITY_TRANSIENT_RETRIES)throw e;
            await new Promise(r=>setTimeout(r,this.retryDelayMs*(attempt+1)));
          }
        }
        const pageKey=parsed.entries.map(e=>e.url).join('|');
        if(pageKey && seenPages.has(pageKey))throw new Error('CITY_DUPLICATE_PAGE');
        seenPages.add(pageKey);
        for(const entry of parsed.entries){
          const date=Date.parse(entry.publishedAt);
          if(date>previousDate)throw new Error('CITY_DATE_ORDER_UNVERIFIED');
          previousDate=date;
        }
        for(const entry of parsed.entries){const age=now.getTime()-Date.parse(entry.publishedAt);if(age>=0 && age<=7*86400000 && projects.some(p=>aliasMatch(entry.title,p).length))candidates.set(entry.url,{title:entry.title});}
        if(parsed.empty || parsed.entries.every(e=>now.getTime()-Date.parse(e.publishedAt)>7*86400000)){complete=true;break;}
        nextPageUrl=parsed.pageLinks.get(page+1);
        if(!nextPageUrl && parsed.entries.length<10){complete=true;break;}
      }
      if(!complete)errors.push('CITY_BOARD_PAGE_LIMIT: 최근7일 전체 확인 미완료');
    }catch(e){errors.push(`부산시 고시 목록 수집 실패: ${(e as Error).message}`);}
    // Recovery page is checked live even if list pagination fails.
    candidates.set(canonicalCityNoticeUrl(RECOVERY_NOTICE),{});
    for(const [url] of candidates){
      if(stopped || budget.aborted || requests>=maxRequests){
        errors.push(stopped || (budget.aborted?'CITY_BUDGET_EXHAUSTED':'CITY_REQUEST_LIMIT'));break;
      }
      try {
        const detail=parseCityNoticeDetail(await read(url),url),age=now.getTime()-Date.parse(detail.publishedAt);
        const recovery=url===canonicalCityNoticeUrl(RECOVERY_NOTICE);
        if(age<0 || age>(recovery?14:7)*86400000)continue;
        for(const project of projects){const aliases=aliasMatch(detail.title+' '+detail.content,project);if(!aliases.length)continue;
          const fingerprint=`city:${project.id}:${new URL(url).searchParams.get('sno')}`;
          items.push({id:'official_city_'+createHash('sha256').update(fingerprint).digest('hex').slice(0,16),projectId:project.id,sourceTier:'official',sourceType:'official-web',sourceName:'부산광역시 공식 고시공고',sourceUrl:url,title:detail.title,content:detail.content,publishedAt:detail.publishedAt,collectedAt:now.toISOString(),rawFingerprint:fingerprint,matchedKeywords:aliases,noticeNumber:detail.noticeNumber,actorType:'official',detailVerified:true,attachmentUrls:detail.attachments});
        }
      }catch(e){errors.push(`부산시 고시 원문 확인 실패 ${url}: ${(e as Error).message}`);}
    }
    return {items,error:errors.length?errors.join('; '):undefined};
  }
}

export const GWACHEON_NOTICE_LIST = 'https://www.gccity.go.kr/portal/saeol/gosi/list.do?mId=0301040000';
export function parseGwacheonNoticeList(html: string) {
  const $=load(html), entries: Array<{title:string;url:string;publishedAt:string}>=[];
  if (!$('table.bod_list.gosi').length) throw new Error('GWACHEON_LIST_UNVERIFIED');
  $('table.bod_list.gosi tbody tr').each((_,el)=>{
    const row=$(el), a=row.find('a[data-action]').first();
    if(!a.length) { if(!/없|존재하지/.test(row.text()))throw new Error('GWACHEON_ROW_UNVERIFIED'); return; }
    const title=a.text().replace(/\s+/g,' ').trim(), publishedAt=parseKstDate(row.find('.list_date').text());
    const u=new URL(a.attr('data-action')!,GWACHEON_NOTICE_LIST);
    if(!title || !publishedAt || u.hostname!=='www.gccity.go.kr' || u.pathname!=='/portal/saeol/gosi/view.do' || !/^\d+$/.test(u.searchParams.get('notAncmtMgtNo')||''))throw new Error('GWACHEON_ROW_UNVERIFIED');
    entries.push({title,url:u.toString(),publishedAt});
  });
  const current=Number($('#list input[name="page"]').val());
  if(!Number.isInteger(current)||current<1)throw new Error('GWACHEON_PAGE_UNVERIFIED');
  const pages=$('.bod_page a').map((_,el)=>Number(($(el).attr('onclick')||'').match(/goPage\((\d+)\)/)?.[1]||0)).get();
  return {entries,current,hasNext:pages.some(n=>n>current)};
}
export function parseGwacheonNoticeDetail(html:string,url:string) {
  const $=load(html), board=$('.bod_view').first();
  const title=board.children('h4').text().replace(/\s+/g,' ').trim();
  const publishedAt=parseKstDate(board.find('.view_date').text());
  const content=board.find('.view_cont').text().replace(/\s+/g,' ').trim();
  if(!title||!publishedAt||content.length<10)throw new Error('GWACHEON_DETAIL_UNVERIFIED');
  const attachments:string[]=[];
  board.find('.view_file a').each((_,el)=>{
    const call=($(el).attr('onclick')||'').match(/goDownload\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/);
    if(call){const u=new URL('https://eminwon.gccity.go.kr/emwp/jsp/ofr/FileDown.jsp');u.searchParams.set('user_file_nm',call[1]);u.searchParams.set('sys_file_nm',call[2]);u.searchParams.set('file_path',call[3]);attachments.push(u.toString());}
  });
  return {title,publishedAt,content,attachments:[...new Set(attachments)],noticeNumber:board.find('.view_write').text().replace(/\s+/g,' ').trim()};
}
export class GwacheonCityNoticeCollector {
  constructor(private fetcher:typeof fetch=fetch,private clock:()=>Date=()=>new Date()){}
  async fetchForProjects(projects:readonly RedevelopmentProject[],options:{timeoutMs?:number;maxPages?:number}={}) {
    const targets=projects.filter(p=>p.city==='과천시'&&p.isActiveMonitoring);
    const items:RawCollectedItem[]=[],errors:string[]=[],now=this.clock();let pagesRead=0;
    if(!targets.length)return {items,pagesRead,error:undefined};
    let accessStopped=false;
    const read=async(url:string)=>{
      const started=Date.now(), timeoutMs=options.timeoutMs||15000;
      // One deadline covers redirects, body consumption and the single delayed retry.
      const signal=AbortSignal.timeout(timeoutMs);
      for(let attempt=0;attempt<2;attempt++){
      let phase='headers';
      try {
      signal.throwIfAborted();
      if(accessStopped)throw new Error('GWACHEON_ACCESS_STOPPED');
      let target=url;
      for(let hop=0;hop<4;hop++){
        const u=new URL(target);if(u.protocol!=='https:'||!['www.gccity.go.kr','new.gccity.go.kr'].includes(u.hostname)||!/^\/portal\/saeol\/gosi\/(list|view)\.do$/.test(u.pathname))throw new Error('GWACHEON_REDIRECT_REJECTED');
        const r=await this.fetcher(u.toString(),{signal,redirect:'manual'});
        if([301,302,303,307,308].includes(r.status)){const next=r.headers.get('location');if(!next)throw new Error('GWACHEON_REDIRECT_MISSING');await r.body?.cancel();target=new URL(next,target).toString();continue;}
        if(!r.ok){
          if(r.status===403||r.status===429)accessStopped=true;
          await r.body?.cancel();
          throw new Error(`GWACHEON_HTTP_${r.status}`);
        }
        phase='body';
        // Await inside try: stream failures must retain their code and bounded retry.
        return await r.text();
      }throw new Error('GWACHEON_REDIRECT_LIMIT');
      }catch(e:any){
        const rawCode=e?.cause?.code||(typeof e?.code==='string'?e.code:undefined)||e?.name||'UNKNOWN';
        const code=/^[A-Za-z0-9_]+$/.test(String(rawCode))?String(rawCode):'UNKNOWN';
        const transient=['UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','ECONNRESET','ECONNREFUSED','EAI_AGAIN','ETIMEDOUT'].includes(code);
        if(attempt===0&&transient&&!signal.aborted&&Date.now()-started+500<timeoutMs){
          await new Promise(resolve=>setTimeout(resolve,500));continue;
        }
        const u=new URL(url);
        // Only allowlisted public identifiers; never include arbitrary errors/headers.
        const page=['page','seCode','notAncmtMgtNo'].map(k=>`${k}=${/^\d+$/.test(u.searchParams.get(k)||'')?u.searchParams.get(k):'-'}`).join(' ');
        const reason=/^GWACHEON_[A-Z0-9_]+$/.test(e?.message||'')?e.message:'GWACHEON_FETCH_FAILED';
        throw new Error(`${reason} [${code}] phase=${phase} attempts=${attempt+1} ${page} elapsedMs=${Date.now()-started}`);
      }
      }throw new Error('GWACHEON_FETCH_FAILED');
    };
    const matches=(text:string,p:RedevelopmentProject)=>p.aliases.filter(a=>text.replace(/[\sㆍ∙‧,]/g,'').includes(a.replace(/[\sㆍ∙‧,]/g,'')));
    const seen=new Set<string>(), cutoff=72*3600000;
    for(const seCode of ['01','02']){
      if(accessStopped)break;
      let complete=false;
      try{
        for(let page=1;page<=(options.maxPages||10);page++){
          if(accessStopped)break;
          const u=new URL(GWACHEON_NOTICE_LIST);u.searchParams.set('page',String(page));u.searchParams.set('seCode',seCode);
          const parsed=parseGwacheonNoticeList(await read(u.toString()));pagesRead++;
          if(parsed.current!==page)throw new Error('GWACHEON_PAGINATION_UNVERIFIED');
          for(const entry of parsed.entries){
            if(accessStopped)break;
            const age=now.getTime()-Date.parse(entry.publishedAt);if(age<0||age>cutoff||seen.has(entry.url))continue;
            const matched=targets.filter(p=>matches(entry.title,p).length);if(!matched.length)continue;seen.add(entry.url);
            let detail;try{detail=parseGwacheonNoticeDetail(await read(entry.url),entry.url);}catch(e){errors.push(`과천 고시 상세 확인 실패: ${(e as Error).message}`);continue;}
            if(detail.title!==entry.title||detail.publishedAt!==entry.publishedAt){errors.push('GWACHEON_DETAIL_MISMATCH');continue;}
            for(const p of matched){const fingerprint=`gwacheon:${p.id}:${new URL(entry.url).searchParams.get('notAncmtMgtNo')}`;
              items.push({id:createHash('sha256').update(fingerprint).digest('hex'),projectId:p.id,title:detail.title,content:detail.content,publishedAt:detail.publishedAt,collectedAt:now.toISOString(),sourceUrl:entry.url,sourceTier:'official',sourceType:'official-web',sourceName:'과천시 고시·공고',rawFingerprint:fingerprint,matchedKeywords:matches(entry.title,p),actorType:'official',detailVerified:true,attachmentUrls:detail.attachments});}
          }
          if(!parsed.hasNext||!parsed.entries.length||parsed.entries.every(e=>now.getTime()-Date.parse(e.publishedAt)>cutoff)){complete=true;break;}
        }
        if(!complete)errors.push('GWACHEON_PAGINATION_LIMIT');
      }catch(e){errors.push(`과천시 고시 수집 실패: ${(e as Error).message}`);}
    }
    return {items,pagesRead,error:errors.length?errors.join('; '):undefined};
  }
}
