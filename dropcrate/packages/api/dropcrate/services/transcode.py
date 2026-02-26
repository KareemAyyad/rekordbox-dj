"""Audio format conversion via ffmpeg."""

from __future__ import annotations

import asyncio
from pathlib import Path


def _codec_for_format(fmt: str) -> str:
    return {"aiff": "pcm_s16be", "wav": "pcm_s16le", "flac": "flac", "mp3": "libmp3lame"}.get(
        fmt, "pcm_s16be"
    )


async def transcode(input_path: Path, output_path: Path, audio_format: str) -> Path:
    """Transcode audio to the specified format at 44.1kHz. Returns output path."""
    codec = _codec_for_format(audio_format)
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-y",
        "-i", str(input_path),
        "-vn",
        "-acodec", codec,
        "-ar", "44100",
        str(output_path),
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr_bytes = await proc.communicate()
    if proc.returncode != 0:
        stderr = stderr_bytes.decode("utf-8", errors="replace")
        raise RuntimeError(f"ffmpeg transcode failed ({proc.returncode}): {stderr[-4000:]}")
    return output_path
