> Superseded by the embedded Busan map on 2026-11-16. Nationwide destination links remain below the map. See BUSAN_LIVE_MAP.md.

# Map and price entry — 2026-11-16

The new 지도·시세 main tab is directly accessible at `#/housing/chokjin-3`. Existing default plans, project selection, hash history and all six original tabs remain. The tab lazily loads a static landing page with the whole K-housing map, 13 regional maps, and price-analysis links for all 31 registered apartment IDs. A region filter works locally. Links open a separate tab with noopener/noreferrer; no embedding, new service, cross-origin API request or Maps-key permission is introduced.

Existing getHousingLink project mappings are unchanged: Chokjin 3 opens its redevelopment lineage, Samick Beach opens its existing apartment analysis. Unknown redevelopment projects remain unlinked. The apartment destination catalog is a public snapshot of K-housing's current registry; keep IDs/regions synchronized when the housing registry changes. This menu displays no duplicate price/student data and requires no new collection, AI call or Telegram notification.

Local validation: TypeScript and production build; 204 application tests, three mocked OpenAI adapter tests and two operations tests. New checks cover the hash route, unchanged default and existing routes, all apartment IDs, regional map URLs and rejection of unsupported project IDs. Operational acceptance and screenshots are recorded after production rollout.


Production release: PR #25 merged as 9ccb0f4. Protected deployment run 43873923928 completed successfully and serves revision `busan-redevelopment-news-monitor-9ccb0f4-1`; previous `busan-redevelopment-news-monitor-21cba82-1` is retained for rollback. Live runtime template matched the prior template after normalizing only image, revision and environment ordering. Health, Firestore readiness, registry access, AI configuration and request-based CPU billing remain healthy/unchanged. Browser verification confirmed the preserved plans default, the new tab/hash and refresh, all 45 links (14 maps + 31 apartment details), Centum region filtering, actual map/detail new tabs, and unchanged Chokjin/Samick links in status. The Centum Park 2 detail displayed the correct apartment and available 84㎡ analysis.

Mobile-size browser validation is **unverified**: the browser viewport capability did not resize the document (innerWidth remained 1280). No mobile pass is claimed. The original viewport setting was reset. Desktop screenshot and acceptance details are retained; `MAP_PRICE_MENU_RELEASE_20261116.json` includes the explicit limitation and synthetic usage window. No Telegram, scheduled collection, poll execution or paid AI call was invoked during verification.
