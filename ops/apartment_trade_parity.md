# Apt saved-trade recommendation parity (shadow audit)

This audit never changes the app, prices, source selection, or database. It has no scheduled tasks or new HTTP routes. Only `--live` makes read-only GETs against existing public Apt endpoints, with fixed paths, two known area families, an upper page limit, timeouts, and no redirects, cookies or credentials. Elsewhere use an authorized local evidence snapshot with `--input`. No file is written.

```sh
python3 ops/apartment_trade_parity.py --live
python3 ops/apartment_trade_parity.py --input /approved/private/apt-comparison-snapshot.json
python3 -m unittest discover -s ops -p 'test_apartment_trade_parity.py'
```

Fixture top-level JSON: `observedAt` (ISO 8601 with timezone), `apt` (existing apartment-budget JSON), `history` (`{"59":[page1,...],"84":[page1,...]}`, the Apt proxy's K-Housing saved trade-history JSON, queried for the three KST contract months as of `observedAt`). Verify source/scope of the supplied file independently. No joined raw data is persisted.

Current real overlap is **래미안슈르 only**, and this pilot checks only the 59/84 groups already used by its fallback. Do not add the three other history complexes to price matching automatically. Do not treat 도곡한신 and 디에이치퍼스티어아이파크 as reconciled.

An equal latest date/amount/area/floor or matching min/max/count is **observable summary parity**, not eligibility. The legacy recent budget response can be stale or incomplete and omit the canonical count/range when it is already using the old K-Housing fallback. The K-Housing family feed does not attest exact MOLIT legal-dong/parcel and full district-month coverage. The audit distinguishes wrong ranges, absent rows, incomplete pagination and unknown cancellation from successful stored responses, preserves distinct equal-looking rows, and keeps true cutover eligibility false. Only independently verified exact-scope source rows and complete historical coverage/cancellation comparison should change this decision. Nothing here changes the current production recommendation behavior.
