"""
REAL integration tests — these hit YouTube, run ffmpeg, and verify actual output.

Run these on a machine with:
  - Internet access (YouTube reachable)
  - ffmpeg installed
  - yt-dlp installed (pip install yt-dlp)

Usage:
    cd packages/api
    python -m pytest tests/test_real_integration.py -v -s --timeout=120

Skip with:
    python -m pytest tests/test_real_integration.py -v -s -k "not real"
"""

import asyncio
import json
import os
import subprocess
import pytest
from pathlib import Path

# Skip all tests if no internet or ffmpeg
def _has_internet():
    try:
        import urllib.request
        urllib.request.urlopen("https://www.youtube.com", timeout=5)
        return True
    except Exception:
        return False

def _has_ffmpeg():
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except Exception:
        return False

skip_no_internet = pytest.mark.skipif(not _has_internet(), reason="No internet access to YouTube")
skip_no_ffmpeg = pytest.mark.skipif(not _has_ffmpeg(), reason="ffmpeg not installed")

# Short, royalty-free test video (< 30 seconds)
# "Big Buck Bunny" trailer clip — public domain, always available
TEST_URL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ"  # Big Buck Bunny (short)
TEST_URL_MUSIC = "https://www.youtube.com/watch?v=jNQXAC9IVRw"  # "Me at the zoo" — first YouTube video


# ─── METADATA TESTS ──────────────────────────────────────────────────────────

@skip_no_internet
@pytest.mark.asyncio
async def test_real_fetch_video_info():
    """Fetch real metadata from YouTube and verify all expected fields."""
    from dropcrate.services.metadata import fetch_video_info

    info = await fetch_video_info(TEST_URL)

    # Must have these fields
    assert "id" in info, "Missing 'id' in video info"
    assert "title" in info, "Missing 'title' in video info"
    assert "duration" in info, "Missing 'duration' in video info"
    assert "webpage_url" in info, "Missing 'webpage_url' in video info"

    # Verify types
    assert isinstance(info["id"], str), f"id should be str, got {type(info['id'])}"
    assert isinstance(info["title"], str), f"title should be str, got {type(info['title'])}"
    assert isinstance(info["duration"], (int, float)), f"duration should be numeric, got {type(info['duration'])}"

    # Should have thumbnails
    assert "thumbnails" in info or "thumbnail" in info, "Missing thumbnail info"

    print(f"\n  Video ID: {info['id']}")
    print(f"  Title: {info['title']}")
    print(f"  Duration: {info['duration']}s")
    print(f"  Uploader: {info.get('uploader', 'N/A')}")
    print(f"  Categories: {info.get('categories', [])}")
    print(f"  Tags: {info.get('tags', [])[:5]}")
    thumbs = info.get("thumbnails", [])
    print(f"  Thumbnails: {len(thumbs)} available")


@skip_no_internet
@pytest.mark.asyncio
async def test_real_fetch_music_video_info():
    """Fetch metadata for a real video and verify uploader/category fields."""
    from dropcrate.services.metadata import fetch_video_info

    info = await fetch_video_info(TEST_URL_MUSIC)

    assert info["id"] == "jNQXAC9IVRw"
    assert len(info["title"]) > 0
    assert info["duration"] > 0
    print(f"\n  Title: {info['title']}")
    print(f"  Uploader: {info.get('uploader', 'N/A')}")


# ─── TITLE PARSER TESTS (with real YouTube titles) ───────────────────────────

@skip_no_internet
@pytest.mark.asyncio
async def test_real_title_parsing():
    """Fetch real video info and run the title parser on actual YouTube titles."""
    from dropcrate.services.metadata import fetch_video_info
    from dropcrate.services.title_parser import parse_title

    info = await fetch_video_info(TEST_URL)
    result = parse_title(info["title"], info.get("uploader"))

    assert "artist" in result
    assert "title" in result
    assert len(result["artist"]) > 0 or len(result["title"]) > 0

    print(f"\n  Raw title: {info['title']}")
    print(f"  Parsed artist: {result['artist']}")
    print(f"  Parsed title: {result['title']}")
    print(f"  Version: {result.get('version', '')}")


