from datetime import datetime, timezone
import unittest

from apartment_trade_parity import audit, contract_window, history_summary


NOW = datetime(2026, 11, 22, tzinfo=timezone.utc)


def legacy(summary=True, **flags):
    rows = []
    for area in ("59", "84"):
        n = int(area)
        r = dict(name="래미안슈르", region="41290", neighborhood="원문동",
                 areaCategory=area, area=n + 0.5, date="2026-11-01", price=200000, floor=8)
        if summary:
            r["tradeSummary"] = dict(count=2, min=180000, max=200000)
        rows.append(r)
    return dict(results=rows, **{"checkedAt": NOW.isoformat(), "stale": False, "incomplete": False, **flags})


def page(area="59"):
    n = int(area)
    return dict(source="K_HOUSING_SAVED_MOLIT", coverage="saved_snapshot_only",
                complex="gwacheon_raemian_sur", family=f"raemian_sur_{area}",
                start="202609", end="202611", page=1, checkedAt=NOW.isoformat(),
                storedRows=3, activeRows=2, cancelledRows=1, totalPages=1,
                rows=[
                    dict(dealDate="2026-11-01", amountManwon=200000, exactArea=n + .5, floor=8, cancelled=False),
                    dict(dealDate="2026-11-01", amountManwon=200000, exactArea=n + .5, floor=8, cancelled=True),
                    dict(dealDate="2026-09-01", amountManwon=180000, exactArea=n + .5, floor=8, cancelled=False),
                ])


class ApartmentTradeParityTest(unittest.TestCase):
    def test_observable_summary_is_not_legal_dong_row_parity(self):
        report = audit(legacy(), {"59": [page()], "84": [page("84")]}, NOW)
        self.assertFalse(report["eligibleForCutover"])
        self.assertTrue(all(r["observableParity"] for r in report["areas"].values()))
        self.assertTrue(all(not r["eligibleForCutover"] for r in report["areas"].values()))
        self.assertEqual(report["areas"]["59"]["history"]["cancelled"], 1)
        self.assertIn("independent exact legal-dong/month full-row and cancellation parity not available",
                      report["areas"]["84"]["reasons"])

    def test_matching_latest_from_surrogate_stale_is_not_independent(self):
        report = audit(legacy(summary=False, stale=True, incomplete=True), {"59": [page()]}, NOW)
        self.assertEqual(report["areas"]["59"]["legacy"]["latest"], report["areas"]["59"]["history"]["latest"])
        self.assertFalse(report["areas"]["59"]["observableParity"])
        self.assertIn("legacy latest-only fallback (not independent trade parity)", report["areas"]["59"]["reasons"])
        self.assertIn("legacy freshness or bucket coverage unverified", report["areas"]["59"]["reasons"])
        self.assertIn("history unavailable", report["areas"]["84"]["reasons"])

    def test_refuses_unknown_cancellation_wrong_window_and_improper_pagination(self):
        ambiguous = page()
        ambiguous["rows"][0].pop("cancelled")
        with self.assertRaisesRegex(ValueError, "unknown cancellation"):
            history_summary([ambiguous], "59", "202609", "202611")
        with self.assertRaisesRegex(ValueError, "window"):
            history_summary([{**page(), "end": "202610"}], "59", "202609", "202611")
        with self.assertRaisesRegex(ValueError, "coverage"):
            history_summary([{**page(), "totalPages": 2}], "59", "202609", "202611")
        with self.assertRaisesRegex(ValueError, "counts disagree"):
            p = page()
            p["rows"][0]["cancelled"] = True
            history_summary([p], "59", "202609", "202611")

    def test_preserves_valid_equal_rows_and_excludes_cancelled_only(self):
        p = page()
        p["rows"][2] = p["rows"][0].copy()
        self.assertEqual(history_summary([p], "59", "202609", "202611")["count"], 2)
        p["rows"][2]["floor"] += 1
        h = history_summary([p], "59", "202609", "202611")
        self.assertIsNone(h["latest"])
        self.assertEqual(h["latestTieVariants"], 2)

    def test_wrong_dong_and_stale_previous_month_never_pass(self):
        apt = legacy(checkedAt="2026-10-31T13:00:00+00:00")
        apt["results"][0]["neighborhood"] = "별양동"
        report = audit(apt, {"59": [page()]}, NOW)
        self.assertFalse(report["legacyChecks"]["legacyRecentResponse"])
        self.assertIsNone(report["areas"]["59"]["legacy"])
        self.assertFalse(report["eligibleForCutover"])

    def test_kst_month_and_year_boundary(self):
        observed = datetime(2025, 12, 31, 15, tzinfo=timezone.utc)
        self.assertEqual(contract_window(observed), ("202511", "202601"))


if __name__ == "__main__":
    unittest.main()
