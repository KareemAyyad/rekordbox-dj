"""YouTube metadata fetching via yt-dlp subprocess (CLI mode).

Uses subprocess instead of yt-dlp Python API to ensure plugins
(especially bgutil PO token provider) are loaded correctly.
"""

from __future__ import annotations

import asyncio
import json
import logging
import subprocess

logger = logging.getLogger(__name__)


def _sync_fetch_info(url: str) -> dict:
    """Fetch metadata using yt-dlp CLI subprocess (plugins load correctly)."""
    cmd = [
        "yt-dlp",
        "--dump-json",
        "--no-download",
        "--no-playlist",
        "--socket-timeout", "15",
        "--retries", "2",
        "--force-ipv4",
        "--extractor-args", "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416",
        "--remote-components", "ejs:github",
    ]

    import subprocess as sp
    node_v = sp.getoutput('node -v')
    which_node = sp.getoutput('which node')
    env_path = sp.getoutput('echo $PATH')
    raise RuntimeError(f"DEBUG_NODE: v='{node_v}', which='{which_node}', path='{env_path}'")

    from dropcrate import config
    cookies_file = config.get_cookies_file()
    if cookies_file:
        cmd.extend(["--cookies", cookies_file])
        
    cmd.append(url)

    logger.info(f"[yt-dlp metadata] Running: {' '.join(cmd[:6])}... {url}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=90,
        )

        if result.returncode == 0 and result.stdout.strip():
            info = json.loads(result.stdout.strip().split("\n")[0])
            logger.info(f"[yt-dlp metadata] Success: {info.get('title', 'unknown')}")
            return info

        # Log the latest error for debugging
        stderr = result.stderr.strip() if result.stderr else "no stderr"
        # Log last 1000 chars where the actual error is usually situated
        logger.warning(f"[yt-dlp metadata] Failed (exit {result.returncode}): ... {stderr[-1000:]}")

        # If the first attempt failed, try with verbose to see plugin status
        logger.info("[yt-dlp metadata] Retrying with verbose output for diagnostics...")
        cmd_v = cmd[:-1] + ["--verbose", url]  # URL must be last
        result_v = subprocess.run(
            cmd_v,
            capture_output=True,
            text=True,
            timeout=90,
        )

        if result_v.returncode == 0 and result_v.stdout.strip():
            info = json.loads(result_v.stdout.strip().split("\n")[0])
            logger.info(f"[yt-dlp metadata] Verbose retry succeeded: {info.get('title', 'unknown')}")
            return info

        stderr_v = result_v.stderr.strip() if result_v.stderr else "no stderr"
        logger.error(f"[yt-dlp metadata] FULL VERBOSE ERROR: {stderr_v}")
        raise RuntimeError(f"yt-dlp metadata extraction failed: ... {stderr_v[-1500:]}")

    except subprocess.TimeoutExpired:
        raise RuntimeError(f"yt-dlp metadata extraction timed out for {url}")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"yt-dlp returned invalid JSON: {e}")


async def fetch_video_info(url: str) -> dict:
    """Fetch video metadata from YouTube without downloading."""
    loop = asyncio.get_event_loop()
    return await asyncio.wait_for(
        loop.run_in_executor(None, _sync_fetch_info, url),
        timeout=120,
    )
