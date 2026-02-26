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

# SAM-Audio
SEGMENTS_DIR = Path(_env("DROPCRATE_SEGMENTS_DIR", "./data/segments"))
HF_TOKEN = _env("HF_TOKEN")
SAM_AUDIO_MODEL = _env("SAM_AUDIO_MODEL", "facebook/sam-audio-base")

# RunPod (optional — set both to use cloud GPU instead of local inference)
RUNPOD_API_KEY = _env("RUNPOD_API_KEY")
RUNPOD_ENDPOINT_ID = _env("RUNPOD_ENDPOINT_ID")

# Static files (Next.js build output served in production)
STATIC_DIR = Path(_env("DROPCRATE_STATIC_DIR", "./static"))
