# Dedicated outbound path for official sources — 2026-11-15

## Diagnosis and controlled comparison

Repeated production failures occurred before HTTP/authentication. A same-image, same-execution control compared built-in fetch, Undici's default connector, traditional curves, TLS 1.2, and native HTTPS (default/traditional curves) against the three authorized source endpoints. All 36 requests failed. All 12 native HTTPS attempts failed before the TCP `connect` event, ruling out an article parser, API authentication and TLS negotiation options as the cause in that execution.

Cloud Run's default shared outbound path was the reproducible failure condition. Google documents that its shared regional egress IP pool can be blocked/throttled due to shared IP reputation: https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip . The exact upstream device/reason that dropped connections is not established; do not claim a confirmed government WAF rule or geolocation block.

Only the outbound network was changed: a dedicated Seoul custom VPC/subnet, Direct VPC egress `ALL_TRAFFIC`, Cloud Router/Public NAT and reserved address `34.64.198.132`. The image, source URLs, credentials, CA bundle and TLS validation were unchanged. Two independent job executions confirmed the actual public origin address and each performed three rounds of city, association and Saeol collection: all 18 source checks succeeded. API code `03` is an actual no-data response for that publication date, not a swallowed transport error.

The candidate's real full pipeline cycle `cycle_1794745121885` succeeded for all 12 sources in 24.404 seconds with zero errors and zero Telegram sends. The network candidate was then promoted at 100%. A temporary public-access setting reset during the initial Cloud Run API patch was detected and restored before acceptance; both candidate and public service health returned 200. Subsequent service changes preserve all mutable service settings, including public access and metadata.

## Configuration and deployment

Live resource configuration is recorded in [official-egress.json](../../ops/official-egress.json). No VM or always-running connector was introduced. The dedicated subnet has Private Google Access and the new VPC has no ingress allow rules. The GitHub deployment identity has `compute.networkUser` only on the dedicated subnet. Production deployment validates the exported VPC annotations before replacing the service so that a later image deployment fails rather than reverting to shared/private-only egress or a different region/network.

`python -m unittest discover -s ops -p test_official_egress.py` checks accepted configuration and rejection of shared/private-only/wrong-network/wrong-subnet/wrong-region deployments. Type check, 187 Node tests and production build passed.

`scripts/check_official_egress.ts` is a bounded read-only diagnostic for a job using this VPC. It rejects Telegram/AI credentials and makes no Firestore writes. It verifies the observed public address before three official-source collection rounds. Run with the existing DATA_GO_KR_API_KEY only, normal application CA setup and the deployed image. Temporary diagnostic jobs are removed after final verification.

## Added recurring cost

Public NAT list pricing: one reserved address used by NAT is $0.005/hour ($3.60 per 720 hours); gateway processing is $0.0014 per assigned instance-hour up to the published cap and $0.045/GiB processed, plus applicable transfer charges. Actual cost depends on assigned/active resources and traffic; this is not a flat total-cost quote. https://cloud.google.com/nat/pricing .

## Rollback

Revert the service's VPC egress using a reviewed Cloud Run exported service specification, preserving public access, IAM, secrets and traffic. Returning to shared egress can reproduce the official-source failures. Remove NAT/router/address/subnet/network only after no service/job revisions still use them; do not release the reserved address while production depends on it. Original service settings are privately retained, without secrets in this repository.
