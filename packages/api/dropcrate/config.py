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

# Static files (Next.js build output served in production)
STATIC_DIR = Path(_env("DROPCRATE_STATIC_DIR", "./static"))
