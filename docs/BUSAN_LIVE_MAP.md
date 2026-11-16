# Embedded Busan housing and project map — 2026-11-16

The apt 지도·시세 tab now opens a native interactive Leaflet map on the apt origin. It displays four registered Busan apartments, their existing verified MOLIT reference footprints and 59/84 area-family monthly median prices. Three distinct purple project points represent Chokjin 3, Udong 3 and Samick Beach. Apartment selection opens a React detail panel and the original K-housing analysis link; project selection exposes existing apt status/history routes, the official city location map and the original Chokjin/Samick financial links. The nationwide 31-apartment/13-region entry list is retained in a disclosure below the map. Original six tabs, plans default and hash navigation remain.

## Boundary and position honesty

All three projects are marker-only: current coordinate-verified official redevelopment boundary geometry was not obtained. Municipal pages contain raster location maps; Samick's official 2026-181 geographic-plan PDF also exists. Their existence is explicitly distinguished from having a reviewed georeferenced polygon suitable for this map. No old raster outline is traced, guessed, replaced by an apartment footprint, convex hull or district boundary. The user-authorized marker fallback is applied to each project.

Chokjin uses an internal point of official reference parcel 2623010500100710005, the representative Beomjeon-dong 71-5 lot identified in the KRX disclosure; it is not the centre or boundary of the whole project. Udong uses a manually reviewed approximate point based on the city's location image east of Haeundae High School; the popup explicitly says approximate and does not assert a cadastral fix. Samick uses the existing apartment interior anchor as a project reference point, with a separate caution that the apartment and redevelopment zone differ. Sources, retained parcel response, hashes and geometry provenance are in BUSAN_LIVE_MAP_SOURCES_20261116.json.

## Read-only price connection and cost

GET /api/housing/busan-prices accepts only areaCategory=59 or84 (default84). Server-side requests use one hardcoded HTTPS K-housing public summary endpoint, fixed five-year/monthly query parameters and no forwarded headers/secrets; redirects are refused and requests have a 15-second timeout. Only the four whitelisted apartment IDs and required finite price/period fields are returned. Concurrent requests coalesce, each area/month is cached for one hour, failed reads cool down for30 seconds, and browsers/CDN can reuse responses for60/300 seconds. There is no timer, background collection, upstream MOLIT query, AI or Telegram call. The actual fetch timestamp is visible. Missing area/data and source failure never become zero prices or invented values.

Leaflet1.9.4 is bundled; OpenStreetMap's standard raster tile layer uses normal browser image caching, visible copyright attribution, a valid referrer policy, idle-only tile updates and a small surrounding buffer. No prefetch/offline download or tile proxy is used. No Google Maps key permission, IAM, runtime environment, scheduler, NAT or service change is required.

## Validation

TypeScript/build and application tests cover source membership, all three marker fallbacks, fixed-endpoint reads, request coalescing/cache separation, area-unavailable handling, malformed source failure/cooldown and public-read/protected-write isolation. A read-only local preview exercised actual OSM tiles and live K-housing prices without loading the collection pipeline, credentials or notifications. Final production acceptance records preserve the prior runtime revision for rollback and identify synthetic validation traffic. No Telegram notification, collection/poll job or paid AI request is used for validation.
