#!/usr/bin/env python3
"""Import one already-authorized Korean WebVTT into a private checkpoint ZIP."""
import argparse
from copy import copy
import csv
import io
import json
import os
from pathlib import Path, PurePosixPath
from shutil import copyfileobj
import stat
import sys
import tempfile
import zipfile

from audit_song_caption_checkpoint import audit_members, inventory, read_limited, read_path, VIDEO_ID, vtt_check

MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
MAX_MEMBERS = 2_000


def private_path(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError("input_not_regular_file")
    resolved = path.resolve(strict=True)
    markers = (parent / ".git" for parent in resolved.parents)
    if any(marker.is_file() or marker.is_symlink() or (marker / "HEAD").is_file() for marker in markers):
        raise ValueError("use_paths_outside_git_checkout")
    return resolved


def safe_members(archive):
    entries = archive.infolist()
    if len(entries) > MAX_MEMBERS or sum(entry.file_size for entry in entries) > MAX_ARCHIVE_BYTES:
        raise ValueError("checkpoint_too_large")
    seen = set()
    for entry in entries:
        name = entry.filename[:-1] if entry.is_dir() else entry.filename
        parts = name.split("/")
        if (not name or "\\" in name or ":" in name or
                any(p in ("", ".", "..") for p in parts) or name in seen or
                stat.S_ISLNK(entry.external_attr >> 16)):
            raise ValueError("unsafe_or_duplicate_archive_member")
        seen.add(name)
    return entries


def existing_report(archive, entries):
    names = [entry.filename for entry in entries if not entry.is_dir()]

    def read(name):
        with archive.open(name) as source:
            return read_limited(source)

    report = audit_members(names, read)
    if any(report[key] for key in ("inventory_issues", "video_issues", "orphan_caption_ids",
                                   "duplicate_caption_ids", "malformed_caption_member_count")):
        raise ValueError("checkpoint_has_audit_errors")
    return report, next(name for name in names if PurePosixPath(name).name == "video_inventory.csv"), read


def mark_collected(source, video):
    reader = csv.DictReader(io.StringIO(source, newline=""), strict=True)
    id_key = next(key for key in ("영상 ID", "video_id", "videoId", "id") if key in reader.fieldnames)
    status_key = next(key for key in ("한국어 자막 상태", "status", "caption_status") if key in reader.fieldnames)
    destination = io.StringIO(newline="")
    writer = csv.DictWriter(destination, fieldnames=reader.fieldnames)
    writer.writeheader()
    for row in reader:
        if row[id_key].strip() == video:
            row[status_key] = "수집 완료" if status_key == "한국어 자막 상태" else "collected"
        writer.writerow(row)
    return destination.getvalue().encode("utf-8-sig")


def intake(checkpoint, caption, video):
    if not VIDEO_ID.fullmatch(video) or caption.name != f"{video}.ko.vtt":
        raise ValueError("caption_filename_must_match_video_id")
    checkpoint, caption = private_path(checkpoint), private_path(caption)
    if checkpoint.suffix.lower() != ".zip":
        raise ValueError("checkpoint_must_be_zip")
    if checkpoint.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("checkpoint_too_large")
    lock = checkpoint.with_name(checkpoint.name + ".intake-lock")
    try:
        lock.mkdir(mode=0o700)
    except FileExistsError:
        raise ValueError("checkpoint_locked") from None
    temporary = None
    try:
        source = read_path(caption)
        _, end, errors = vtt_check(source)
        if errors:
            raise ValueError("invalid_webvtt")
        with zipfile.ZipFile(checkpoint) as original:
            entries = safe_members(original)
            report, inventory_name, read = existing_report(original, entries)
            index_text = read(inventory_name)
            videos, _ = inventory(index_text)
            if video not in videos:
                raise ValueError("video_not_in_checkpoint")
            _, duration = videos[video]
            if duration is not None and end > (duration + 2) * 1000:
                raise ValueError("caption_exceeds_video_duration")
            member = str(PurePosixPath(inventory_name).parent / "captions" / caption.name)
            if video in report["output_ids"]["valid"]:
                if source.splitlines() != read(member).splitlines():
                    raise ValueError("conflicting_existing_caption")
                return {"status": "already_imported", "video_id": video, "valid_captions": report["output_counts"]["valid"]}
            with tempfile.NamedTemporaryFile(prefix=".caption-intake-", suffix=".zip", dir=checkpoint.parent, delete=False) as tmp:
                temporary = Path(tmp.name)
                with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED) as updated:
                    updated.comment = original.comment
                    for entry in entries:
                        destination = copy(entry)
                        if entry.filename == inventory_name:
                            updated.writestr(destination, mark_collected(index_text, video))
                        elif entry.is_dir():
                            updated.writestr(destination, b"")
                        else:
                            with original.open(entry) as source_file, updated.open(destination, "w") as target:
                                copyfileobj(source_file, target, 1024 * 1024)
                    updated.writestr(member, source.encode("utf-8"))
                tmp.flush()
                os.fsync(tmp.fileno())
        with zipfile.ZipFile(temporary) as updated:
            new_report, _, _ = existing_report(updated, safe_members(updated))
            valid = new_report["output_counts"]["valid"]
            if valid != report["output_counts"]["valid"] + 1 or video not in new_report["output_ids"]["valid"]:
                raise ValueError("intake_verification_failed")
        os.replace(temporary, checkpoint)
        return {"status": "imported", "video_id": video, "valid_captions": valid}
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
        lock.rmdir()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkpoint", type=Path, help="existing private ZIP outside Git")
    parser.add_argument("caption", type=Path, help="authorized local <video_id>.ko.vtt outside Git")
    parser.add_argument("--video-id", required=True)
    parser.add_argument("--authorized", action="store_true", help="confirm permission to use and retain this caption")
    args = parser.parse_args()
    if not args.authorized:
        parser.error("permission confirmation required with --authorized")
    try:
        report = intake(args.checkpoint, args.caption, args.video_id)
    except ValueError as error:
        # Only our fixed error codes may be shown; parser errors can include input.
        code = str(error)
        print(code if code in {
            "input_not_regular_file", "use_paths_outside_git_checkout", "checkpoint_too_large",
            "unsafe_or_duplicate_archive_member", "checkpoint_has_audit_errors", "caption_filename_must_match_video_id",
            "checkpoint_must_be_zip", "checkpoint_locked", "invalid_webvtt", "video_not_in_checkpoint",
            "caption_exceeds_video_duration", "conflicting_existing_caption", "intake_verification_failed",
        } else "invalid_or_unreadable_input", file=sys.stderr)
        return 2
    except (OSError, UnicodeError, csv.Error, zipfile.BadZipFile, RuntimeError, NotImplementedError, StopIteration):
        print("invalid_or_unreadable_input", file=sys.stderr)
        return 2
    print(json.dumps(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
