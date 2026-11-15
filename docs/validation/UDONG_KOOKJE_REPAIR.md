# U-dong 3 Kookje body repair — 2026-11-15

The Google News link resolves to https://www.kookje.co.kr/news2011/asp/newsbody.asp?code=0200&key=20250217.22002004618 . Publisher HTML was reachable and the headline matched, but the reader did not recognize the publisher's legacy `.news_article` body or `.f_news_date` publication time. This produced `NEWS_BODY_UNAVAILABLE`, an explicit review state rather than a title-only event.

Add those selectors only for www.kookje.co.kr. Title identity, minimum body length, charset decoding, size limits, source checksum and date evidence checks remain required. Synthetic regression tests check extraction, publication time, script/recommendation exclusion, other-host isolation and relative event date interpretation.

The article was published on 2025-02-16 at 19:20:58 KST. Its body says the approval notification was received on the preceding 14th: event date 2025-02-14. A legacy title-only event for this exact source had used the publication date 2025-02-16. The targeted repair script first verifies the live body checksum/date, offers a read-only dry run, then (only with explicit apply flag) acquires the production polling lock, backs up both queue and legacy event, withdraws only that exact-source legacy event and requeues the original article. Telegram and AI credentials are absent from the repair job. Normal production analysis must then run with `notify=false` and persist the verified result before acceptance.

Body SHA-256: `d0f5ad88f12446743bf80a2a48daab793e3582c7bf1d1fbe3253b87040e2d6e0`.