# ─── HEURISTIC CLASSIFICATION (with real data) ──────────────────────────────

@skip_no_internet
@pytest.mark.asyncio
async def test_real_heuristic_classify():
    """Fetch real video info and run heuristic classification."""
    from dropcrate.services.metadata import fetch_video_info
    from dropcrate.services.classify_heuristic import classify_heuristic

    info = await fetch_video_info(TEST_URL)
    result = classify_heuristic(info)

    assert "kind" in result
    assert "genre" in result
    assert "confidence" in result
    assert result["kind"] in ("track", "set", "tutorial", "podcast", "unknown")
    assert isinstance(result["confidence"], (int, float))
    assert 0 <= result["confidence"] <= 1

    print(f"\n  Kind: {result['kind']}")
    print(f"  Genre: {result['genre']}")
    print(f"  Energy: {result.get('energy', '')}")
    print(f"  Time: {result.get('time', '')}")
    print(f"  Vibe: {result.get('vibe', '')}")
    print(f"  Confidence: {result['confidence']}")
    print(f"  Notes: {result.get('notes', '')}")


# ─── DOWNLOAD TESTS ─────────────────────────────────────────────────────────

@skip_no_internet
@pytest.mark.asyncio
async def test_real_download_audio(tmp_path):
    """Actually download audio from YouTube and verify the file exists."""
    from dropcrate.services.metadata import fetch_video_info
    from dropcrate.services.download import download_audio

    info = await fetch_video_info(TEST_URL)
    audio_path = await download_audio(info, tmp_path)

    assert audio_path is not None, "download_audio returned None"
    assert audio_path.exists(), f"Downloaded file does not exist: {audio_path}"
    assert audio_path.stat().st_size > 0, f"Downloaded file is empty: {audio_path}"

    print(f"\n  Downloaded: {audio_path}")
    print(f"  Size: {audio_path.stat().st_size / 1024:.1f} KB")
    print(f"  Extension: {audio_path.suffix}")


# ─── NORMALIZE TESTS ────────────────────────────────────────────────────────

@skip_no_internet
@skip_no_ffmpeg
@pytest.mark.asyncio
async def test_real_normalize_audio(tmp_path):
    """Download audio, then run real EBU R128 normalization with ffmpeg."""
    from dropcrate.services.metadata import fetch_video_info
    from dropcrate.services.download import download_audio
    from dropcrate.services.normalize import loudnorm_two_pass

    info = await fetch_video_info(TEST_URL)
    audio_path = await download_audio(info, tmp_path)

    normalized = await loudnorm_two_pass(
        input_path=audio_path,
        work_dir=tmp_path,
        target_i=-14.0,
        target_tp=-1.0,
        target_lra=11.0,
        audio_format="aiff",
    )

    assert normalized.exists(), f"Normalized file does not exist: {normalized}"
    assert normalized.stat().st_size > 0, f"Normalized file is empty"
    assert normalized.suffix in (".aiff", ".wav", ".flac", ".mp3")

    print(f"\n  Input: {audio_path} ({audio_path.stat().st_size / 1024:.1f} KB)")
    print(f"  Output: {normalized} ({normalized.stat().st_size / 1024:.1f} KB)")


# ─── TRANSCODE TESTS ────────────────────────────────────────────────────────

@skip_no_internet
@skip_no_ffmpeg
@pytest.mark.asyncio
async def test_real_transcode_to_aiff(tmp_path):
    """Download audio and transcode to AIFF format."""
    from dropcrate.services.metadata import fetch_video_info
    from dropcrate.services.download import download_audio
    from dropcrate.services.transcode import transcode

    info = await fetch_video_info(TEST_URL)
    audio_path = await download_audio(info, tmp_path)

    transcoded = await transcode(
        input_path=audio_path,
        work_dir=tmp_path,
        audio_format="aiff",
    )

    assert transcoded.exists(), f"Transcoded file does not exist: {transcoded}"
    assert transcoded.stat().st_size > 0
    assert transcoded.suffix == ".aiff"

    print(f"\n  Input: {audio_path.suffix} ({audio_path.stat().st_size / 1024:.1f} KB)")
    print(f"  Output: {transcoded.suffix} ({transcoded.stat().st_size / 1024:.1f} KB)")


