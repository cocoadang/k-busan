> Superseded: the user requested removal of fixed IP/NAT. See [shared-egress testing](./SHARED_EGRESS_PACING.md). The following records the earlier experiment, not the active configuration.

# Dedicated outbound path for official sources — 2026-11-15

## Diagnosis and controlled comparison

Repeated production failures occurred before HTTP/authentication. A same-image, same-execution control compared built-in fetch, Undici's default connector, traditional curves, TLS 1.2, and native HTTPS (default/traditional curves) against the three authorized source endpoints. All 36 requests failed. All 12 native HTTPS attempts failed before the TCP `connect` event, ruling out an article parser, API authentication and TLS negotiation options as the cause in that execution.

Cloud Run's default shared outbound path was the reproducible failure condition. Google documents that its shared regional egress IP pool can be blocked/throttled due to shared IP reputation: https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip . The exact upstream device/reason that dropped connections is not established; do not claim a confirmed government WAF rule or geolocation block.

Only the outbound network was changed: a dedicated Seoul custom VPC/subnet, Direct VPC egress `ALL_TRAFFIC`, Cloud Router/Public NAT and reserved address `34.64.198.132`. The image, source URLs, credentials, CA bundle and TLS validation were unchanged. Two independent job executions confirmed the actual public origin address and each performed three rounds of city, association and Saeol collection: all 18 source checks succeeded. API code `03` is an actual no-data response for that publication date, not a swallowed transport error.

The candidate's real full pipeline cycle `cycle_1794745121885` succeeded for all 12 sources in 24.404 seconds with zero errors and zero Telegram sends. The network candidate was then promoted at 100%. A temporary public-access setting reset during the initial Cloud Run API patch was detected and restored before acceptance; both candidate and public service health returned 200. Subsequent service changes preserve all mutable service settings, including public access and metadata.

## Configuration and deployment

Live resource configuration is recorded in [official-egress.json](./archived-static-egress.json). No VM or always-running connector was introduced. The dedicated subnet has Private Google Access and the new VPC has no ingress allow rules. The GitHub deployment identity has `compute.networkUser` only on the dedicated subnet. Production deployment validates the exported VPC annotations before replacing the service so that a later image deployment fails rather than reverting to shared/private-only egress or a different region/network.

`python -m unittest discover -s ops -p test_official_egress.py` checks accepted configuration and rejection of shared/private-only/wrong-network/wrong-subnet/wrong-region deployments. Type check, 187 Node tests and production build passed.

`scripts/check_official_egress.ts` is a bounded read-only diagnostic for a job using this VPC. It rejects Telegram/AI credentials and makes no Firestore writes. It verifies the observed public address before three official-source collection rounds. Run with the existing DATA_GO_KR_API_KEY only, normal application CA setup and the deployed image. Temporary diagnostic jobs are removed after final verification.

## Added recurring cost

Public NAT list pricing: one reserved address used by NAT is $0.005/hour ($3.60 per 720 hours); gateway processing is $0.0014 per assigned instance-hour up to the published cap and $0.045/GiB processed, plus applicable transfer charges. Actual cost depends on assigned/active resources and traffic; this is not a flat total-cost quote. https://cloud.google.com/nat/pricing .

## Rollback

Revert the service's VPC egress using a reviewed Cloud Run exported service specification, preserving public access, IAM, secrets and traffic. Returning to shared egress can reproduce the official-source failures. Remove NAT/router/address/subnet/network only after no service/job revisions still use them; do not release the reserved address while production depends on it. Original service settings are privately retained, without secrets in this repository.

## Final production acceptance

The dedicated subnet was expanded to `10.42.0.0/24` to retain headroom for the service's maximum 13 instances, revision replacement and temporary diagnostic address retention. Cloud Run retains addresses for scaled-down revisions for up to 20 minutes: https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc . This is private address capacity, not an added public address or VM.

PR 19 merged; GitHub production deployment 43713614605 succeeded. Final image commit `516c44c4d503a3f01cea226d6230abdbdf8bd81c`, revision `busan-redevelopment-news-monitor-516c44c-1`, receives 100% of traffic and retains the dedicated egress annotations. Both Python deployment-guard tests and all 187 Node tests passed; type check/build and hosted checks passed.

Three real no-alert collection cycles all succeeded for all 12 sources: candidate `cycle_1794745121885` (24.404 seconds), promoted production `cycle_1794745245439` (16.675 seconds), and post-image-deployment production `cycle_1794745640268` (17.587 seconds). All collection errors and Telegram sent/failed counts were zero.

Independent acceptance reads verified public health, Firestore and gpt-6-luna configuration, unchanged credentials/service account/request timeout, correct VPC/subnet, new image/100% traffic and preservation of the repaired U-dong article date/checksum. Final queue: completed 82, closed 7, pending/retry/ready/needs_review all zero. Temporary TLS and egress diagnostic jobs were deleted; only the intentional production network resources remain.

Detailed results: [official-static-egress-acceptance.json](./official-static-egress-acceptance.json). These repeated tests establish successful operation on the dedicated path, not a guarantee against future upstream outages. The specific upstream dropping device or policy was not identified.
