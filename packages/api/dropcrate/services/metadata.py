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
    opts.update(config.get_ytdlp_auth_opts())
    return opts


import logging
logger = logging.getLogger(__name__)

def _sync_fetch_info(url: str) -> dict:
    opts = _get_ydl_opts()
    opts["skip_download"] = True
    
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info is None:
                raise RuntimeError(f"yt-dlp returned no info for {url}")
            return ydl.sanitize_info(info)  # type: ignore[return-value]
    except Exception as first_err:
        logger.warning(f"[yt-dlp metadata] First attempt failed: {first_err}")
    
    # Fallback: try with web_creator client
    logger.info("[yt-dlp metadata] Retrying with web_creator client...")
    fallback_opts = opts.copy()
    fallback_opts["extractor_args"] = {"youtube": {"player_client": ["web_creator"]}}
    
    with yt_dlp.YoutubeDL(fallback_opts) as ydl:
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