@skip_no_internet
@skip_no_ffmpeg
@pytest.mark.asyncio
async def test_real_transcode_to_mp3(tmp_path):
    """Download audio and transcode to MP3 format."""
    from dropcrate.services.metadata import fetch_video_info
    from dropcrate.services.download import download_audio
    from dropcrate.services.transcode import transcode

    info = await fetch_video_info(TEST_URL)
    audio_path = await download_audio(info, tmp_path)

    transcoded = await transcode(
        input_path=audio_path,
        work_dir=tmp_path,
        audio_format="mp3",
    )

    assert transcoded.exists()
    assert transcoded.suffix == ".mp3"
    print(f"\n  Output: {transcoded} ({transcoded.stat().st_size / 1024:.1f} KB)")


@skip_no_internet
@skip_no_ffmpeg
@pytest.mark.asyncio
async def test_real_transcode_to_flac(tmp_path):
    """Download audio and transcode to FLAC format."""
    from dropcrate.services.metadata import fetch_video_info
    from dropcrate.services.download import download_audio
    from dropcrate.services.transcode import transcode

    info = await fetch_video_info(TEST_URL)
    audio_path = await download_audio(info, tmp_path)

    transcoded = await transcode(
        input_path=audio_path,
        work_dir=tmp_path,
        audio_format="flac",
    )

    assert transcoded.exists()
    assert transcoded.suffix == ".flac"
    print(f"\n  Output: {transcoded} ({transcoded.stat().st_size / 1024:.1f} KB)")


# ─── TAGGER TESTS ───────────────────────────────────────────────────────────

@skip_no_internet
@skip_no_ffmpeg
@pytest.mark.asyncio
async def test_real_tag_and_verify(tmp_path):
    """Download, transcode, tag, then verify tags are embedded in the file."""
    from dropcrate.services.metadata import fetch_video_info
    from dropcrate.services.download import download_audio
    from dropcrate.services.transcode import transcode
    from dropcrate.services.tagger import apply_tags_and_artwork, build_tags

    info = await fetch_video_info(TEST_URL)
    audio_path = await download_audio(info, tmp_path)
    transcoded = await transcode(audio_path, tmp_path, "aiff")

    tags = build_tags(
        artist="Test Artist",
        title="Test Title",
        genre="Melodic Techno",
        energy="3/5",
        time="Peak",
        vibe="Euphoric",
        source_url=TEST_URL,
    )

    await apply_tags_and_artwork(
        audio_path=transcoded,
        tags=tags,
        video_info=info,
        work_dir=tmp_path,
    )

    # Verify tags were written by reading them back with ffprobe
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(transcoded)],
        capture_output=True, text=True,
    )
    probe_data = json.loads(result.stdout)
    file_tags = probe_data.get("format", {}).get("tags", {})

    print(f"\n  Tagged file: {transcoded}")
    print(f"  File tags: {json.dumps(file_tags, indent=2)}")

    # ffmpeg tag keys are case-insensitive, normalize to lowercase
    lower_tags = {k.lower(): v for k, v in file_tags.items()}
    assert lower_tags.get("artist") == "Test Artist" or lower_tags.get("artist", "").startswith("Test"), \
        f"Artist tag mismatch: {lower_tags.get('artist')}"
    assert lower_tags.get("title") == "Test Title" or lower_tags.get("title", "").startswith("Test"), \
        f"Title tag mismatch: {lower_tags.get('title')}"
    assert "genre" in lower_tags, "Genre tag not found in file"


# ─── NAMING TESTS (with real data) ──────────────────────────────────────────

