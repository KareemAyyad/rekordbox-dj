"""Tests for audio format transcoding (mocked ffmpeg)."""

import pytest
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock

from dropcrate.services.transcode import transcode, _codec_for_format


# --- Codec selection ---

def test_codec_aiff():
    assert _codec_for_format("aiff") == "pcm_s16be"


def test_codec_wav():
    assert _codec_for_format("wav") == "pcm_s16le"


def test_codec_flac():
    assert _codec_for_format("flac") == "flac"


def test_codec_mp3():
    assert _codec_for_format("mp3") == "libmp3lame"


def test_codec_unknown():
    assert _codec_for_format("xyz") == "pcm_s16be"


# --- Transcode function ---

@pytest.mark.asyncio
async def test_transcode_calls_ffmpeg():
    """Test that transcode runs ffmpeg with correct args."""
    mock_proc = AsyncMock()
    mock_proc.returncode = 0
    mock_proc.communicate = AsyncMock(return_value=(b"", b""))

    with patch("dropcrate.services.transcode.asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        result = await transcode(
            Path("/tmp/input.m4a"),
            Path("/tmp/output.aiff"),
            "aiff"
        )

    assert result == Path("/tmp/output.aiff")
    mock_exec.assert_called_once()
    args = mock_exec.call_args[0]
    assert "ffmpeg" in args
    assert str(Path("/tmp/input.m4a")) in args
    assert str(Path("/tmp/output.aiff")) in args
    assert "pcm_s16be" in args
    assert "44100" in args


@pytest.mark.asyncio
async def test_transcode_raises_on_failure():
    """Test that transcode raises RuntimeError on ffmpeg failure."""
    mock_proc = AsyncMock()
    mock_proc.returncode = 1
    mock_proc.communicate = AsyncMock(return_value=(b"", b"Error: invalid input"))

    with patch("dropcrate.services.transcode.asyncio.create_subprocess_exec", return_value=mock_proc):
        with pytest.raises(RuntimeError, match="transcode failed"):
            await transcode(
                Path("/tmp/input.m4a"),
                Path("/tmp/output.aiff"),
                "aiff"
            )


@pytest.mark.asyncio
async def test_transcode_mp3_uses_libmp3lame():
    mock_proc = AsyncMock()
    mock_proc.returncode = 0
    mock_proc.communicate = AsyncMock(return_value=(b"", b""))

    with patch("dropcrate.services.transcode.asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        await transcode(Path("/tmp/in.m4a"), Path("/tmp/out.mp3"), "mp3")

    args = mock_exec.call_args[0]
    assert "libmp3lame" in args


@pytest.mark.asyncio
async def test_transcode_flac():
    mock_proc = AsyncMock()
    mock_proc.returncode = 0
    mock_proc.communicate = AsyncMock(return_value=(b"", b""))

    with patch("dropcrate.services.transcode.asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        await transcode(Path("/tmp/in.m4a"), Path("/tmp/out.flac"), "flac")

    args = mock_exec.call_args[0]
    assert "flac" in args


@pytest.mark.asyncio
async def test_transcode_uses_44100_sample_rate():
    mock_proc = AsyncMock()
    mock_proc.returncode = 0
    mock_proc.communicate = AsyncMock(return_value=(b"", b""))

    with patch("dropcrate.services.transcode.asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        await transcode(Path("/tmp/in.m4a"), Path("/tmp/out.wav"), "wav")

    args = mock_exec.call_args[0]
    assert "44100" in args
