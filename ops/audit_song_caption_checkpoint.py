#!/usr/bin/env python3
"""Read-only, offline Song Hee-gu caption checkpoint audit. Reports no cue text."""
import argparse
import csv
import io
import json
from pathlib import Path, PurePosixPath
import re
from urllib.parse import parse_qs, urlsplit
import zipfile

VIDEO_ID = re.compile(r"[A-Za-z0-9_-]{11}\Z")
CAPTION = re.compile(r"([A-Za-z0-9_-]{11})\.ko\.vtt\Z")
STAMP = r"(?:(?:[0-9]{2,}):)?[0-5][0-9]:[0-5][0-9]\.[0-9]{3}"
TIMING = re.compile(rf"({STAMP})[ \t]+-->[ \t]+({STAMP})(?:[ \t]+[^\r\n]*)?\Z")
STATUS = {
    **dict.fromkeys(("수집 완료", "완료", "ok", "success", "complete", "completed", "collected"), "complete"),
    **dict.fromkeys(("대기", "미처리", "pending", "queued", "not attempted"), "pending"),
    **dict.fromkeys(("조회 오류", "수집 실패", "오류", "실패", "failed", "error", "fetch error"), "failed"),
    **dict.fromkeys(("자막 없음", "없음", "미제공", "absent", "unavailable", "no captions", "no subtitles"), "absent"),
}
LIMIT = 12 * 1024 * 1024

def read_limited(file):
    data = file.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise ValueError("member too large")
    return data.decode("utf-8-sig")

def read_path(path):
    with path.open("rb") as file:
        return read_limited(file)

def millis(stamp):
    total = 0
    whole, fractional = stamp.split(".")
    for part in whole.split(":"):
        total = total * 60 + int(part)
    return total * 1000 + int(fractional)

def vtt_check(source):
    lines = source.splitlines()
    if not lines or not re.fullmatch(r"WEBVTT(?:[ \t].*)?", lines[0]):
        return 0, 0, ["invalid_webvtt_header"]
    try:
        header_end = next(i for i, line in enumerate(lines) if line == "")
    except StopIteration:
        return 0, 0, ["no_timed_cues"]
    if any("-->" in line for line in lines[:header_end]):
        return 0, 0, ["missing_header_separator"]
    errors, previous, count, latest = set(), -1, 0, 0
    blocks = re.split(r"\n{2,}", "\n".join(lines[header_end + 1:]).strip("\n"))
    for block in blocks:
        rows = block.splitlines()
        if not rows or not block.strip() or re.fullmatch(r"NOTE(?:[ \t].*)?|STYLE|REGION", rows[0]):
            continue
        at = 0 if "-->" in rows[0] else 1
        match = TIMING.fullmatch(rows[at]) if len(rows) > at else None
        if not match:
            errors.add("invalid_cue_timing")
            continue
        start, end = map(millis, match.groups())
        if end <= start:
            errors.add("nonpositive_cue_duration")
        if start < previous:
            errors.add("nonmonotonic_cue_start")
        previous = start
        # YouTube auto-captions may insert whitespace-only spacer cues.
        # Check their times, but require at least one cue with caption text.
        if any(row.strip() for row in rows[at + 1:]):
            count += 1
        if any(TIMING.fullmatch(row) for row in rows[at + 1:]):
            errors.add("missing_cue_separator")
        latest = max(latest, end)
    if not count:
        errors.add("no_nonempty_timed_cues")
    return count, latest, sorted(errors)

def inventory(source):
    def column(names, options, required=True):
        found = next((name for name in options if name in names), None)
        if required and found is None:
            raise ValueError("inventory is missing required ID or status column")
        return found
    rows = csv.DictReader(io.StringIO(source, newline=""), strict=True)
    cols = rows.fieldnames or ()
    id_key = column(cols, ("영상 ID", "video_id", "videoId", "id"))
    status_key = column(cols, ("한국어 자막 상태", "status", "caption_status"))
    duration_key = column(cols, ("길이(초)", "duration_seconds", "duration"), False)
    url_key = column(cols, ("영상 링크", "url", "video_url"), False)
    found, issues = {}, []
    for row in rows:
        line = rows.line_num
        video = (row.get(id_key) or "").strip()
        if VIDEO_ID.fullmatch(video) is None:
            issues.append({"row": line, "issue": "invalid_video_id"})
            continue
        if video in found:
            issues.append({"row": line, "video_id": video, "issue": "duplicate_inventory_id"})
            continue
        raw = (row.get(status_key) or "").strip().casefold()
        duration = (row.get(duration_key) or "").strip()
        duration = int(duration) if re.fullmatch(r"[0-9]{1,8}", duration) else None
        if url_key and (url := (row.get(url_key) or "").strip()):
            try:
                parts = urlsplit(url)
                url_id = (parts.path.lstrip("/") if parts.hostname == "youtu.be" else
                          parse_qs(parts.query).get("v", [None])[0]
                          if parts.hostname in ("www.youtube.com", "youtube.com", "m.youtube.com")
                             and parts.path == "/watch" else None)
            except ValueError:
                url_id = None
            if url_id != video:
                issues.append({"row": line, "video_id": video, "issue": "video_url_id_mismatch"})
        found[video] = (STATUS.get(raw, "unknown"), duration)
    if not found:
        raise ValueError("inventory contains no valid video IDs")
    return found, issues

