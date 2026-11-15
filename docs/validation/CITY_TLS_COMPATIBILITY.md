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
