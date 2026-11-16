# Embedded Busan housing and project map — 2026-11-16

The apt 지도·시세 tab now opens a native interactive Leaflet map on the apt origin. It displays four registered Busan apartments, their existing verified MOLIT reference footprints and 59/84 area-family monthly median prices. Three distinct purple project points represent Chokjin 3, Udong 3 and Samick Beach. Apartment selection opens a React detail panel and the original K-housing analysis link; project selection exposes existing apt status/history routes, the official city location map and the original Chokjin/Samick financial links. Project stages use the same verified-event resolver and event input as the existing status screen, never a stale project-row stage. The nationwide 31-apartment/13-region entry list is retained in a disclosure below the map. Original six tabs, plans default and hash navigation remain.

## Boundary and position honesty

All three projects are marker-only: current coordinate-verified official redevelopment boundary geometry was not obtained. Municipal pages contain raster location maps; Samick's official 2026-181 geographic-plan PDF also exists. Their existence is explicitly distinguished from having a reviewed georeferenced polygon suitable for this map. No old raster outline is traced, guessed, replaced by an apartment footprint, convex hull or district boundary. The user-authorized marker fallback is applied to each project.

Chokjin uses an internal point of official reference parcel 2623010500100710005, the representative Beomjeon-dong 71-5 lot identified in the KRX disclosure; it is not the centre or boundary of the whole project. Udong uses a manually reviewed approximate point based on the city's location image east of Haeundae High School; the popup explicitly says approximate and does not assert a cadastral fix. Samick uses the existing apartment interior anchor as a project reference point, with a separate caution that the apartment and redevelopment zone differ. Sources, retained parcel response, hashes and geometry provenance are in BUSAN_LIVE_MAP_SOURCES_20261116.json.

## Read-only price connection and cost

GET /api/housing/busan-prices accepts only areaCategory=59 or84 (default84). Server-side requests use one hardcoded HTTPS K-housing public summary endpoint, fixed five-year/monthly query parameters and no forwarded headers/secrets; redirects are refused and requests have a 15-second timeout. Only the four whitelisted apartment IDs and required finite price/period fields are returned. Concurrent requests coalesce, each area/month is cached for one hour, failed reads cool down for30 seconds, and browsers/CDN can reuse responses for60/300 seconds. There is no timer, background collection, upstream MOLIT query, AI or Telegram call. The actual fetch timestamp is visible. Missing area/data and source failure never become zero prices or invented values.

Leaflet1.9.4 is bundled; OpenStreetMap's standard raster tile layer uses normal browser image caching, visible copyright attribution, a valid referrer policy, idle-only tile updates and a small surrounding buffer. No prefetch/offline download or tile proxy is used. No Google Maps key permission, IAM, runtime environment, scheduler, NAT or service change is required.

## Validation

TypeScript/build and application tests cover source membership, all three marker fallbacks, fixed-endpoint reads, request coalescing/cache separation, area-unavailable handling, malformed source failure/cooldown and public-read/protected-write isolation. A read-only local preview exercised actual OSM tiles and live K-housing prices without loading the collection pipeline, credentials or notifications. Final production acceptance records preserve the prior runtime revision for rollback and identify synthetic validation traffic. No Telegram notification, collection/poll job or paid AI request is used for validation.

## Production acceptance

Revision `busan-redevelopment-news-monitor-b0fa83e-1` passed public health, unchanged runtime-template comparison and exact source comparisons for all four apartments in both area families. Desktop checks verified seven markers, four apartment footprints, independent layer toggles, unsupported 59-area states, three project panels, status navigation and retained 31 analysis/13 regional links. Automated validation passed 208 application, three mocked AI and two operations tests. See BUSAN_LIVE_MAP_RELEASE_20261116.json. Mobile viewport acceptance was not obtained because the connected browser viewport override did not apply; no mobile pass is claimed. Conditional public requests returned 200, so 304 savings are not claimed; hourly upstream caching and freshness headers are verified.

## Mobile and pointer follow-up

Mobile selection scrolls the compact selected detail into view and offers a return-to-map button; full-width lists remain available when markers overlap. Primary list/filter/zoom targets are at least 44px high. Desktop dragging pans; wheel zoom is enabled. The map-size button expands the map to the content width and 75dvh without remounting the map or changing data/connections. ResizeObserver preserves correct Leaflet sizing. Bounds use padding for edge labels. No collection, AI, notification or runtime configuration change is involved.
