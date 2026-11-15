> Updated: the TLS-1.2-only Node deployment also failed in production. The system-client refinement and its final acceptance below supersede a version-only conclusion.

# Busan city TLS compatibility investigation — 2026-11-15

## Minimal same-execution comparison

The shared-egress diagnostic used the deployed production image, no VPC/NAT/static address and no Telegram/AI/API credentials. It issued exactly two GET requests to the same `/nbgosi` URL with the production headers, one minute apart, changing only permitted TLS versions.

- Default Node TLS negotiation: TCP connected at 249 ms, then `ECONNRESET` at 260 ms before `secureConnect`, before HTTP headers and before any body bytes.
- TLS 1.2 only: TCP connected at 33 ms; verified TLS completed at 66 ms; HTTP 200, 63,989 bytes, complete HTML in 1,322 ms. Certificate authorized, cipher ECDHE-RSA-AES256-GCM-SHA384.

The reproducible failure stage is TLS negotiation, not HTML parsing or an HTTP API authentication response. The observed success supports a compatibility setting for the legacy endpoint. It does not identify the specific upstream TLS termination device or prove that request frequency/source-IP policies never contribute. Previous 403 from the separate Saeol diagnostic remains excluded because that diagnostic double-encoded the portal key.

## Change

Only the city transport for `www.busan.go.kr` / `busan.go.kr` `/nbgosi` uses `minVersion=maxVersion=TLSv1.2`. Certificate/hostname verification remains enabled, no TLS 1.0/1.1 and no unencrypted HTTP. All other official sites, news and AI keep their existing transport. The serial 8-second city spacing, 3-second other-source spacing, host cooldown and redirect/body-size limits remain.

Transport errors now record the failing phase (TCP, TLS, headers or body), code, bytes and elapsed time without URLs, credentials or query strings. Truncated bodies fail closed. These diagnostics identify later failures without issuing extra probes.

Node's per-connection TLS controls: https://nodejs.org/download/release/latest-jod/docs/api/tls.html . `scripts/diagnose_city_tls.cjs` is the bounded two-request comparison with a 60-second quiet interval and no automated retry; use an isolated job without notification/AI credentials.


The expired October 7 one-off recovery no longer adds an HTTP request after its 14-day window. Recent notice links found in a live list are still fetched normally. The captured 17-page regression now requires exactly pages 1–17, without the obsolete eighteenth recovery request. With the retained eight-second spacing, the city collection budget is 180 seconds; the overall analysis deadline is 260 seconds within the existing 300-second HTTP limit, leaving time to persist and respond instead of skipping later queued analysis solely because of intentionally slow source reads.


## System-client refinement

The Node TLS-1.2-only deployment did not fix the production handshake: `cycle_1794749215947` still logged TLS-phase ECONNRESET with zero HTTP bytes. The failed acceptance report is retained as [city-node-tls12-failed.json](./city-node-tls12-failed.json). A separate operator-PC TLS-1.2 attempt also reset; it is not counted as production success.

A second isolated shared-egress comparison used the same deployed image and full production CA bundle. It made exactly two city requests, one minute apart: the exact Node city transport again reset during TLS; Python's existing system OpenSSL 3.0.22 client returned HTTP 200 and the complete 63,989-byte HTML with certificate verification. Both used TLS 1.2. This points to TLS implementation/handshake compatibility, not TLS version alone. The exact upstream device and contribution of dynamic source addresses remain unconfirmed.

Production uses the already-installed Python standard-library HTTPS client for the city only, directly (no proxy), with no automatic redirect following or transport fallback. The Python process receives only PATH/locale/CA-path environment values, not API or Telegram credentials. URLs are constrained to the official city HTTPS hosts/path, responses are capped at 2 MiB, status/headers are returned intact for existing restriction/redirect checks, and abort/timeout kills the child process. Certificate and hostname verification remain mandatory. Docker validates the existing interpreter's SSL setup without network access. Other sources continue using their existing client and pacing.

The city collection counter is named `requestAttempts`: rejected cooldown calls are local attempts, not extra HTTP traffic. Successful complete collections provide the number of list/detail calls without additional diagnostic probes.
