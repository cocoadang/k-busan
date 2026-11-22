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

## Intake of one authorized local caption

The intake is offline and does not fetch from YouTube or another provider.
Use this on a private user-controlled computer or workspace with a private
copy of the existing checkpoint ZIP. Do not place either file in a Git checkout,
upload it to CI, or make the raw caption or checkpoint public. Keep a private
backup of the checkpoint.

1. Verify that the original, non-Short video belongs to the publisher listed
   above, that the source filename matches that exact video ID, and that you
   have permission to retain and analyze the Korean caption. Rename the
   verified local WebVTT file to `<video_id>.ko.vtt` if necessary.
2. Process exactly one file, waiting for it to finish before starting another.

```sh
python3 ops/intake_song_caption.py /private/songhee-gu-caption-resume.zip \
  /private/VIDEO_ID_11.ko.vtt --video-id VIDEO_ID_11 --authorized
python3 ops/audit_song_caption_checkpoint.py /private/songhee-gu-caption-resume.zip
```

This checks the existing inventory and archive, validates VTT cues and duration,
and writes a new archive next to the original. The original is replaced only
after validation succeeds. The output contains the video ID and count, not raw
text. A repeated identical caption makes no change; a different caption for an
existing ID is refused. It does not mark analysis complete or update the public
catalog. No batch input or remote URLs are supported. The operator still needs
to verify provenance and video identity outside the tool; a filename and cue
syntax alone cannot prove either.

If an interrupted job leaves a `.intake-lock` directory, first make sure no
intake is running. Then remove the empty lock directory before retrying. Keep any
orphaned `.caption-intake-*.zip` private and discard it only after confirming
the original checkpoint is intact. A provider access or bot-verification error
is not a reason to rerun the hosted collection workflow.
