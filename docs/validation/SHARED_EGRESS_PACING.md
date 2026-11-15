# Shared egress and restrained official collection — 2026-11-15

The user requested removal of the paid dedicated IP/NAT and comparison of slower calling methods. Earlier shared-vs-static comparisons did not isolate request timing, source address and elapsed recovery time; they do not prove a permanent need for a static address or a confirmed upstream IP blacklist.

Production returns to shared Cloud Run egress. NAT/router and reserved address are removed after confirming traffic uses the shared revision. Previous static network configuration is archived, not an active provisioning requirement. Deployment validation now refuses to reattach a VPC/connector, preserving the user's choice.

A single process-wide governor coordinates the Busan city, association and Saeol API requests, including redirects and retries. Production has at most one in-flight request/body and a minimum 3-second pause after completion. Transport/body failure pauses that host for 60 seconds; HTTP 403/429/503 also pauses it and honors Retry-After. Queued requests honor their deadline and cannot start after abort. Response buffering is bounded at 2 MiB. Existing source failures remain visible; the change does not fabricate empty successful collections. Other-host news/AI requests are unaffected.

Low-volume comparison: three authorized source endpoints, one request each at 3-second spacing using fetch; at least 120 seconds with no diagnostic requests; then one request each at 8-second spacing with fresh verified HTTPS connections. No automatic retries. An explicit access/rate restriction skips that host in the second phase. The diagnostic contains no Telegram/AI credentials and writes no Firestore data. This small sample evaluates observed behavior and cannot by itself prove why an upstream drops connections.


## Low-volume findings and refinement

The first diagnostic sent five actual requests (three in phase A and two in phase B). Phase A (fetch, serial, 3 seconds) received a city connection reset and association HTTP 200. Phase B, after a 120-second quiet interval, used fresh verified HTTPS connections at 8-second spacing: city and association both returned 200. The Saeol diagnostic's 403 is excluded from rate-limit inference: its initial test URL double-encoded the portal key. The diagnostic URL builder was corrected. The normal production collector already normalizes the key correctly and successfully queried Saeol for all three monitored districts in the subsequent real collection.

The first paced production cycle `cycle_1794747295252` completed in 35.853 seconds with 11/12 successful sources and Telegram 0. Busan city failed and entered host cooldown. This is retained as a failed source, not misreported as complete success. Consequently city collection alone switches to fresh native HTTPS (full certificate verification, agent reuse disabled) with 8-second spacing; other Busan sources retain serial 3-second spacing. The city total budget becomes 90 seconds to accommodate intentionally slower pagination, retaining the response/request/page caps. The later outcome is recorded below.

The comparison changes both elapsed time and transport, and shared outbound source addresses may also vary. It does not identify the exact reason an upstream resets a connection. It establishes which low-volume requests succeeded; no claim of a proven blacklist or a permanent need for fixed IP is made.

## Final deployment and acceptance

Fixed address and NAT/router deletion were independently confirmed by Compute API 404 responses. Cloud Run uses shared egress, no VPC interface or connector, with public access and the existing credentials preserved. The old VPC/subnet remain inactive and unbilled because historical unrouted revisions still reference the subnet; no reserved external address, NAT gateway, VM or connector remains active for this path. The now-unused deployment subnet grant was removed. The diagnostic job was deleted.

PR 20 deployed the serial governor (`baf89c6`, workflow 43715938552). PR 21 deployed the fresh city transport and slower city spacing (`44d2dd1c97f6f6bd4d8b07ce9dcbe48aab888754`, workflow 43716737489). Final revision `busan-redevelopment-news-monitor-44d2dd1-1` receives 100% of traffic. All 192 Node tests, Python deployment tests, type check and build passed.

Final real collection `cycle_1794747897909` completed in 42.131 seconds with Telegram sent/failed zero. 11/12 sources succeeded, including association, all three Saeol district checks, Gwacheon and RSS. Busan city still failed with `read ECONNRESET`; subsequent requests were suppressed by host cooldown. Thus slower fresh HTTPS did not fully resolve city collection in the full production run. No additional official requests were sent after that run, and it is explicitly not recorded as an all-source success.

Final queue: completed 82, closed 7, pending/retry/ready zero, needs_review 1. The new Herald article about U-dong 3 and Haewoonjeongsa is held for missing event-date evidence; it is separate from the city network failure and was not silently assigned a date. The earlier repaired Kookje item was not reverted.

Detailed observations, excluded API diagnostic evidence and independent deployment/resource checks: [shared-egress-pacing-acceptance.json](./shared-egress-pacing-acceptance.json). Request timing, transport and source IP/recovery time were not fully isolated, so these tests do not establish a single blocking cause.
