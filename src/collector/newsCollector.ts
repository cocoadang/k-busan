import { newsArticleKey } from '../analyzer/relatednessGate';
import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'crypto';
import { RawCollectedItem, RedevelopmentProject } from '../types/redevelopment';

export interface NewsFetchResult {
  items: RawCollectedItem[];
  error?: string;
  httpStatus?: number;
  contentType?: string;
  queryFailures?: { query: string; httpStatus?: number; contentType?: string; error: string }[];
}

// Network chunks are arbitrary: inspect a bounded prefix, not only the first chunk.
// Preserve the request deadline while reading even a stalled error body.
async function readErrorPrefix(response: Response, signal: AbortSignal) {
  const reader = response.body?.getReader();
  if (!reader) return { sample: '', bytes: 0, limitReached: false };
  const bytes = new Uint8Array(4096);
  let length = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (length < bytes.length) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      const part = chunk.value.subarray(0, bytes.length - length);
      bytes.set(part, length);
      length += part.length;
    }
    return {sample: new TextDecoder().decode(bytes.subarray(0, length)), bytes: length, limitReached: length === bytes.length};
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel();
  }
}

/**
 * Public Google News RSS Collector for Busan Redevelopment
 * Strictly uses real search queries derived from project aliases and location keywords.
 * If fetch fails or network is unreachable, records an explicit error — NEVER fabricates mock articles.
 */
export class NewsCollector {
  private parser: XMLParser;

