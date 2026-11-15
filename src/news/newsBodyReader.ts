import { load } from "cheerio";
import { createHash } from "node:crypto";
import type { RawCollectedItem } from "../types/redevelopment";
const GOOGLE = "news.google.com";
export const NEWS_HOSTS = new Set([
  "www.mk.co.kr",
  "m.mk.co.kr",
  "www.housingherald.co.kr",
  "housingherald.co.kr",
  "www.safetynews.co.kr",
  "safetynews.co.kr",
  "www.ikld.kr",
  "realty.chosun.com",
  "news.nate.com",
  "m.news.nate.com",
  "v.daum.net",
  "issuegate.com",
  "www.issuegate.com",
  "www.mt.co.kr",
  "www.newsis.com",
  "www.yna.co.kr",
  "www.nocutnews.co.kr",
  "bs.nocutnews.co.kr",
  "biz.heraldcorp.com",
  "www.rcast.co.kr",
  "www.housingherald.co.kr",
  "www.busan.com",
  "www.kookje.co.kr",
  "www.newspim.com",
  "www.dnews.co.kr",
  "www.kyeonggi.com",
  "www.hankyung.com",
  "www.donga.com",
  "www.chosun.com",
  "www.joongang.co.kr",
  "www.news1.kr",
  "www.edaily.co.kr",
  "www.asiae.co.kr",
  "view.asiae.co.kr",
  "www.sedaily.com",
  "news.lghellovision.net",
  "www.hellotvnews.com",
  "www.seoul.co.kr",
  "www.arunews.com",
]);
export function newsUrl(value: string, google = false) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.port ||
    u.username ||
    u.password ||
    !(NEWS_HOSTS.has(u.hostname) || (google && u.hostname === GOOGLE))
  )
    throw Error("NEWS_HOST_REJECTED");
  return u.toString();
}
export async function newsText(
  url: string,
  fetcher: typeof fetch = fetch,
  deadline = Infinity,
  init: RequestInit = {},
) {
  let current = newsUrl(url, true);
  for (let n = 0; n < 4; n++) {
    const ms = Math.min(10000, deadline - Date.now());
    if (ms < 500) throw Error("NEWS_CYCLE_BUDGET");
    const r = await fetcher(current, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(ms),
      headers: {
        "user-agent": "BusanRedevelopmentMonitor/1.0",
        accept: "text/html,application/json",
        ...init.headers,
      },
    });
    if (r.status >= 300 && r.status < 400) {
      current = newsUrl(
        new URL(r.headers.get("location") || "", current).toString(),
        true,
      );
      continue;
    }
    if (!r.ok) throw Error(`NEWS_HTTP_${r.status}`);
    if (!r.body) throw Error("NEWS_EMPTY");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for await (const part of r.body as any) {
      bytes += part.length;
      if (bytes > 2 * 1024 * 1024) throw Error("NEWS_HTML_LIMIT");
      chunks.push(part);
    }
    const data = Buffer.concat(chunks);
    const charset = (
      r.headers.get("content-type")?.match(/charset=([^; ]+)/i)?.[1] ||
      data
        .subarray(0, 2000)
        .toString("ascii")
        .match(/charset=[\"']?([^\"' >;]+)/i)?.[1] ||
      "utf-8"
    ).toLowerCase();
    if (
      !["utf-8", "utf8", "euc-kr", "ks_c_5601-1987", "windows-949"].includes(
        charset,
      )
    )
      throw Error("NEWS_CHARSET_UNSUPPORTED");
    return {
      url: current,
      text: new TextDecoder(
        ["utf-8", "utf8"].includes(charset) ? "utf-8" : "euc-kr",
      ).decode(data),
    };
  }
  throw Error("NEWS_REDIRECT_LIMIT");
}
/** Public Google News link-resolution request (read-only). No retries on access/rate restrictions.
 * Protocol reference: https://github.com/dariandanciu/google-news-url-decoder (MIT).
 */
export async function resolveNewsUrl(
  value: string,
  fetcher: typeof fetch = fetch,
  deadline = Infinity,
) {
  const u = new URL(newsUrl(value, true));
  if (u.hostname !== GOOGLE) return u.toString();
  const id = u.pathname.match(/\/(?:rss\/)?(?:articles|read)\/([\w-]+)/)?.[1];
  if (!id) throw Error("NEWS_LINK_INVALID");
  const page = await newsText(
    `https://${GOOGLE}/rss/articles/${id}`,
    fetcher,
    deadline,
  );
  const $ = load(page.text),
    sg = $("[data-n-a-sg]").first().attr("data-n-a-sg"),
    ts = $("[data-n-a-ts]").first().attr("data-n-a-ts");
  if (!sg || !ts || !/^\d+$/.test(ts)) throw Error("NEWS_LINK_UNRESOLVED");
  const request = [
    "garturlreq",
    [
      [
        "X",
        "X",
        ["X", "X"],
        null,
        null,
        1,
        1,
        "US:en",
        null,
        1,
        null,
        null,
        null,
        null,
        null,
        0,
        1,
      ],
      "X",
      "X",
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    id,
    Number(ts),
    sg,
  ];
  const body = new URLSearchParams({
    "f.req": JSON.stringify([
      [["Fbv4je", JSON.stringify(request), null, "generic"]],
    ]),
  });
  const response = await newsText(
    `https://${GOOGLE}/_/DotsSplashUi/data/batchexecute`,
    fetcher,
    deadline,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: body.toString(),
    },
  );
  for (const line of response.text.split("\n")) {
    if (!line.startsWith("[[")) continue;
    try {
      for (const row of JSON.parse(line)) {
        if (row[1] === "Fbv4je" && typeof row[2] === "string") {
          const resolved = JSON.parse(row[2])?.[1];
          if (typeof resolved === "string") return resolved;
        }
      }
    } catch {}
  }
  throw Error("NEWS_LINK_UNRESOLVED");
}
export type NewsBody = {
  url: string;
  title: string;
  text: string;
  publishedAt?: string;
  sha256: string;
  checkedAt: number;
  selector: string;
};
const normalized = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
export function newsTitlesMatch(actual: string, expected: string) {
  const key = normalized(expected.split(" - ")[0]).slice(0, 14);
  return key.length >= 6 && normalized(actual).includes(key);
}
export function extractNewsBody(
  html: string,
  url: string,
  expectedTitle: string,
): NewsBody {
  const $ = load(html);
  if (/captcha|access denied|unusual traffic/i.test($("title").text()))
    throw Error("NEWS_ACCESS_RESTRICTED");
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text() ||
    $("title").text();
  if (!newsTitlesMatch(title, expectedTitle))
    throw Error("NEWS_TITLE_MISMATCH");
  let publishedAt =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $("time[datetime]").first().attr("datetime") ||
    $('meta[property="og:regDate"]').attr("content") ||
    $(".dateWriter,.articleInfo")
      .first()
      .text()
      .match(/\d{4}[-.]\d{2}[-.]\d{2}\s+\d{2}:\d{2}(?::\d{2})?/)?.[0];
  let jsonBody = "";
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      const doc = JSON.parse($(script).text());
      for (const object of [
        doc,
        ...(Array.isArray(doc) ? doc : doc["@graph"] || []),
      ])
        if (/NewsArticle|Article/.test(String(object?.["@type"]))) {
          jsonBody =
            typeof object.articleBody === "string"
              ? object.articleBody
              : jsonBody;
          publishedAt = publishedAt || object.datePublished;
        }
    } catch {}
  }
  $(
    "script,style,iframe,nav,footer,aside,.advertisement,.ad,.related-news,.copyright",
  ).remove();
  let text = jsonBody,
    selector = "jsonld:articleBody";
  for (const sel of [
    '[itemprop="articleBody"]',
    "#realArtcContents",
    ".story-news.article",
    "#viewContent .fr-view",
    "#article-view-content-div",
    "#articleBodyContents",
    "#articleBody",
    "#newsct_article",
    "#dic_area",
    "#newsEndContents",
    ".news_cnt_detail_wrap",
    ".article_body",
    ".article-body",
    ".article_view",
    ".view_cont",
    ".article-text",
    "article",
  ]) {
    if (text.replace(/\s/g, "").length >= 150) break;
    const node = $(sel).first().clone();
    node.find("br").replaceWith("\n");
    node.find("p").append("\n");
    const candidate = node
      .text()
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();
    if (candidate.replace(/\s/g, "").length >= 150) {
      text = candidate;
      selector = sel;
    }
  }
  if (text.replace(/\s/g, "").length < 150)
    throw Error("NEWS_BODY_UNAVAILABLE");
  if (text.length > 24000) throw Error("NEWS_BODY_LIMIT");
  if (publishedAt && /^\d{14}$/.test(publishedAt))
    publishedAt = publishedAt.replace(
      /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,
      "$1-$2-$3T$4:$5:$6+09:00",
    );
  else if (publishedAt && /^\d{4}[-.]\d{2}[-.]\d{2} /.test(publishedAt))
    publishedAt = publishedAt.replace(/\./g, "-").replace(" ", "T") + "+09:00";
  const parsed = Date.parse(publishedAt || "");
  return {
    url: newsUrl(url),
    title,
    text,
    publishedAt: Number.isFinite(parsed)
      ? new Date(parsed).toISOString()
      : undefined,
    sha256: createHash("sha256").update(text).digest("hex"),
    checkedAt: Date.now(),
    selector,
  };
}
export interface NewsBodyCache {
  get(url: string): Promise<NewsBody | null>;
  set(url: string, body: NewsBody): Promise<void>;
}
export class NewsBodyReader {
  constructor(
    private cache?: NewsBodyCache,
    private fetcher: typeof fetch = fetch,
  ) {}
  async read(item: RawCollectedItem, deadline = Infinity) {
    const cached = await this.cache?.get(item.sourceUrl);
    if (
      cached &&
      Date.now() - cached.checkedAt < 86400000 &&
      newsTitlesMatch(cached.title, item.title) &&
      cached.sha256 === createHash("sha256").update(cached.text).digest("hex")
    )
      return cached;
    const resolved = await resolveNewsUrl(
      item.sourceUrl,
      this.fetcher,
      deadline,
    );
    const response = await newsText(newsUrl(resolved), this.fetcher, deadline);
    const body = extractNewsBody(response.text, response.url, item.title);
    await this.cache?.set(item.sourceUrl, body);
    return body;
  }
  async enrich(
    item: RawCollectedItem,
    deadline = Infinity,
  ): Promise<RawCollectedItem> {
    if (item.sourceTier !== "news") return item;
    let body: NewsBody;
    try {
      body = await this.read(item, deadline);
    } catch (e: any) {
      throw Error(/^NEWS_/.test(e.message) ? e.message : "NEWS_FETCH_FAILED");
    }
    return {
      ...item,
      content: `[언론사 원문 ${body.url}]\n원문 제목: ${body.title}\n원문 발행일: ${body.publishedAt ? new Date(Date.parse(body.publishedAt) + 9 * 3600000).toISOString().replace("Z", "+09:00") : "미확인"}\n[본문]\n${body.text}`,
      newsEvidence: {
        url: body.url,
        sha256: body.sha256,
        checkedAt: body.checkedAt,
        publishedAt: body.publishedAt,
        selector: body.selector,
      },
    };
  }
}
export function firestoreNewsBodyCache(db: any): NewsBodyCache {
  const ref = (url: string) =>
    db
      .collection("newsArticleBodies")
      .doc(createHash("sha256").update(url).digest("hex"));
  return {
    get: async (url) => (await ref(url).get()).data()?.body || null,
    set: async (url, body) => {
      await ref(url).set({
        body: JSON.parse(JSON.stringify(body)),
        expiresAt: new Date(Date.now() + 30 * 86400000),
      });
    },
  };
}
