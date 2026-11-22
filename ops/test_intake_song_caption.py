import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import zipfile

from audit_song_caption_checkpoint import audit
from intake_song_caption import intake


SCRIPT = Path(__file__).resolve().with_name("intake_song_caption.py")
IDS = ["testid00001", "testid00002", "testid00003", "testid00004"]
VTT = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nsynthetic-only private cue\n"


class IntakeTest(unittest.TestCase):
    def setUp(self):
        base = TemporaryDirectory(dir=os.environ.get("RUNNER_TEMP") or ("/tmp" if os.name == "posix" else None))
        self.addCleanup(base.cleanup)
        self.path = Path(base.name)
        self.archive = self.path / "checkpoint.zip"
        self.source = self.path / f"{IDS[1]}.ko.vtt"
        self.source.write_text(VTT, encoding="utf-8")
        with zipfile.ZipFile(self.archive, "w") as target:
            target.writestr("v4/video_inventory.csv", "video_id,duration,status\n" + "".join(
                f"{video},4,{status}\n" for video, status in zip(IDS, ["complete", "failed", "pending", "absent"])))
            target.writestr(f"v4/captions/{IDS[0]}.ko.vtt", VTT)
            target.writestr("v4/private-note.txt", "synthetic unrelated case")

    def cli(self, authorized=True):
        return subprocess.run([sys.executable, str(SCRIPT), str(self.archive), str(self.source),
                               "--video-id", IDS[1], *(["--authorized"] if authorized else [])],
                              capture_output=True, text=True, check=False)

    def test_import_then_audit_and_idempotence(self):
        run = self.cli()
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(json.loads(run.stdout), {"status": "imported", "video_id": IDS[1], "valid_captions": 2})
        self.assertNotIn("private cue", run.stdout + run.stderr)
        report = audit(self.archive)
        self.assertEqual(report["inventory_status_counts"],
                         {"complete": 2, "failed": 0, "pending": 1, "absent": 1, "unknown": 0})
        with zipfile.ZipFile(self.archive) as checked:
            self.assertEqual(checked.read(f"v4/captions/{IDS[0]}.ko.vtt").decode(), VTT)
            self.assertEqual(checked.read("v4/private-note.txt").decode(), "synthetic unrelated case")
        updated = self.archive.read_bytes()
        duplicate = self.cli()
        self.assertEqual(json.loads(duplicate.stdout)["status"], "already_imported")
        self.assertEqual(self.archive.read_bytes(), updated)
        self.source.write_text(VTT.replace("synthetic-only", "different"), encoding="utf-8")
        self.assertIn("conflicting_existing_caption", self.cli().stderr)
        self.assertEqual(self.archive.read_bytes(), updated)

    def test_permission_malformed_duration_and_mismatch_do_not_write(self):
        original = self.archive.read_bytes()
        self.assertEqual(self.cli(False).returncode, 2)
        self.source.write_text("not a known format", encoding="utf-8")
        self.assertIn("invalid_webvtt", self.cli().stderr)
        self.source.write_text(VTT.replace("00:00:02", "00:00:09"), encoding="utf-8")
        self.assertIn("caption_exceeds_video_duration", self.cli().stderr)
        with self.assertRaisesRegex(ValueError, "caption_filename_must_match_video_id"):
            intake(self.archive, self.source, IDS[0])
        self.assertEqual(self.archive.read_bytes(), original)

    def test_lock_refusal_and_failed_replace_preserve_original(self):
        original = self.archive.read_bytes()
        lock = self.path / (self.archive.name + ".intake-lock")
        lock.mkdir()
        self.assertIn("checkpoint_locked", self.cli().stderr)
        lock.rmdir()
        with patch("intake_song_caption.os.replace", side_effect=OSError("private error")):
            with self.assertRaises(OSError):
                intake(self.archive, self.source, IDS[1])
        self.assertFalse(lock.exists())
        self.assertFalse(list(self.path.glob(".caption-intake-*.zip")))
        self.assertEqual(self.archive.read_bytes(), original)

    def test_refuse_git_and_unsafe_archives(self):
        original = self.archive.read_bytes()
        marker = self.path / ".git"
        marker.mkdir()
        (marker / "HEAD").write_text("ref: refs/heads/main", encoding="utf-8")
        self.assertIn("use_paths_outside_git_checkout", self.cli().stderr)
        self.assertEqual(self.archive.read_bytes(), original)
        (marker / "HEAD").unlink()
        marker.rmdir()
        with zipfile.ZipFile(self.archive, "a") as archive:
            archive.writestr("../unsafe.txt", "synthetic")
        unsafe = self.archive.read_bytes()
        self.assertIn("unsafe_or_duplicate_archive_member", self.cli().stderr)
        self.assertEqual(self.archive.read_bytes(), unsafe)


if __name__ == "__main__":
    unittest.main()
