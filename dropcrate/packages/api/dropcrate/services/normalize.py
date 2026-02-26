"""EBU R128 two-pass loudness normalization via ffmpeg."""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path


def _codec_for_format(fmt: str) -> str:
    return {"aiff": "pcm_s16be", "wav": "pcm_s16le", "flac": "flac", "mp3": "libmp3lame"}.get(
        fmt, "pcm_s16be"
    )


def _ext_for_format(fmt: str) -> str:
    return {"aiff": ".aiff", "wav": ".wav", "flac": ".flac", "mp3": ".mp3"}.get(fmt, ".aiff")


async def _run_ffmpeg(args: list[str]) -> tuple[int, str]:
    """Run ffmpeg and return (return_code, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg",
        *args,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr_bytes = await proc.communicate()
    stderr = stderr_bytes.decode("utf-8", errors="replace")
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}): {stderr[-4000:]}")
    return proc.returncode or 0, stderr


def _extract_last_json(text: str) -> dict:
    """Extract the last JSON object from ffmpeg stderr output."""
    start = text.rfind("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise RuntimeError("Could not parse ffmpeg loudnorm JSON output")
    return json.loads(text[start : end + 1])


async def loudnorm_two_pass(
    input_path: Path,
    output_path: Path,
    audio_format: str,
    target_i: float = -14.0,
    target_tp: float = -1.0,
    target_lra: float = 11.0,
) -> Path:
    """Run two-pass EBU R128 loudness normalization. Returns output path."""
    # Pass 1: Analyze
    _, stderr = await _run_ffmpeg([
        "-y",
        "-i", str(input_path),
        "-vn",
        "-af", f"loudnorm=I={target_i}:TP={target_tp}:LRA={target_lra}:print_format=json",
        "-f", "null",
        "-",
    ])
    analysis = _extract_last_json(stderr)

    # Pass 2: Apply with measured values
    codec = _codec_for_format(audio_format)
    loudnorm_filter = (
        f"loudnorm=I={target_i}:TP={target_tp}:LRA={target_lra}"
        f":measured_I={analysis['input_i']}:measured_TP={analysis['input_tp']}"
        f":measured_LRA={analysis['input_lra']}:measured_thresh={analysis['input_thresh']}"
        f":offset={analysis['target_offset']}:linear=true:print_format=summary"
    )
    await _run_ffmpeg([
        "-y",
        "-i", str(input_path),
        "-vn",
        "-af", loudnorm_filter,
        "-acodec", codec,
        "-ar", "44100",
        str(output_path),
    ])
    return output_path
