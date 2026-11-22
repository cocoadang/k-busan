"""Offline by default: report Apt/K-Housing recommendation-source readiness without changing either app."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import json
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

ORIGIN = "https://apt.dsoom.com"
COMPLEX = "gwacheon_raemian_sur"
FAMILIES = {"59": "raemian_sur_59", "84": "raemian_sur_84"}
KST = timezone(timedelta(hours=9))
LIMIT = 1_000_000
MAX_PAGES = 10  # Shadow is deliberately bounded to at most 200 rows per family.


def contract_window(observed):
    kst = observed.astimezone(KST)
    current = kst.year * 12 + kst.month - 1
    def ym(offset):
        year, m = divmod(current + offset, 12)
        return f"{year:04d}{m + 1:02d}"
    return ym(-2), ym(0)


def positive_int(value):
    return type(value) is int and value > 0


def date_in_window(value, start, end):
    try:
        return (isinstance(value, str) and date.fromisoformat(value).isoformat() == value
                and start <= value[:7].replace("-", "") <= end)
    except ValueError:
        return False


def signature(row, area, start, end, *, ledger):
    if not isinstance(row, dict):
        raise ValueError("invalid transaction for comparison")
    d = row.get("dealDate" if ledger else "date")
    p = row.get("amountManwon" if ledger else "price")
    a = row.get("exactArea" if ledger else "area")
    f = row.get("floor")
    if (not date_in_window(d, start, end) or not positive_int(p) or type(a) not in (float, int)
            or not 0 < a < 2000 or int(a) != int(area) or type(f) is not int):
        raise ValueError("invalid transaction for comparison")
    return d, p, a, f


def parse_time(raw):
    t = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if t.utcoffset() is None:
        raise ValueError("expected timezone")
    return t


def history_summary(pages, area, start, end):
    if not isinstance(pages, list) or not pages or not isinstance(pages[0], dict):
        raise ValueError("history unavailable")
    first = pages[0]
    total, active_count, cancelled = (first.get(k) for k in ("storedRows", "activeRows", "cancelledRows"))
    page_count = first.get("totalPages")
    if (not positive_int(page_count) or page_count != len(pages) or page_count > MAX_PAGES
            or any(type(x) is not int or not 0 <= x <= 2000 for x in (total, active_count, cancelled))
            or active_count + cancelled != total
            or page_count != max(1, (total + 19) // 20)):
        raise ValueError("incomplete history coverage")
    keys = ("source", "coverage", "complex", "family", "start", "end", "checkedAt",
            "storedRows", "activeRows", "cancelledRows", "totalPages")
    if (tuple(first.get(k) for k in keys[:6]) !=
            ("K_HOUSING_SAVED_MOLIT", "saved_snapshot_only", COMPLEX, FAMILIES[area], start, end)):
        raise ValueError("unverified history source or window")
    try:
        parse_time(first.get("checkedAt"))
    except (TypeError, ValueError, AttributeError):
        raise ValueError("unverified history timestamp") from None
    active = []
    actual_cancelled = 0
    for p, page in enumerate(pages, 1):
        if (not isinstance(page, dict) or page.get("page") != p
                or any(page.get(k) != first.get(k) for k in keys)
                or not isinstance(page.get("rows"), list)
                or len(page["rows"]) != min(20, max(0, total - (p - 1) * 20))):
            raise ValueError("inconsistent history pagination or snapshot")
        for row in page["rows"]:
            if not isinstance(row, dict) or type(row.get("cancelled")) is not bool:
                raise ValueError("unknown cancellation state")
            sig = signature(row, area, start, end, ledger=True)
            if row["cancelled"]:
                actual_cancelled += 1
            else:
                active.append(sig)  # Preserve equal-looking records, do not deduplicate.
    if actual_cancelled != cancelled or len(active) != active_count:
        raise ValueError("transaction counts disagree")
    latest = None
    ties = 0
    if active:
        top = max(r[:2] for r in active)  # Apt's recommendation view sorts by date, then amount.
        candidates = {r for r in active if r[:2] == top}
        ties = len(candidates)
        if ties == 1:
            latest = next(iter(candidates))
    return {"count": active_count, "cancelled": cancelled, "latest": latest, "latestTieVariants": ties,
            "min": min((r[1] for r in active), default=None),
            "max": max((r[1] for r in active), default=None)}


def legacy_summary(apt, area, start, end):
    items = apt.get("results") if isinstance(apt, dict) else None
    if not isinstance(items, list):
        raise ValueError("legacy unavailable")
    rows = [r for r in items if isinstance(r, dict) and (r.get("name"), r.get("region"),
                r.get("neighborhood"), r.get("areaCategory")) == ("래미안슈르", "41290", "원문동", area)]
    if len(rows) != 1:
        raise ValueError("legacy missing or ambiguous")
    row = rows[0]
    latest = signature(row, area, start, end, ledger=False)
    s = row.get("tradeSummary")
    valid = (isinstance(s, dict) and all(positive_int(s.get(k)) for k in ("count", "min", "max"))
             and s["min"] <= latest[1] <= s["max"])
    return {"latest": latest, "tradeSummary": {k: s[k] for k in ("count", "min", "max")} if valid else None}


def audit(apt, history, observed):
    start, end = contract_window(observed)
    try:
        checked = parse_time(apt.get("checkedAt"))
        same_month = contract_window(checked) == (start, end)
        checked_available = same_month and timedelta(minutes=-5) <= observed - checked <= timedelta(hours=6)
    except (TypeError, ValueError, AttributeError):
        checked_available = False
    checks = {"legacyRecentResponse": checked_available,
              "legacyReportsComplete": isinstance(apt, dict) and apt.get("incomplete") is False,
              "legacyReportsFresh": isinstance(apt, dict) and apt.get("stale") is False}
    areas = {}
    for area in FAMILIES:
        out = {"eligibleForCutover": False, "legacy": None, "history": None, "observableParity": False, "reasons": []}
        reasons = out["reasons"]
        if not all(checks.values()):
            reasons.append("legacy freshness or bucket coverage unverified")
        try:
            out["legacy"] = legacy_summary(apt, area, start, end)
            if out["legacy"]["tradeSummary"] is None:
                reasons.append("legacy latest-only fallback (not independent trade parity)")
        except ValueError as e:
            reasons.append(str(e))
        try:
            out["history"] = history_summary(history.get(area) if isinstance(history, dict) else None, area, start, end)
            if out["history"]["latestTieVariants"] > 1:
                reasons.append("ambiguous latest stored row")
        except ValueError as e:
            reasons.append(str(e))
        a, h = out["legacy"], out["history"]
        if a and h and a["tradeSummary"] and h["latest"] is not None:
            out["observableParity"] = a["latest"] == h["latest"] and all(
                a["tradeSummary"][k] == h[k] for k in ("count", "min", "max"))
            if not out["observableParity"]:
                reasons.append("observable latest or aggregate mismatch")
        # Public price summary is not an independent per-district/month set of raw rows,
        # and the K-Housing family lacks verified legal-dong/parcel/month coverage.
        reasons.append("independent exact legal-dong/month full-row and cancellation parity not available")
        areas[area] = out
    return {"mode": "shadow_only_no_recommendation_change", "complex": COMPLEX,
            "contractWindow": {"start": start, "end": end}, "legacyChecks": checks, "areas": areas,
            "eligibleForCutover": False}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def get_public(path, query=None):
    request = Request(ORIGIN + path + ("?" + urlencode(query) if query else ""),
                      headers={"Accept": "application/json", "User-Agent": "Apt-saved-price-parity/1.0"})
    try:
        with build_opener(NoRedirect).open(request, timeout=10) as response:
            if response.status != 200 or response.headers.get_content_type() != "application/json":
                return None
            data = response.read(LIMIT + 1)
            return json.loads(data) if len(data) <= LIMIT else None
    except (URLError, TimeoutError, ValueError, OSError):
        return None


def live_history(area, start, end):
    q = {"complex": COMPLEX, "family": FAMILIES[area], "start": start, "end": end}
    path = "/api/housing/apartment-trade-history"
    first = get_public(path, {**q, "page": "1"})
    if not isinstance(first, dict) or not positive_int(first.get("totalPages")) or first["totalPages"] > MAX_PAGES:
        return None
    pages = [first]
    for p in range(2, first["totalPages"] + 1):
        page = get_public(path, {**q, "page": str(p)})
        if page is None:
            break
        pages.append(page)
    return pages


def main():
    p = argparse.ArgumentParser(description=__doc__)
    m = p.add_mutually_exclusive_group(required=True)
    m.add_argument("--input", help="local authorized fixture with observedAt, apt and history")
    m.add_argument("--live", action="store_true", help="public fixed Apt GETs, no sign-in or writes")
    args = p.parse_args()
    if args.input:
        with open(args.input, encoding="utf-8") as stream:
            evidence = json.load(stream)
        observed = parse_time(evidence["observedAt"])
        apt, history = evidence.get("apt"), evidence.get("history")
    else:
        observed = datetime.now(timezone.utc)
        start, end = contract_window(observed)
        apt = get_public("/api/housing/apartment-budget")
        with ThreadPoolExecutor(max_workers=2) as pool:
            history = dict(zip(FAMILIES, pool.map(lambda area: live_history(area, start, end), FAMILIES)))
    print(json.dumps(audit(apt, history, observed), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
