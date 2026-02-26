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
    """Return yt-dlp auth options. Priority: browser cookies > cookies file > nothing.

    PO tokens are handled automatically by bgutil-ytdlp-pot-provider plugin —
    no explicit config needed here.
    """
    if COOKIES_FROM_BROWSER:
        return {"cookiesfrombrowser": (COOKIES_FROM_BROWSER,)}
    cookies_file = get_cookies_file()
    if cookies_file:
        return {"cookiefile": cookies_file}
    return {}

# SAM-Audio
SEGMENTS_DIR = Path(_env("DROPCRATE_SEGMENTS_DIR", "./data/segments"))
HF_TOKEN = _env("HF_TOKEN")
SAM_AUDIO_MODEL = _env("SAM_AUDIO_MODEL", "facebook/sam-audio-base")

# RunPod (optional — set both to use cloud GPU instead of local inference)
RUNPOD_API_KEY = _env("RUNPOD_API_KEY")
RUNPOD_ENDPOINT_ID = _env("RUNPOD_ENDPOINT_ID")

# Static files (Next.js build output served in production)
STATIC_DIR = Path(_env("DROPCRATE_STATIC_DIR", "./static"))
