"""YouTube audio download via yt-dlp (native Python library)."""

from __future__ import annotations

import asyncio
import functools
from pathlib import Path

import yt_dlp

from dropcrate import config


def _sync_download(url: str, work_dir: Path) -> Path:
    opts: dict = {
        "format": "bestaudio/best",
        "outtmpl": str(work_dir / "%(title)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 10,
        "retries": 1,
    }
    if config.COOKIES_FROM_BROWSER:
        opts["cookiesfrombrowser"] = (config.COOKIES_FROM_BROWSER,)
    elif config.COOKIES_FILE:
        opts["cookiefile"] = config.COOKIES_FILE

    with yt_dlp.YoutubeDL(opts) as ydl:
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
