"""YouTube audio download via yt-dlp subprocess (CLI mode).

Uses subprocess instead of Python API to ensure plugins
(especially bgutil PO token provider) are loaded correctly.
"""

from __future__ import annotations

import asyncio
import glob
import logging
import subprocess
from pathlib import Path

from dropcrate import config

logger = logging.getLogger(__name__)


def _sync_download(url: str, work_dir: Path) -> Path:
    """Download audio using yt-dlp CLI subprocess."""
    work_dir.mkdir(parents=True, exist_ok=True)
    outtmpl = str(work_dir / "%(title)s.%(ext)s")

    # Build base command
    cmd = [
        "yt-dlp",
        "--format", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
        "--format-sort", "abr,acodec:aac:opus:mp3",
        "--output", outtmpl,
        "--no-playlist",
        "--socket-timeout", "30",
        "--retries", "3",
        "--extractor-args", "youtube:player_client=ios,android,tv",
        "--remote-components", "ejs:github",
    ]

    # Add cookies if available
    cookies_file = config.get_cookies_file()
    if cookies_file:
        cmd.extend(["--cookies", cookies_file])
        logger.info(f"[yt-dlp download] Using cookies from: {cookies_file}")

    cmd.append(url)

    logger.info(f"[yt-dlp download] Downloading: {url}")

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=300,
    )

    if result.returncode == 0:
        # Find the downloaded file (most recently modified)
        downloaded = _find_most_recent(work_dir)
        if downloaded:
            logger.info(f"[yt-dlp download] Success: {downloaded.name}")
            return downloaded
        raise RuntimeError("yt-dlp succeeded but no output file found")

    stderr = result.stderr.strip() if result.stderr else "no stderr"
    logger.warning(f"[yt-dlp download] Failed (exit {result.returncode}): {stderr[:500]}")

    # Retry with relaxed format
    logger.info("[yt-dlp download] Retrying with relaxed format...")
    cmd_retry = [
        "yt-dlp",
        "--format", "bestaudio/best",
        "--output", outtmpl,
        "--no-playlist",
        "--socket-timeout", "30",
        "--retries", "3",
        "--extractor-args", "youtube:player_client=ios,android,tv",
        "--remote-components", "ejs:github",
        "--verbose",
    ]
    if cookies_file:
        cmd_retry.extend(["--cookies", cookies_file])
    cmd_retry.append(url)

    result2 = subprocess.run(
        cmd_retry,
        capture_output=True,
        text=True,
        timeout=300,
    )

    if result2.returncode == 0:
        downloaded = _find_most_recent(work_dir)
        if downloaded:
            logger.info(f"[yt-dlp download] Retry success: {downloaded.name}")
            return downloaded

    stderr2 = result2.stderr.strip() if result2.stderr else "no stderr"
    raise RuntimeError(f"yt-dlp download failed after retry: {stderr2[:500]}")


def _find_most_recent(directory: Path) -> Path | None:
    """Find the most recently modified file in a directory."""
    files = [
        f for f in directory.iterdir()
        if f.is_file() and f.suffix in ('.m4a', '.webm', '.mp3', '.ogg', '.opus', '.wav', '.aac', '.flac')
    ]
    if not files:
        return None
    return max(files, key=lambda f: f.stat().st_mtime)


async def download_audio(url: str, work_dir: Path) -> Path:
    """Download best quality audio from YouTube. Returns path to downloaded file."""
    loop = asyncio.get_event_loop()
    return await asyncio.wait_for(
        loop.run_in_executor(None, _sync_download, url, work_dir),
        timeout=360,
    )
