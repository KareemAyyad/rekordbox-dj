"""YouTube metadata fetching via yt-dlp (native Python library)."""

from __future__ import annotations

import asyncio
import functools

import yt_dlp

from dropcrate import config


def _get_ydl_opts() -> dict:
    opts: dict = {
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
    return opts


def _sync_fetch_info(url: str) -> dict:
    opts = _get_ydl_opts()
    opts["skip_download"] = True
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if info is None:
            raise RuntimeError(f"yt-dlp returned no info for {url}")
        return ydl.sanitize_info(info)  # type: ignore[return-value]


async def fetch_video_info(url: str) -> dict:
    """Fetch video metadata from YouTube without downloading."""
    loop = asyncio.get_event_loop()
    return await asyncio.wait_for(
        loop.run_in_executor(None, functools.partial(_sync_fetch_info, url)),
        timeout=60,
    )
