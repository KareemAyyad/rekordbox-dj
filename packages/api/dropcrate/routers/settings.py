from __future__ import annotations

from fastapi import APIRouter

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
        ),
    )
    await db.commit()
    return {"ok": True}
