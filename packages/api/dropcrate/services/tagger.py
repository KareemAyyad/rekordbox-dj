"""ID3/Vorbis metadata tagging and artwork embedding via ffmpeg.

Port of applyTagsAndArtwork() from downloadOne.ts.
"""

from __future__ import annotations

import asyncio
import shutil
from pathlib import Path

import httpx


async def download_thumbnail(url: str, dest: Path) -> Path | None:
    """Download a thumbnail image. Returns path or None on failure."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            return dest
    except Exception:
        return None


def pick_best_thumbnail_url(info: dict) -> str | None:
    """Pick the best available thumbnail URL from yt-dlp info."""
    thumbnails = info.get("thumbnails") or []
    scored = []
    for t in thumbnails:
        url = t.get("url")
        if not url:
            continue
        score = (t.get("width") or 0) * (t.get("height") or 0) + (t.get("preference") or 0)
        scored.append((score, url))
    scored.sort(key=lambda x: x[0], reverse=True)
    if scored:
        return scored[0][1]
    return info.get("thumbnail")


def _build_tags(
    artist: str,
    title: str,
    genre: str,
    energy: str = "",
    time_slot: str = "",
    vibe: str = "",
    album: str | None = None,
    year: str | None = None,
    label: str | None = None,
    source_url: str = "",
    source_id: str = "",
    bpm: int | None = None,
    key: str | None = None,
) -> dict[str, str]:
    """Build tag dict matching the current TypeScript implementation."""
    comment_parts: list[str] = []
    if energy.strip():
        comment_parts.append(f"ENERGY: {energy.strip()}")
    if time_slot.strip():
        comment_parts.append(f"TIME: {time_slot.strip()}")
    if vibe.strip():
        comment_parts.append(f"VIBE: {vibe.strip()}")
    comment_parts.append(f"SOURCE: YouTube")
    comment_parts.append(f"URL: {source_url}")
    comment_parts.append(f"YOUTUBE_ID: {source_id}")

    tags: dict[str, str] = {
        "artist": artist,
        "title": title,
        "genre": genre,
        "comment": " | ".join(comment_parts),
    }
    # Grouping tag — rekordbox displays this in its Grouping column
    if time_slot.strip():
        tags["grouping"] = time_slot.strip()
    if album and album.strip():
        tags["album"] = album.strip()
    if year and year.strip():
        tags["date"] = year.strip()
    if label and label.strip():
        tags["publisher"] = label.strip()
    if bpm:
        tags["bpm"] = str(bpm)
    # ffmpeg standard metadata map for Key is TBPM for bpm and grouping or comment for key usually. We will embed it into initialkey if possible, though 'initialkey' is commonly used by ffmpeg for TKEY.
    if key:
        tags["initialkey"] = key
    return tags


async def _run_ffmpeg(args: list[str]) -> None:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg",
        *args,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr_bytes = await proc.communicate()
    if proc.returncode != 0:
        stderr = stderr_bytes.decode("utf-8", errors="replace")
        raise RuntimeError(f"ffmpeg tagging failed ({proc.returncode}): {stderr[-4000:]}")


async def apply_tags_and_artwork(
    media_path: Path,
    ext: str,
    tags: dict[str, str],
    artwork_path: Path | None = None,
) -> None:
    """Apply ID3/Vorbis metadata tags and optional artwork to an audio file."""
    tmp = media_path.with_suffix(f".tagged.tmp{ext}")
    try:
        meta_args_global = []
        meta_args_audio = []
        for k, v in tags.items():
            meta_args_global.extend(["-metadata", f"{k}={v}"])
            meta_args_audio.extend(["-metadata:s:a:0", f"{k}={v}"])

        if not artwork_path:
            # No artwork — just remux with tags
            if ext == ".mp3":
                args = ["-y", "-i", str(media_path), *meta_args_global, *meta_args_audio,
                        "-c", "copy", "-id3v2_version", "3", str(tmp)]
            elif ext == ".flac":
                args = ["-y", "-i", str(media_path), *meta_args_global, *meta_args_audio,
                        "-c", "copy", str(tmp)]
            elif ext in (".aiff", ".wav"):
                args = ["-y", "-i", str(media_path), *meta_args_global, *meta_args_audio,
                        "-c", "copy", "-write_id3v2", "1", str(tmp)]
            else:
                args = ["-y", "-i", str(media_path), *meta_args_global, *meta_args_audio,
                        "-c", "copy", str(tmp)]
        else:
            # Artwork + metadata
            base_args = [
                "-y", "-i", str(media_path), "-i", str(artwork_path),
                *meta_args_global, *meta_args_audio,
                "-map", "0:a:0", "-map", "1:v:0",
                "-c:a", "copy", "-c:v", "mjpeg",
                "-disposition:v:0", "attached_pic",
                "-metadata:s:v:0", "title=Album cover",
                "-metadata:s:v:0", "comment=Cover (front)",
            ]
            if ext == ".mp3":
                args = [*base_args, "-id3v2_version", "3", str(tmp)]
            elif ext in (".aiff", ".wav"):
                args = [*base_args, "-write_id3v2", "1", str(tmp)]
            else:
                args = [*base_args, str(tmp)]

        await _run_ffmpeg(args)
        shutil.move(str(tmp), str(media_path))
    finally:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
