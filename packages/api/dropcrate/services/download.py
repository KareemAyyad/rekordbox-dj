"""YouTube audio download via yt-dlp (native Python library)."""

from __future__ import annotations

import asyncio
import functools
import logging
from pathlib import Path

import yt_dlp

from dropcrate import config

logger = logging.getLogger(__name__)


def _sync_download(url: str, work_dir: Path) -> Path:
    opts: dict = {
        "format": "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
        "format_sort": ["abr", "acodec:aac:opus:mp3"],
        "outtmpl": str(work_dir / "%(title)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 30,
        "retries": 3,
    }
    opts.update(config.get_ytdlp_auth_opts())

    # First attempt with auth config
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info is None:
                raise RuntimeError(f"yt-dlp returned no info for {url}")
            downloads = info.get("requested_downloads", [])
            if not downloads:
                raise RuntimeError("yt-dlp produced no output file")
            return Path(downloads[0]["filepath"])
    except Exception as first_err:
        logger.warning(f"[yt-dlp] First attempt failed: {first_err}")

    # Fallback: try with web_creator client and relaxed format
    logger.info("[yt-dlp] Retrying with web_creator client and relaxed format...")
    fallback_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(work_dir / "%(title)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 30,
        "retries": 3,
        "extractor_args": {"youtube": {"player_client": ["web_creator"]}},
    }
    with yt_dlp.YoutubeDL(fallback_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if info is None:
            raise RuntimeError(f"yt-dlp returned no info for {url}")
        downloads = info.get("requested_downloads", [])
        if not downloads:
            raise RuntimeError("yt-dlp produced no output file")
        return Path(downloads[0]["filepath"])


async def download_audio(url: str, work_dir: Path) -> Path:
    """Download best quality audio from YouTube. Returns path to downloaded file."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, functools.partial(_sync_download, url, work_dir))

