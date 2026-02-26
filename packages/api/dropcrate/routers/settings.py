from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, UploadFile

from dropcrate import config
from dropcrate.database import get_db
from dropcrate.models.schemas import LoudnessConfig, Settings, SettingsUpdate

logger = logging.getLogger(__name__)

router = APIRouter()


async def _load_settings() -> Settings:
    db = await get_db()
    row = await db.execute_fetchall("SELECT * FROM settings WHERE id = 1")
    if not row:
        return Settings()
    r = row[0]
    return Settings(
        inbox_dir=r["inbox_dir"],
        mode=r["mode"],
        audio_format=r["audio_format"],
        normalize_enabled=bool(r["normalize_enabled"]),
        loudness=LoudnessConfig(
            target_i=r["target_i"],
            target_tp=r["target_tp"],
            target_lra=r["target_lra"],
        ),
        rekordbox_xml_enabled=bool(r["rekordbox_xml_enabled"]),
    )


@router.get("/api/settings")
async def get_settings() -> Settings:
    return await _load_settings()


@router.put("/api/settings")
async def update_settings(update: SettingsUpdate):
    current = await _load_settings()
    merged = current.model_copy(
        update={k: v for k, v in update.model_dump().items() if v is not None}
    )
    if update.loudness is not None:
        merged.loudness = update.loudness

    db = await get_db()
    await db.execute(
        """UPDATE settings SET
            inbox_dir = ?, mode = ?, audio_format = ?,
            normalize_enabled = ?, target_i = ?, target_tp = ?, target_lra = ?,
            rekordbox_xml_enabled = ?,
            updated_at = datetime('now')
        WHERE id = 1""",
        (
            merged.inbox_dir,
            merged.mode.value,
            merged.audio_format.value,
            int(merged.normalize_enabled),
            merged.loudness.target_i,
            merged.loudness.target_tp,
            merged.loudness.target_lra,
            int(merged.rekordbox_xml_enabled),
        ),
    )
    await db.commit()
    return {"ok": True}


# --- YouTube cookies management ---


@router.get("/api/settings/youtube-cookies")
async def youtube_cookies_status():
    """Check if YouTube cookies are configured."""
    cookies_file = config.get_cookies_file()
    return {
        "configured": bool(cookies_file),
        "source": "env" if config.COOKIES_FILE else ("uploaded" if cookies_file else "none"),
    }


@router.post("/api/settings/youtube-cookies")
async def upload_youtube_cookies(file: UploadFile):
    """Upload a Netscape-format cookies.txt file for YouTube authentication."""
    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    # Basic validation: Netscape cookies files start with a comment or domain lines
    if not text.strip():
        return {"ok": False, "error": "File is empty"}
    config.UPLOADED_COOKIES_PATH.parent.mkdir(parents=True, exist_ok=True)
    config.UPLOADED_COOKIES_PATH.write_text(text)
    return {"ok": True}


@router.delete("/api/settings/youtube-cookies")
async def delete_youtube_cookies():
    """Remove the uploaded YouTube cookies file."""
    if config.UPLOADED_COOKIES_PATH.is_file():
        config.UPLOADED_COOKIES_PATH.unlink()
    return {"ok": True}


# --- YouTube Auth Status (PO Token + Cookies) ---


@router.get("/api/settings/youtube-auth/status")
async def youtube_auth_status():
    """Check YouTube authentication status.

    PO tokens (via bgutil provider) are the primary method — zero user interaction.
    Cookies are available as a fallback.
    """
    # Check if bgutil PO token server is running (port 4416)
    po_token_ok = False
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            resp = await client.get("http://127.0.0.1:4416/")
            po_token_ok = True  # Any response means server is up
    except Exception:
        pass

    if po_token_ok:
        return {"authenticated": True, "method": "po_token"}

    # Fall back to cookies
    cookies_file = config.get_cookies_file()
    if cookies_file:
        return {"authenticated": True, "method": "cookies"}

    return {"authenticated": False, "method": "none"}