  constructor(private retryDelayMs = 1000) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
    });
  }

  /**
   * Build targeted Korean search queries for each monitored project
   */
  public buildSearchQueries(project: RedevelopmentProject): string[] {
    if (project.id === 'gwacheon-89') {
      // Avoid one long punctuation-heavy OR expression; Google RSS may broaden it.
      const targeted = ['과천 "8단지" 재건축', '과천 "9단지" 재건축', '과천 "8 9단지" 재건축'];
      return [...targeted.map(query => `${query} when:7d`), ...targeted];
    }
    const aliases = Array.from(new Set(project.aliases)).map(alias => `"${alias.replace(/"/g, '')}"`);
    const allAliases = `(${aliases.join(' OR ')})`;
    return [`${allAliases} when:7d`, allAliases];
  }

  /**
   * Fetch real news articles from public RSS for a project
   */
  public async fetchForProject(
    project: RedevelopmentProject,
    options: { timeoutMs?: number; maxItemsPerQuery?: number } = {}
  ): Promise<NewsFetchResult> {
    const timeoutMs = options.timeoutMs ?? 10000;
    const maxItems = options.maxItemsPerQuery ?? 20;
    const queries = this.buildSearchQueries(project);
    const collectedItems: RawCollectedItem[] = [];
    const seenUrls = new Set<string>();
    const seenArticles = new Set<string>();

    let lastError: string | undefined;
    let lastHttpStatus: number | undefined;
    let lastContentType: string | undefined;
    const queryFailures: NonNullable<NewsFetchResult['queryFailures']> = [];
    let restrictedResponse = false;

    for (const query of queries) {
      lastHttpStatus = undefined;
      lastContentType = undefined;
      let first503Diagnostic = '';
      const encodedQuery = encodeURIComponent(`${query} (재개발 OR 재건축 OR 정비사업)`);
      const feedUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=ko&gl=KR&ceid=KR:ko`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {

        const request = () => fetch(feedUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BusanRedevelopmentMonitor/1.0',
            Accept: 'application/rss+xml, application/xml, text/xml',
          },
        });
        let response = await request();
        lastHttpStatus = response.status;
        lastContentType = response.headers.get('content-type') || '';
        // One bounded retry for a transient 503 only, on the same public URL.
        // Keep the original timeout active across headers, delay and body.
        if (response.status === 503) {
          // An unreadable/timed-out 503 must not fall through to alternative queries.
          restrictedResponse = true;
          const { sample, bytes, limitReached } = await readErrorPrefix(response, controller.signal);
          const restricted = /captcha|unusual traffic|automated queries|access denied|\/sorry\//i.test(sample);
          restrictedResponse = restricted || limitReached;
          first503Diagnostic = `; initial503SampleSha256=${createHash('sha256').update(sample).digest('hex')}; restrictionPage=${restricted}; sampleBytes=${bytes}; sampleLimitReached=${limitReached}`;
          const retryAfter = response.headers.get('retry-after');
          const waitMs = retryAfter == null ? this.retryDelayMs : /^\d+$/.test(retryAfter)
            ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
          if (retryAfter != null && (!Number.isFinite(waitMs) || waitMs > 2000)) restrictedResponse = true;
          if (!restricted && !limitReached && Number.isFinite(waitMs) && waitMs >= 0 && waitMs <= 2000 && !controller.signal.aborted) {
            await new Promise<void>((resolve, reject) => {
              const abort = () => { clearTimeout(delay); reject(new Error('RSS_RETRY_TIMEOUT')); };
              const delay = setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve(); }, waitMs);
              controller.signal.addEventListener('abort', abort, { once: true });
              if (controller.signal.aborted) abort();
            });
            response = await request();
          }
        }

        lastHttpStatus = response.status;
        restrictedResponse ||= response.status === 403 || response.status === 429 || response.status === 503;
        const contentType = response.headers.get('content-type') || '';
        lastContentType = contentType;

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status} from Google News RSS feed (Content-Type: ${contentType})${first503Diagnostic}`
          );
        }

        const isXml =
          contentType.includes('xml') ||
          contentType.includes('rss') ||
          contentType.includes('text/plain') ||
          contentType.includes('application/octet-stream');

        if (!isXml && contentType.includes('text/html')) {
          throw new Error(
            `UPSTREAM_NON_XML_RESPONSE: Google News RSS returned unexpected HTML [HTTP ${response.status}, Content-Type: ${contentType}] instead of XML.`
          );
        }

        const xmlText = await response.text();
        const parsed = this.parser.parse(xmlText);

        const channel = parsed?.rss?.channel;
        if (!channel) {
          throw new Error('UPSTREAM_INVALID_RSS: RSS channel missing');
        }

        let rawList = channel.item;
        if (!rawList) {
          continue;
        }
        if (!Array.isArray(rawList)) {
          rawList = [rawList];
        }

        rawList.sort((a: any, b: any) =>
          (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
        for (const item of rawList.slice(0, maxItems)) {
          const rawLink = item.link || '';
          if (!rawLink || seenUrls.has(rawLink)) {
            continue;
          }

          const title = this.cleanHtml(item.title || '');
          const description = this.cleanHtml(item.description || '');
          const timestamp = Date.parse(item.pubDate);
          // Unknown dates must not masquerade as fresh news.
          if (!Number.isFinite(timestamp)) continue;
          const pubDate = new Date(timestamp).toISOString();
          seenUrls.add(rawLink);
          const sourceTitle = typeof item.source === 'string' ? item.source : item.source?.['#text'] || '언론보도';

          const articleKey = newsArticleKey({ title, sourceName: sourceTitle, publishedAt: pubDate });
          if (seenArticles.has(articleKey)) continue;
          seenArticles.add(articleKey);

          // Detect matched keywords
          const matchedKeywords = project.aliases.filter(
            (alias) => title.includes(alias) || description.includes(alias)
          );

          collectedItems.push({
            id: `news_${createHash('md5').update(rawLink).digest('hex').slice(0, 16)}`,
            projectId: project.id,
            sourceTier: 'news',
            sourceType: 'news-rss',
            sourceName: sourceTitle,
            sourceUrl: rawLink,
            title,
            content: description,
            author: sourceTitle,
            publishedAt: pubDate,
            collectedAt: new Date().toISOString(),
            rawFingerprint: `${project.id}_${rawLink}`,
            matchedKeywords,
          });
        }
      } catch (err: any) {
        lastError = `News fetch failed for query "${query}": ${err.message || String(err)}`;
        queryFailures.push({ query, httpStatus: lastHttpStatus, contentType: lastContentType, error: lastError });
      } finally {
        clearTimeout(timer);
      }
      if (restrictedResponse) break;
    }

    return {
      items: collectedItems.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
      error: queryFailures.length ? queryFailures.map(f => f.error).join('; ') : undefined,
      httpStatus: lastHttpStatus,
      contentType: lastContentType,
      queryFailures,
    };
  }

  private cleanHtml(input: string): string {
    return input
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code) => {
        const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10);
        return point <= 0x10ffff ? String.fromCodePoint(point) : '';
      })
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
