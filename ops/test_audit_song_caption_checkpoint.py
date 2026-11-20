import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
import warnings
import zipfile

from audit_song_caption_checkpoint import audit, vtt_check

HERE = Path(__file__).resolve().parent
VIDEO = [f"video{i:06}" for i in range(12)]
GOOD = (
    "WEBVTT\nKind: captions\nLanguage: ko\n\n"
    "00:00:00.000 --> 00:00:02.300 align:start position:0%\n"
    " \n가나다<00:00:01.207><c> 라마</c>\n\n"
    "cue-id\n00:00:01.100 --> 00:00:03.000\nsynthetic cue, never printed\n\n"
    "00:03.001 --> 00:03.200\n \n"
)

class AuditTest(unittest.TestCase):
    def setUp(self):
        base = TemporaryDirectory()
        self.addCleanup(base.cleanup)
        self.path = Path(base.name)

    def checkpoint(self, statuses):
        path = self.path / "checkpoint"
        (path / "captions").mkdir(parents=True)
        with (path / "video_inventory.csv").open("w", encoding="utf-8-sig") as stream:
            print("영상 ID,제목,길이(초),영상 링크,한국어 자막 상태", file=stream)
            for i, status in enumerate(statuses):
                print(f"{VIDEO[i]},title,10,https://www.youtube.com/watch?v={VIDEO[i]},{status}", file=stream)
        return path

    def caption(self, checkpoint, video, source=GOOD):
        (checkpoint / "captions" / f"{video}.ko.vtt").write_text(source, encoding="utf-8")

    def test_status_coverage_zip_and_directory(self):
        path = self.checkpoint(("수집 완료", "대기", "조회 오류", "자막 없음", "new status"))
        self.caption(path, VIDEO[0])
        catalog = self.path / "catalog.json"
        catalog.write_text(json.dumps({"audit": {"reviewedVideoIds": [VIDEO[2], VIDEO[11]]}}))
        got = audit(path, catalog)
        self.assertEqual(got["inventory_status_counts"],
                         {"complete": 1, "pending": 1, "failed": 1, "absent": 1, "unknown": 1})
        self.assertEqual(got["output_counts"], {"missing": 4, "valid": 1, "invalid": 0})
        self.assertEqual(got["valid_caption_coverage_percent"], 20.0)
        self.assertEqual(got["video_issues"], {VIDEO[4]: ["unknown_inventory_status"]})
        self.assertEqual(got["catalog"], {"reviewed_count": 2,
                                         "reviewed_outside_inventory_ids": [VIDEO[11]],
                                         "reviewed_in_inventory_without_valid_caption_ids": [VIDEO[2]],
                                         "valid_caption_not_reviewed_ids": [VIDEO[0]]})
        packed = self.path / "checkpoint.zip"
        with zipfile.ZipFile(packed, "w") as archive:
            for member in path.rglob("*"):
                if member.is_file():
                    archive.write(member, "prefix/" + member.relative_to(path).as_posix())
        self.assertEqual(got, audit(packed, catalog))

    def test_invalid_orphans_and_status_mismatch(self):
        path = self.checkpoint(("complete", "pending", "complete"))
        self.caption(path, VIDEO[0], "WEBVTT\n\n00:03.000 --> 00:02.000\ninvalid")
        self.caption(path, VIDEO[1])
        self.caption(path, VIDEO[11])
        self.caption(path, "invalid")
        got = audit(path)
        self.assertEqual(got["orphan_caption_ids"], [VIDEO[11]])
        self.assertEqual(got["malformed_caption_member_count"], 1)
        self.assertEqual(got["output_counts"], {"missing": 1, "valid": 1, "invalid": 1})
        self.assertIn("nonpositive_cue_duration", got["video_issues"][VIDEO[0]])
        self.assertIn("caption_present_without_complete_status", got["video_issues"][VIDEO[1]])
        self.assertIn("complete_without_valid_caption", got["video_issues"][VIDEO[2]])

    def test_duplicate_archive_and_inventory_url(self):
        packed = self.path / "checkpoint.zip"
        name = f"captions/{VIDEO[0]}.ko.vtt"
        with zipfile.ZipFile(packed, "w") as archive:
            archive.writestr("video_inventory.csv", f"video_id,status,url\n"
                             f"{VIDEO[0]},completed,https://youtu.be/{VIDEO[1]}\n"
                             f"{VIDEO[0]},completed,\n")
            archive.writestr(name, GOOD)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                archive.writestr(name, GOOD)
        got = audit(packed)
        self.assertEqual(got["duplicate_caption_ids"], [VIDEO[0]])
        self.assertEqual([item["issue"] for item in got["inventory_issues"]],
                         ["video_url_id_mismatch", "duplicate_inventory_id"])

    def test_timing(self):
        self.assertEqual(vtt_check(GOOD), (2, 3200, []))
        self.assertEqual(vtt_check(GOOD.replace("\n", "\r\n")), (2, 3200, []))
        self.assertIn("invalid_webvtt_header", vtt_check("an HTML error page")[2])
        self.assertIn("no_nonempty_timed_cues", vtt_check("WEBVTT\n\n00:01.000 --> 00:02.000\n ")[2])
        self.assertIn("invalid_cue_timing", vtt_check(GOOD.replace("00:03.200", "00:99.200"))[2])
        self.assertIn("nonmonotonic_cue_start", vtt_check(GOOD.replace("00:03.001", "00:01.000"))[2])

    def test_cli_output_and_exit_code(self):
        path = self.checkpoint(("수집 완료", "pending"))
        self.caption(path, VIDEO[0])
        run = subprocess.run([sys.executable, str(HERE / "audit_song_caption_checkpoint.py"), str(path)],
                             capture_output=True, text=True)
        self.assertEqual(run.returncode, 0)
        self.assertIn("valid_caption_coverage_percent", run.stdout)
        self.assertNotIn("never printed", run.stdout)
        (path / "captions" / f"{VIDEO[0]}.ko.vtt").unlink()
        bad = subprocess.run([sys.executable, str(HERE / "audit_song_caption_checkpoint.py"), str(path)],
                             capture_output=True, text=True)
        self.assertEqual(bad.returncode, 1)
        self.assertEqual(json.loads(bad.stdout)["output_counts"]["missing"], 2)

if __name__ == "__main__":
    unittest.main()
