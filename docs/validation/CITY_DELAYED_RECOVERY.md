# Bounded delayed city recovery — 2026-11-15

## Confirmed defect and controlled observation

The first city TLS connection can reset before HTTP. Earlier comparisons changed timing as well as TLS version/client and did not isolate the cause. TLS-version-only and Python/system-client deployments both still failed; their failed reports are retained, not counted as successful fixes.

A final same-execution comparison held the Node city client, TLS settings, URL, headers and governor constant. Attempt 0 reset during TLS; after 65 seconds with no diagnostic requests, attempt 1 returned HTTP 200 and the complete 63,989-byte page. This required exactly two city connection attempts. Shared outbound source-address behavior and the exact external cause of the initial reset remain unknown.

An internal recovery defect was unambiguous: transport failure set a 60-second host cooldown, but the city reader retried after 250 milliseconds. That retry was rejected locally as `OFFICIAL_HOST_COOLDOWN`, and the collection stopped without an actual recovery request. Switching clients did not fix this interaction.

## Active implementation

Keep the existing fresh Node city HTTPS transport and certificate verification (the tested TLS 1.2 profile); Python is not used by production city collection. After a transient connection failure, wait 65 seconds and allow at most one transport retry across the entire city collection. The wait respects the total collection deadline. HTTP access/rate failures are not retried; existing Retry-After/cooldown checks remain. Normal city spacing is eight seconds, other Busan sources three seconds, and the shared governor still permits only one actual official request/body at a time.

Start city collection asynchronously so its quiet interval overlaps other collection work. Preserve city-first event/audit ordering. This changes task scheduling, not network concurrency. The 240-second city cap fits paced pagination and one delayed retry; the existing analysis deadline is 260 seconds within a 300-second server request, with time reserved for persistence. The expired October recovery page is not requested.

The daily 08:00 Asia/Seoul scheduler now waits up to 320 seconds for the existing 300-second server request and has no automatic whole-job retries (`retryCount=0`, `maxRetryDuration=0`). The previous 180-second timeout and three retries could amplify failures if a slow job timed out; no claim is made that they caused the observed TLS resets. Schedule and authenticated target were preserved. The scheduler was not manually triggered.

Regression tests reproduce the cooldown conflict with scaled offline timings, verify a real recovery request after cooldown, enforce one transport retry for the whole source, cancel waiting without another request, and prove other collection proceeds during the quiet interval while preserving final audit order. No official requests are made by these tests. Historical 17-page coverage remains tested.

Fixed IP/NAT are absent. Diagnostic jobs have no Telegram/AI credentials and are removed after completion. All manual production validation uses `notify=false`.

The first e4ffcff production validation hit a 15-second TCP timeout instead of a TLS reset. Native HTTPS wraps signal timeouts as ABORT_ERR; the earlier timeout-name matcher missed this case. The follow-up tracks the per-request timeout signal independently and retries it once, while an aborted total budget still stops immediately. A regression test covers the native abort shape. Failed production evidence remains in city-delayed-first-timeout.json.

## Final production acceptance

Deployment 3d92e9ce44f850675f2c6a573161c46a2895fffc passed all CI checks and was promoted to 100% traffic (workflow 43723270886). Cycle cycle_1794752448390 completed in 161.194 seconds with all 12 sources successful, no errors and Telegram sent/failed both zero. City logs prove the first TLS reset was recovered: exactly one transport retry, 12 total request attempts, 11 list pages, complete=true, errorCount=0. Zero matching city items does not mean zero pages: all required list pages were read.

Acceptance also checks public health/Firestore readiness, no active VPC egress, deleted fixed-address/NAT resources, and the daily scheduler timeout/retry limits. The pre-existing needs_review=1 item remains unchanged. A successful bounded recovery is confirmed; the upstream reason for the first TLS reset and long-term reliability without a fixed address remain unproven. See city-delayed-recovery-acceptance.json for exact evidence.