def reviewed(path):
    root = json.loads(read_path(path))
    def values(node):
        if isinstance(node, dict):
            for key, value in node.items():
                if key == "reviewedVideoIds":
                    if not isinstance(value, list):
                        raise ValueError("reviewedVideoIds is not an array")
                    yield value
                elif isinstance(value, (list, dict)):
                    yield from values(value)
        elif isinstance(node, list):
            for item in node:
                yield from values(item)
    groups = list(values(root))
    if not groups:
        raise ValueError("catalog has no reviewedVideoIds")
    ids = [video for group in groups for video in group]
    if any(not isinstance(video, str) or not VIDEO_ID.fullmatch(video) for video in ids):
        raise ValueError("catalog contains invalid reviewedVideoIds")
    return set(ids)

def audit_members(names, read, reviewed_ids=None):
    inventories = [n for n in names if PurePosixPath(n).name == "video_inventory.csv"]
    if len(inventories) != 1:
        raise ValueError("expected exactly one video_inventory.csv")
    videos, inventory_issues = inventory(read(inventories[0]))
    root = PurePosixPath(inventories[0]).parent
    files, duplicate = {}, set()
    malformed_members = 0
    for name in names:
        path = PurePosixPath(name)
        if path.suffix.lower() != ".vtt":
            continue
        match = CAPTION.fullmatch(path.name)
        if path.parent != root / "captions" or not match:
            malformed_members += 1
            continue
        video = match[1]
        if video in files:
            duplicate.add(video)
        else:
            files[video] = name
    buckets = {key: [] for key in ("complete", "pending", "failed", "absent", "unknown")}
    output = {key: [] for key in ("missing", "valid", "invalid")}
    findings, warnings = {}, {}
    for video, (status, duration) in sorted(videos.items()):
        buckets[status].append(video)
        issues = []
        if video not in files:
            state = "missing"
        else:
            try:
                _, end, issues = vtt_check(read(files[video]))
                if duration and end > (duration + 2) * 1000:
                    warnings[video] = ["cue_end_exceeds_inventory_duration_by_over_2s"]
            except (OSError, UnicodeError, ValueError, RuntimeError, zipfile.BadZipFile):
                issues = ["unreadable_caption"]
            if video in duplicate:
                issues.append("duplicate_caption_member")
            state = "invalid" if issues else "valid"
        output[state].append(video)
        if status == "complete" and state != "valid":
            issues.append("complete_without_valid_caption")
        if status != "complete" and state != "missing":
            issues.append("caption_present_without_complete_status")
        if status == "unknown":
            issues.append("unknown_inventory_status")
        if issues:
            findings[video] = issues
    total = len(videos)
    orphan = sorted(set(files) - set(videos))
    report = {
        "inventory_total": total,
        "inventory_status_counts": {key: len(ids) for key, ids in buckets.items()},
        "output_counts": {key: len(ids) for key, ids in output.items()},
        "valid_caption_coverage_percent": round(100 * len(output["valid"]) / total, 2),
        "inventory_status_ids": buckets,
        "output_ids": output,
        "inventory_issues": inventory_issues,
        "video_issues": findings,
        "video_warnings": warnings,
        "orphan_caption_ids": orphan,
        "duplicate_caption_ids": sorted(duplicate),
        "malformed_caption_member_count": malformed_members,
    }
    if reviewed_ids is not None:
        report["catalog"] = {
            "reviewed_count": len(reviewed_ids),
            "reviewed_outside_inventory_ids": sorted(reviewed_ids - set(videos)),
            "reviewed_in_inventory_without_valid_caption_ids": sorted((reviewed_ids & set(videos)) - set(output["valid"])),
            "valid_caption_not_reviewed_ids": sorted(set(output["valid"]) - reviewed_ids),
        }
    return report

def audit(path, catalog=None):
    reviewed_ids = reviewed(catalog) if catalog else None
    if path.is_dir():
        names = [p.relative_to(path).as_posix() for p in path.rglob("*")
                 if not p.is_symlink() and p.is_file() and
                 (p.name == "video_inventory.csv" or p.suffix.lower() == ".vtt")]
        return audit_members(names, lambda n: read_path(path / n), reviewed_ids)
    with zipfile.ZipFile(path) as archive:
        names = [entry.filename for entry in archive.infolist() if not entry.is_dir()]
        def read(name):
            with archive.open(name) as file:
                return read_limited(file)
        return audit_members(names, read, reviewed_ids)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkpoint", type=Path, help="existing ZIP or folder")
    parser.add_argument("--catalog", type=Path, help="optional local JSON with reviewedVideoIds")
    args = parser.parse_args()
    try:
        result = audit(args.checkpoint, args.catalog)
    except (OSError, UnicodeError, ValueError, RuntimeError, csv.Error, zipfile.BadZipFile):
        parser.exit(2, "Audit input invalid or unreadable; check input and schema.\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return int(any(result[key] for key in ("inventory_issues", "video_issues",
                                          "orphan_caption_ids", "duplicate_caption_ids",
                                          "malformed_caption_member_count")))

if __name__ == "__main__":
    raise SystemExit(main())
