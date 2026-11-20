# Offline caption checkpoint audit

Run with Python 3.8+; no packages, network access, or extraction required.

```sh
python3 ops/audit_song_caption_checkpoint.py /path/to/songhee-gu-caption-resume.zip
python3 ops/audit_song_caption_checkpoint.py /path/to/unpacked-checkpoint --catalog /path/to/catalog.json
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s ops -p 'test_audit_song_caption_checkpoint.py' -v
```

Requires one `video_inventory.csv` and optionally matching
`captions/<video ID>.ko.vtt` siblings. Supports UTF-8 BOM and Korean/English
inventory column aliases. Outputs JSON with counts, video IDs and problem
codes, never caption text or titles. Captions require WebVTT syntax, valid
ordered starts, positive durations, and at least one nonblank timed cue.
Overlapping/blank spacer cues in YouTube automatic captions are allowed.
End times extending >2 seconds beyond inventory duration are advisory.

Missing captions are independent of inventory status: pending, retrieval
failure and explicitly absent cannot be substituted for each other. The
optional catalog comparison does not assume that reviewed videos were reviewed
from this checkpoint or that missing-caption videos lack captions on YouTube.
Coverage means usable artifacts per unique valid inventory ID, not verification
of channel completeness, transcription accuracy, or text covering the entire video.

Exit code 0 means no detected checkpoint inconsistencies, even if coverage is
partial. 1 means inconsistencies; JSON is still printed. 2 means the input
could not be read or had an invalid required schema.

## Collection boundary

The intended publisher is @thewriter-song (`UCrxr7eBgbKdz0e1t5ax9kCg`). Shorts are outside scope. The legacy hosted backfill can save partial artifacts even when provider access stops; a green run is not coverage. Do not rerun it to circumvent provider restrictions. Use only captions obtained through a permitted source, and retain original caption files and checkpoint data outside Git. Only publish short independently written summaries, dates where relevant, and timestamped video references after complex identity and sales-feed name are checked. Do not mix presale rights with existing-unit sales.
