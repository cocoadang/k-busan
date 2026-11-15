# Shared egress and restrained official collection — 2026-11-15

The user requested removal of the paid dedicated IP/NAT and comparison of slower calling methods. Earlier shared-vs-static comparisons did not isolate request timing, source address and elapsed recovery time; they do not prove a permanent need for a static address or a confirmed upstream IP blacklist.

Production returns to shared Cloud Run egress. NAT/router and reserved address are removed after confirming traffic uses the shared revision. Previous static network configuration is archived, not an active provisioning requirement. Deployment validation now refuses to reattach a VPC/connector, preserving the user's choice.

A single process-wide governor coordinates the Busan city, association and Saeol API requests, including redirects and retries. Production has at most one in-flight request/body and a minimum 3-second pause after completion. Transport/body failure pauses that host for 60 seconds; HTTP 403/429/503 also pauses it and honors Retry-After. Queued requests honor their deadline and cannot start after abort. Response buffering is bounded at 2 MiB. Existing source failures remain visible; the change does not fabricate empty successful collections. Other-host news/AI requests are unaffected.

Low-volume comparison: three authorized source endpoints, one request each at 3-second spacing using fetch; at least 120 seconds with no diagnostic requests; then one request each at 8-second spacing with fresh verified HTTPS connections. No automatic retries. An explicit access/rate restriction skips that host in the second phase. The diagnostic contains no Telegram/AI credentials and writes no Firestore data. This small sample evaluates observed behavior and cannot by itself prove why an upstream drops connections.


## Low-volume findings and refinement

The first diagnostic sent five actual requests (three in phase A and two in phase B). Phase A (fetch, serial, 3 seconds) received a city connection reset and association HTTP 200. Phase B, after a 120-second quiet interval, used fresh verified HTTPS connections at 8-second spacing: city and association both returned 200. The Saeol diagnostic's 403 is excluded from rate-limit inference: its initial test URL double-encoded the portal key. The diagnostic URL builder was corrected. The normal production collector already normalizes the key correctly and successfully queried Saeol for all three monitored districts in the subsequent real collection.

The first paced production cycle `cycle_1794747295252` completed in 35.853 seconds with 11/12 successful sources and Telegram 0. Busan city failed and entered host cooldown. This is retained as a failed source, not misreported as complete success. Consequently city collection alone switches to fresh native HTTPS (full certificate verification, agent reuse disabled) with 8-second spacing; other Busan sources retain serial 3-second spacing. The city total budget becomes 90 seconds to accommodate intentionally slower pagination, retaining the response/request/page caps. The later outcome is recorded below.

The comparison changes both elapsed time and transport, and shared outbound source addresses may also vary. It does not identify the exact reason an upstream resets a connection. It establishes which low-volume requests succeeded; no claim of a proven blacklist or a permanent need for fixed IP is made.
