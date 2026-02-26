"""Tests for EBU R128 two-pass loudness normalization (mocked ffmpeg)."""

import pytest
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock

from dropcrate.services.normalize import (
    loudnorm_two_pass,
    _codec_for_format,
    _ext_for_format,
    _extract_last_json,
)


# --- Unit tests for helper functions ---

def test_codec_for_aiff():
    assert _codec_for_format("aiff") == "pcm_s16be"


def test_codec_for_wav():
    assert _codec_for_format("wav") == "pcm_s16le"


def test_codec_for_flac():
    assert _codec_for_format("flac") == "flac"


def test_codec_for_mp3():
    assert _codec_for_format("mp3") == "libmp3lame"


def test_codec_for_unknown_defaults_to_pcm_s16be():
    assert _codec_for_format("ogg") == "pcm_s16be"


def test_ext_for_aiff():
    assert _ext_for_format("aiff") == ".aiff"


def test_ext_for_wav():
    assert _ext_for_format("wav") == ".wav"


def test_ext_for_flac():
    assert _ext_for_format("flac") == ".flac"


def test_ext_for_mp3():
    assert _ext_for_format("mp3") == ".mp3"


def test_extract_last_json_valid():
    text = 'lots of ffmpeg output\n{"input_i": "-20.5", "input_tp": "-3.2", "input_lra": "8.1", "input_thresh": "-31.0", "target_offset": "0.5"}\n'
    result = _extract_last_json(text)
    assert result["input_i"] == "-20.5"
    assert result["input_tp"] == "-3.2"
    assert result["input_lra"] == "8.1"
    assert result["input_thresh"] == "-31.0"
    assert result["target_offset"] == "0.5"


def test_extract_last_json_multiple_objects():
    text = '{"first": true}\nmore output\n{"input_i": "-14.0", "input_tp": "-1.0", "input_lra": "11.0", "input_thresh": "-24.0", "target_offset": "0.0"}'
    result = _extract_last_json(text)
    assert result["input_i"] == "-14.0"


def test_extract_last_json_no_json_raises():
    with pytest.raises(RuntimeError, match="parse"):
        _extract_last_json("no json here at all")


def test_extract_last_json_incomplete_raises():
    with pytest.raises(RuntimeError):
        _extract_last_json('{ incomplete')


# --- Integration tests with mocked ffmpeg ---

@pytest.mark.asyncio
async def test_loudnorm_two_pass_calls_ffmpeg_twice():
    """Verify that loudnorm runs two ffmpeg passes."""
    call_count = 0
    pass1_stderr = '{"input_i": "-20.5", "input_tp": "-3.2", "input_lra": "8.1", "input_thresh": "-31.0", "target_offset": "0.5"}'

    async def mock_run_ffmpeg(args):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return 0, pass1_stderr
        return 0, ""

    with patch("dropcrate.services.normalize._run_ffmpeg", side_effect=mock_run_ffmpeg):
        result = await loudnorm_two_pass(
            input_path=Path("/tmp/input.m4a"),
            output_path=Path("/tmp/output.aiff"),
            audio_format="aiff",
            target_i=-14.0,
            target_tp=-1.0,
            target_lra=11.0,
        )

    assert call_count == 2
    assert result == Path("/tmp/output.aiff")


@pytest.mark.asyncio
async def test_loudnorm_pass1_uses_null_output():
    """Pass 1 should analyze only (output to null)."""
    calls = []

    async def mock_run_ffmpeg(args):
        calls.append(args)
        if len(calls) == 1:
            return 0, '{"input_i": "-20", "input_tp": "-3", "input_lra": "8", "input_thresh": "-31", "target_offset": "0.5"}'
        return 0, ""

    with patch("dropcrate.services.normalize._run_ffmpeg", side_effect=mock_run_ffmpeg):
        await loudnorm_two_pass(
            Path("/tmp/in.m4a"), Path("/tmp/out.aiff"), "aiff"
        )

    # Pass 1 args should include "-f null -"
    assert "-f" in calls[0]
    null_idx = calls[0].index("-f")
    assert calls[0][null_idx + 1] == "null"


@pytest.mark.asyncio
async def test_loudnorm_pass2_uses_measured_values():
    """Pass 2 should include measured_I, measured_TP, etc."""
    calls = []

    async def mock_run_ffmpeg(args):
        calls.append(args)
        if len(calls) == 1:
            return 0, '{"input_i": "-20.5", "input_tp": "-3.2", "input_lra": "8.1", "input_thresh": "-31.0", "target_offset": "0.5"}'
        return 0, ""

    with patch("dropcrate.services.normalize._run_ffmpeg", side_effect=mock_run_ffmpeg):
        await loudnorm_two_pass(
            Path("/tmp/in.m4a"), Path("/tmp/out.aiff"), "aiff"
        )

    pass2_args = " ".join(calls[1])
    assert "measured_I=-20.5" in pass2_args
    assert "measured_TP=-3.2" in pass2_args
    assert "measured_LRA=8.1" in pass2_args
    assert "measured_thresh=-31.0" in pass2_args
    assert "linear=true" in pass2_args


@pytest.mark.asyncio
async def test_loudnorm_uses_correct_codec_per_format():
    """Different formats should use different codecs."""
    for fmt, expected_codec in [("aiff", "pcm_s16be"), ("wav", "pcm_s16le"), ("flac", "flac"), ("mp3", "libmp3lame")]:
        calls = []

        async def mock_run_ffmpeg(args):
            calls.append(args)
            if len(calls) == 1:
                return 0, '{"input_i": "-20", "input_tp": "-3", "input_lra": "8", "input_thresh": "-31", "target_offset": "0"}'
            return 0, ""

        with patch("dropcrate.services.normalize._run_ffmpeg", side_effect=mock_run_ffmpeg):
            await loudnorm_two_pass(
                Path("/tmp/in.m4a"), Path(f"/tmp/out.{fmt}"), fmt
            )

        pass2_args = calls[1]
        assert expected_codec in pass2_args, f"Expected {expected_codec} for {fmt}"
