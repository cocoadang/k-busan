# Official source transport investigation — 2026-11-15

Cloud Run Seoul reproduced `UND_ERR_CONNECT_TIMEOUT` for www.busan.go.kr, dynamice.busan.go.kr and apis.data.go.kr (two attempts per host, approximately 10.5 seconds each). DNS returned IPv4 addresses normally. The same hosts responded from the operator PC. A separate native HTTPS probe reached TCP/TLS and HTTP responses for two hosts; Busan city reset the connection. These observations establish intermittent outbound/upstream connection failure, but do not establish the upstream firewall or network owner responsible. API authentication was not reached in the failing requests.

An alternate HTTPS transport was experimentally tested and rejected because recovery was not consistent. TLS verification and redirect allowlists remain unchanged. No network infrastructure or paid static egress was introduced without evidence it would solve the problem.

Production mitigation: query the seven Saeol dates with at most three concurrent requests, retain shared per-run date requests across districts, and impose a 45-second date collection budget (60-second hard maximum). Dates not queried within the budget remain explicit failures, never successful empty results. Association pages/details/redirects/retries share a 60-second deadline. Saeol request timeout is 15 seconds within the remaining collection budget. Existing transient retry and permanent/authentication failure handling remain intact.

Validation: targeted regression covers concurrency, all seven date outcomes, exhausted budget and association abort across retries. Full tests, type check and build are run before deployment. Verification calls must use `notify=false`; diagnostic jobs contain no Telegram credentials. A successful later collection alone cannot establish that the intermittent upstream problem is permanently resolved.

## Production acceptance

Deployed commit `e2313b1de256e41ba3fc38958afc8227d4fce95e`, revision `busan-redevelopment-news-monitor-e2313b1-1`, serves 100% of traffic. GitHub production deployment run 43710026335 succeeded.

Two real production collections using `notify=false` completed with all 12 sources successful, no collection errors and zero Telegram sends: `cycle_1794743022406` (21.399 seconds) and `cycle_1794743099350` (17.175 seconds). Both include Busan city, association portal and Saeol checks for three districts. Full local regression: 186 passed; type check/build and hosted checks passed. The diagnostic job was deleted.

Pending/retry/ready are zero. One newly discovered U-dong 3 article remains `needs_review` with `NEWS_BODY_UNAVAILABLE`; this is separate from the official source transport issue and was not silently closed. The earlier 81 completed and 7 closed queue entries were preserved.

Detailed results: [official-transport-acceptance.json](./official-transport-acceptance.json). Upstream connection failure was intermittent; two successful collections establish current operation, not permanent network recovery.
