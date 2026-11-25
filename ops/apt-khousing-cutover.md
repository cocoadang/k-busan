# Consolidating apartment sale storage and reads

The production Apt catalog has 18 recommendation complexes across 12 districts.
Apt still writes catalog-projected MOLIT rows to
`apartment_trade_months_v1/{district}_{contractMonth}` and a K-Housing-derived
Sur backup to `apartment_trade_fallback/{YYYYMM}`. Both the daily housing
refresh and production startup paths can write. The public budget handler
reads both Apt collections, while the history view reads saved K-Housing data
for its four explicitly registered complexes. Apt design/editorial content,
floor plans, and unrelated K-busan data are not part of this move.

Collect an authorized **read-only** baseline from the verified Apt production
database. Run locally with existing narrow Firestore read credentials; do not
create credentials, log values or grant permissions for this script. Do not
run against a guessed database ID.

```sh
npx --no-install tsx ops/apt_legacy_trade_inventory.ts busan-redevelopment '(default)' 202611
```

This does at most 37 named document reads (36 buckets plus the fallback), no
collection scan or mutations. It emits counts only; unknown/ambiguous rows
are not treated as matched. A cached zero means an empty Apt projection, not
an official zero. A Sur fallback may be copied from K-Housing so it is not
independent parity evidence. Six-hour freshness is the old cache behavior, not
an official completeness claim.

Before switching:

1. Locate the **current** K-Housing write/deploy source and its real data store
   using the owner's existing access. Establish who writes each region/month
   and how to attest complete, recent sale snapshots. The fixed ID family
   history contract is not evidence for an entire district/month. Retain
   cancellations, late corrections and distinct equal-looking rows. Keep
   rights/assignments separate from completed sales.
2. For all 36 region/month buckets, reconcile the legacy inventory against
   exact official complex identity and the canonical store. Check 59/84 and
   real other sizes (including Cheolsan 53/83 and Pyeongchon 60), counts,
   min/max and latest active sale. Do not infer a missing or unresolved identity
   is an official zero. Investigate and backfill from the official source
   into K-Housing only. Do not copy the legacy fallback into the new store.
3. Before promoting a candidate, exercise budget and history separately,
   verify expected identity/area/drift and failures, preserve unrelated app
   views, and confirm the pre-deploy **serving** revision for rollback.
   Pair the canonical budget read and disabling **both** legacy refresh
   paths in the same rollout. Keep the prior snapshots intact; do not delete
   data, change the user interface, or redirect existing URLs in this step.
   After cutover verify that subsequent collection writes only to K-Housing
   and that both Apt screens read the same canonical source.
