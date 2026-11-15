# U-dong 3 Kookje body repair — 2026-11-15

The Google News link resolves to https://www.kookje.co.kr/news2011/asp/newsbody.asp?code=0200&key=20250217.22002004618 . Publisher HTML was reachable and the headline matched, but the reader did not recognize the publisher's legacy `.news_article` body or `.f_news_date` publication time. This produced `NEWS_BODY_UNAVAILABLE`, an explicit review state rather than a title-only event.

Add those selectors only for www.kookje.co.kr. Title identity, minimum body length, charset decoding, size limits, source checksum and date evidence checks remain required. Synthetic regression tests check extraction, publication time, script/recommendation exclusion, other-host isolation and relative event date interpretation.

The article was published on 2025-02-16 at 19:20:58 KST. Its body says the approval notification was received on the preceding 14th: event date 2025-02-14. A legacy title-only event for this exact source had used the publication date 2025-02-16. The targeted repair script first verifies the live body checksum/date, offers a read-only dry run, then (only with explicit apply flag) acquires the production polling lock, backs up both queue and legacy event, withdraws only that exact-source legacy event and requeues the original article. Telegram and AI credentials are absent from the repair job. Normal production analysis must then run with `notify=false` and persist the verified result before acceptance.

Body SHA-256: `d0f5ad88f12446743bf80a2a48daab793e3582c7bf1d1fbe3253b87040e2d6e0`.

## Production acceptance

Deployed commit `1dc7fb3cdedee1127930bd342cc468e326d2e18c`, revision `busan-redevelopment-news-monitor-1dc7fb3-1`; GitHub deployment 43711254757 succeeded. Local/hosted checks passed (187 tests, type check and build).

Read-only maintenance execution `apt-udong-body-repair-c7z4x` and applied execution `apt-udong-body-repair-jrvvr` succeeded. The applied job verified the unchanged live article, backed up the exact queue/event records into `analysisReviewCorrections/kookje_body_repair_9f5fd0518d8c2223473fa394bb2dc5460be7a7c2c721c94c6fff431d2eca8580`, withdrew the old exact-source title-only event and requeued one entry. No Telegram or AI credentials were passed to that job; it has been deleted.

Normal production pipeline cycle `cycle_1794744110192` ran with `notify=false`, completed this entry and persisted `evt_udong-3_8195dda40e4ed9f0b2d238ab` dated 2025-02-14. Independent persisted-data checks confirm source checksum, publisher date, selector, verbatim date-evidence presence in the recovered body, historical/no-alert flags, one linked event and legacy withdrawal. Final queue: completed 82, closed 7, pending/retry/ready/needs_review all zero. Telegram sent/failed: zero.

The whole collection also reproduced intermittent official-source connection timeouts; the cycle took 104.896 seconds. Those upstream collection failures are retained in the report and are separate from the successfully repaired news body. This acceptance does not claim the official network issue was permanently resolved.

Detailed evidence: [udong-kookje-acceptance.json](./udong-kookje-acceptance.json).
