from __future__ import annotations

import json
import time

import httpx
from fastapi import APIRouter, UploadFile
from pydantic import BaseModel

from dropcrate import config
from dropcrate.database import get_db
from dropcrate.models.schemas import LoudnessConfig, Settings, SettingsUpdate

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


# --- YouTube OAuth2 Device Flow ---


class DeviceCodePoll(BaseModel):
    device_code: str


@router.post("/api/settings/youtube-auth/start")
async def youtube_auth_start():
    """Initiate the Google OAuth2 device code flow for YouTube."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/device/code",
            data={
                "client_id": config.YOUTUBE_CLIENT_ID,
                "scope": "https://www.googleapis.com/auth/youtube",
            },
        )
        resp.raise_for_status()
        data = resp.json()
    return {
        "device_code": data["device_code"],
        "user_code": data["user_code"],
        "verification_url": data["verification_url"],
        "expires_in": data["expires_in"],
        "interval": data["interval"],
    }


@router.post("/api/settings/youtube-auth/poll")
async def youtube_auth_poll(body: DeviceCodePoll):
    """Poll Google for the OAuth2 token after user has authorized on their device."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": config.YOUTUBE_CLIENT_ID,
                "client_secret": config.YOUTUBE_CLIENT_SECRET,
                "device_code": body.device_code,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            },
        )
        data = resp.json()

    if "error" in data:
        error = data["error"]
        if error == "authorization_pending":
            return {"status": "pending"}
        if error == "slow_down":
            return {"status": "slow_down"}
        if error == "expired_token":
            return {"status": "expired"}
        if error == "access_denied":
            return {"status": "denied"}
        return {"status": "error", "error": data.get("error_description", error)}

    # Success — save token in yt-dlp's expected cache format
    token = {
        "access_token": data["access_token"],
        "expires": int(time.time()) + data["expires_in"],
        "refresh_token": data["refresh_token"],
        "token_type": data.get("token_type", "Bearer"),
    }
    token_path = config.YOUTUBE_OAUTH2_TOKEN_PATH
    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(json.dumps(token))
    return {"status": "authorized"}


@router.get("/api/settings/youtube-auth/status")
async def youtube_auth_status():
    """Check current YouTube authentication status."""
    # Check OAuth2 token first
    token_path = config.YOUTUBE_OAUTH2_TOKEN_PATH
    if token_path.is_file():
        try:
            token = json.loads(token_path.read_text())
            if token.get("refresh_token"):
                return {"authenticated": True, "method": "oauth2"}
        except (json.JSONDecodeError, KeyError):
            pass

    # Fall back to cookies
    cookies_file = config.get_cookies_file()
    if cookies_file:
        return {"authenticated": True, "method": "cookies"}

    return {"authenticated": False, "method": "none"}


@router.delete("/api/settings/youtube-auth")
async def youtube_auth_revoke():
    """Remove the saved YouTube OAuth2 token."""
    token_path = config.YOUTUBE_OAUTH2_TOKEN_PATH
    if token_path.is_file():
        token_path.unlink()
    return {"ok": True}
