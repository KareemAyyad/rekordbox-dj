from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


# Paths
INBOX_DIR = Path(_env("DROPCRATE_INBOX_DIR", "./data/inbox"))
DATABASE_PATH = Path(_env("DROPCRATE_DATABASE_PATH", "./data/dropcrate.db"))

# Server
PORT = int(_env("PORT", "8000"))

# OpenAI (optional)
OPENAI_API_KEY = _env("OPENAI_API_KEY")
OPENAI_MODEL = _env("DROPCRATE_OPENAI_MODEL", "gpt-4o-mini")

# AcoustID (optional)
ACOUSTID_KEY = _env("DROPCRATE_ACOUSTID_KEY")
FPCALC_PATH = _env("DROPCRATE_FPCALC_PATH", "fpcalc")

# yt-dlp
COOKIES_FROM_BROWSER = _env("DROPCRATE_COOKIES_FROM_BROWSER")
COOKIES_FILE = _env("DROPCRATE_COOKIES_FILE")

# Uploaded cookies file (auto-detected in data dir)
UPLOADED_COOKIES_PATH = DATABASE_PATH.parent / "youtube_cookies.txt"

def get_cookies_file() -> str:
    """Return the effective cookies file path (env var or uploaded file)."""
    if COOKIES_FILE:
        return COOKIES_FILE
    if UPLOADED_COOKIES_PATH.is_file():
        return str(UPLOADED_COOKIES_PATH)
    return ""


def get_ytdlp_auth_opts() -> dict:
    """Return yt-dlp auth options.

    Priority: browser cookies > cookies file > PO Token provider.
    Always includes extractor_args for bgutil PO token HTTP server.
    """
    opts: dict = {}
    
    if COOKIES_FROM_BROWSER:
        opts["cookiesfrombrowser"] = (COOKIES_FROM_BROWSER,)
    else:
        cookies_file = get_cookies_file()
        if cookies_file:
            opts["cookiefile"] = cookies_file
    
    # Always configure the bgutil PO token HTTP server (runs on 127.0.0.1:4416 in Docker)
    # This tells yt-dlp's YouTube extractor to use the PO token provider
    opts["extractor_args"] = {
        "youtube": {
            "player_client": ["android"],
        },
        "youtubepot-bgutilhttp": {
            "base_url": ["http://127.0.0.1:4416"],
        },
    }
    
    # Enable verbose logging so we can verify PO tokens are being used
    opts["verbose"] = True
    
    return opts

# SAM-Audio
SEGMENTS_DIR = Path(_env("DROPCRATE_SEGMENTS_DIR", "./data/segments"))
HF_TOKEN = _env("HF_TOKEN")
SAM_AUDIO_MODEL = _env("SAM_AUDIO_MODEL", "facebook/sam-audio-base")

# RunPod (optional — set both to use cloud GPU instead of local inference)
RUNPOD_API_KEY = _env("RUNPOD_API_KEY")
RUNPOD_ENDPOINT_ID = _env("RUNPOD_ENDPOINT_ID")

# Replicate (hosted GPU Demucs stem separation)
REPLICATE_API_TOKEN = _env("REPLICATE_API_TOKEN")

# Static files (Next.js build output served in production)
STATIC_DIR = Path(_env("DROPCRATE_STATIC_DIR", "./static"))
