# Map and price entry — 2026-11-16

The new 지도·시세 main tab is directly accessible at `#/housing/chokjin-3`. Existing default plans, project selection, hash history and all six original tabs remain. The tab lazily loads a static landing page with the whole K-housing map, 13 regional maps, and price-analysis links for all 31 registered apartment IDs. A region filter works locally. Links open a separate tab with noopener/noreferrer; no embedding, new service, cross-origin API request or Maps-key permission is introduced.

Existing getHousingLink project mappings are unchanged: Chokjin 3 opens its redevelopment lineage, Samick Beach opens its existing apartment analysis. Unknown redevelopment projects remain unlinked. The apartment destination catalog is a public snapshot of K-housing's current registry; keep IDs/regions synchronized when the housing registry changes. This menu displays no duplicate price/student data and requires no new collection, AI call or Telegram notification.

Local validation: TypeScript and production build; 204 application tests, three mocked OpenAI adapter tests and two operations tests. New checks cover the hash route, unchanged default and existing routes, all apartment IDs, regional map URLs and rejection of unsupported project IDs. Operational acceptance and screenshots are recorded after production rollout.