@skip_no_internet
@pytest.mark.asyncio
async def test_real_filename_generation():
    """Fetch real video info, parse title, and generate Rekordbox-safe filename."""
    from dropcrate.services.metadata import fetch_video_info
    from dropcrate.services.title_parser import parse_title
    from dropcrate.services.naming import make_filename

    info = await fetch_video_info(TEST_URL)
    parsed = parse_title(info["title"], info.get("uploader"))

    filename = make_filename(
        artist=parsed["artist"],
        title=parsed["title"],
        audio_format="aiff",
    )

    assert len(filename) > 0
    assert filename.endswith(".aiff")
    # No prohibited characters
    for ch in ['/', '\\', ':', '*', '?', '"', '<', '>', '|']:
        assert ch not in filename, f"Prohibited character '{ch}' in filename: {filename}"

    print(f"\n  Raw title: {info['title']}")
    print(f"  Generated filename: {filename}")


# ─── FULL PIPELINE INTEGRATION TEST ─────────────────────────────────────────

@skip_no_internet
@skip_no_ffmpeg
@pytest.mark.asyncio
async def test_real_full_pipeline_flow(tmp_path):
    """
    End-to-end test: fetch metadata → parse title → classify → download
    → transcode → tag → verify output file.

    This is the complete pipeline that a user would trigger.
    """
    from dropcrate.services.metadata import fetch_video_info
    from dropcrate.services.title_parser import parse_title
    from dropcrate.services.classify_heuristic import classify_heuristic
    from dropcrate.services.download import download_audio
    from dropcrate.services.transcode import transcode
    from dropcrate.services.tagger import apply_tags_and_artwork, build_tags
    from dropcrate.services.naming import make_filename

    print("\n  === FULL PIPELINE TEST ===")

    # Stage 1: Metadata
    print("  [1/6] Fetching metadata...")
    info = await fetch_video_info(TEST_URL)
    assert info["id"], "No video ID"
    print(f"        Title: {info['title']}")

    # Stage 2: Parse title
    print("  [2/6] Parsing title...")
    parsed = parse_title(info["title"], info.get("uploader"))
    print(f"        Artist: {parsed['artist']}")
    print(f"        Title: {parsed['title']}")

    # Stage 3: Classify
    print("  [3/6] Classifying...")
    classification = classify_heuristic(info)
    print(f"        Kind: {classification['kind']}, Genre: {classification['genre']}")

    # Stage 4: Download
    print("  [4/6] Downloading audio...")
    audio_path = await download_audio(info, tmp_path)
    assert audio_path.exists()
    print(f"        File: {audio_path.name} ({audio_path.stat().st_size / 1024:.1f} KB)")

    # Stage 5: Transcode
    print("  [5/6] Transcoding to AIFF...")
    transcoded = await transcode(audio_path, tmp_path, "aiff")
    assert transcoded.exists()
    print(f"        File: {transcoded.name} ({transcoded.stat().st_size / 1024:.1f} KB)")

    # Stage 6: Tag
    print("  [6/6] Applying tags...")
    tags = build_tags(
        artist=parsed["artist"],
        title=parsed["title"],
        genre=classification["genre"],
        energy=classification.get("energy", ""),
        time=classification.get("time", ""),
        vibe=classification.get("vibe", ""),
        source_url=info.get("webpage_url", ""),
    )
    await apply_tags_and_artwork(transcoded, tags, info, tmp_path)

    # Generate final filename
    final_name = make_filename(parsed["artist"], parsed["title"], "aiff")
    final_path = tmp_path / "inbox" / final_name
    final_path.parent.mkdir(parents=True, exist_ok=True)

    import shutil
    shutil.move(str(transcoded), str(final_path))

    assert final_path.exists(), f"Final file missing: {final_path}"
    assert final_path.stat().st_size > 10_000, f"Final file too small: {final_path.stat().st_size}"

    # Verify tags with ffprobe
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(final_path)],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        probe = json.loads(result.stdout)
        file_tags = probe.get("format", {}).get("tags", {})
        lower_tags = {k.lower(): v for k, v in file_tags.items()}
        print(f"        Embedded artist: {lower_tags.get('artist', 'N/A')}")
        print(f"        Embedded title: {lower_tags.get('title', 'N/A')}")
        print(f"        Embedded genre: {lower_tags.get('genre', 'N/A')}")

    print(f"\n  === PIPELINE COMPLETE ===")
    print(f"  Final file: {final_path}")
    print(f"  Size: {final_path.stat().st_size / 1024:.1f} KB")
    print(f"  Ready for Rekordbox import!")
