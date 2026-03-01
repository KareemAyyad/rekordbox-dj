"""Upload fallback endpoint — accepts user-provided audio files
when the server can't download from YouTube (datacenter IP blocked).

Resumes the pipeline from the fingerprint stage using the stored metadata context.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, UploadFile

from dropcrate.services import fingerprint, harmonic, normalize, tagger, transcode
from dropcrate.services.job_manager import Job, job_manager
from dropcrate.services.naming import make_rekordbox_filename, sanitize_file_component
from dropcrate.services.pipeline import _pending_uploads
from dropcrate.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

# Allowed audio MIME types / extensions
ALLOWED_EXTENSIONS = {".mp3", ".m4a", ".wav", ".aiff", ".flac", ".ogg", ".opus", ".wma", ".webm"}


@router.post("/api/queue/upload")
async def upload_audio_for_item(file: UploadFile, item_id: str, job_id: str):
    """Accept a user-uploaded audio file and resume the pipeline from fingerprint."""
    ctx = _pending_uploads.pop(item_id, None)
    if not ctx:
        return {"ok": False, "error": "No pending upload context for this item. The session may have expired."}

    # Validate file extension
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        _pending_uploads[item_id] = ctx  # Restore context
        return {"ok": False, "error": f"Unsupported file type '{ext}'. Use MP3, M4A, WAV, AIFF, FLAC, etc."}

    # Save the uploaded file
    work_dir = Path(ctx["work_dir"])
    work_dir.mkdir(parents=True, exist_ok=True)
    uploaded_path = work_dir / f"uploaded{ext}"
    content = await file.read()
    uploaded_path.write_bytes(content)
    logger.info(f"[upload] Saved {len(content)} bytes as {uploaded_path}")

    # Resume the pipeline in the background
    asyncio.create_task(_resume_pipeline(ctx, uploaded_path))

    return {"ok": True}


async def _resume_pipeline(ctx: dict, uploaded_path: Path) -> None:
    """Resume the pipeline from fingerprint stage using stored context + uploaded file."""
    job = job_manager.get_job(ctx["job_id"])
    item_id = ctx["item_id"]
    url = ctx["url"]
    info = ctx["info"]
    source_url = ctx["source_url"]
    source_id = ctx["source_id"]
    norm = ctx["normalized"]
    classification = ctx["classification"]
    title_had_separator = ctx["title_had_separator"]
    req = ctx["req"]
    inbox_dir = Path(ctx["inbox_dir"])
    work_dir = Path(ctx["work_dir"])

    def progress(stage: str):
        if job:
            job_manager.broadcast(job, {
                "type": "item-progress",
                "job_id": ctx["job_id"],
                "item_id": item_id,
                "url": url,
                "stage": stage,
            })

    # Notify that we're resuming
    if job:
        job_manager.broadcast(job, {
            "type": "item-start", "job_id": ctx["job_id"], "item_id": item_id, "url": url
        })

    try:
        downloaded_path = uploaded_path
        downloaded_ext = downloaded_path.suffix.lower()

        # Download thumbnail
        thumb_url = tagger.pick_best_thumbnail_url(info)
        thumb_path = None
        if thumb_url:
            try:
                thumb_path = await tagger.download_thumbnail(thumb_url, work_dir / "cover.jpg")
            except Exception:
                pass  # Thumbnail is optional

        # Stage 4: Fingerprint
        progress("fingerprint")
        matched = await fingerprint.try_match_music_metadata(
            audio_path=downloaded_path,
            fallback_artist=norm["artist"],
            fallback_title=norm["title"],
            fallback_version=norm["version"],
            title_had_separator=title_had_separator,
        )

        if matched:
            effective_artist = matched.artist
            effective_title = matched.title
            effective_version = matched.version
            effective_album = matched.album
            effective_year = matched.year
            effective_label = matched.label
        else:
            effective_artist = norm["artist"]
            effective_title = norm["title"]
            effective_version = norm["version"]
            effective_album = None
            effective_year = None
            effective_label = None

        effective_genre = classification["genre"]
        effective_energy = classification["energy"]
        effective_time = classification["time"]
        effective_vibe = classification["vibe"]

        # Stage 4.5: Harmonic Analysis
        progress("analysis")
        bpm, camelot_key, hot_cues = await asyncio.to_thread(harmonic.analyze_audio, str(downloaded_path))

        # Build tags
        tags = tagger._build_tags(
            artist=effective_artist,
            title=effective_title,
            genre=effective_genre,
            energy=effective_energy,
            time_slot=effective_time,
            vibe=effective_vibe,
            album=effective_album,
            year=effective_year,
            label=effective_label,
            source_url=source_url,
            source_id=source_id,
            bpm=bpm if bpm > 0 else None,
            key=camelot_key if camelot_key else None,
        )

        # Determine output format and extension
        audio_format = req.audio_format.value
        ext_map = {"aiff": ".aiff", "wav": ".wav", "flac": ".flac", "mp3": ".mp3"}
        final_ext = ext_map.get(audio_format, ".aiff")

        final_filename = make_rekordbox_filename(
            artist=tags.get("artist", "Unknown"),
            title=tags.get("title", "Unknown"),
            ext=final_ext,
            bpm=bpm if bpm > 0 else None,
            key=camelot_key if camelot_key else None,
        )
        final_path = inbox_dir / final_filename

        # Stage 5: Normalize or Transcode
        if req.normalize_enabled and req.mode.value == "dj-safe":
            progress("normalize")
            tmp_path = work_dir / f"output{final_ext}"
            await normalize.loudnorm_two_pass(
                input_path=downloaded_path,
                output_path=tmp_path,
                audio_format=audio_format,
                target_i=req.loudness.target_i,
                target_tp=req.loudness.target_tp,
                target_lra=req.loudness.target_lra,
            )
            shutil.move(str(tmp_path), str(final_path))
        else:
            progress("transcode")
            if downloaded_ext == final_ext:
                shutil.move(str(downloaded_path), str(final_path))
            else:
                tmp_path = work_dir / f"output{final_ext}"
                await transcode.transcode(downloaded_path, tmp_path, audio_format)
                shutil.move(str(tmp_path), str(final_path))

        # Stage 6: Tag
        progress("tag")
        await tagger.apply_tags_and_artwork(
            media_path=final_path,
            ext=final_ext,
            tags=tags,
            artwork_path=thumb_path,
        )

        # Stage 7: Finalize
        progress("finalize")

        sidecar = {
            "sourceUrl": source_url,
            "sourceId": source_id,
            "title": info.get("title"),
            "uploader": info.get("uploader"),
            "duration": info.get("duration"),
            "downloadedAt": datetime.now(timezone.utc).isoformat(),
            "normalized": {
                "artist": effective_artist,
                "title": effective_title,
                "version": effective_version,
                "album": effective_album,
                "year": effective_year,
                "label": effective_label,
                "bpm": bpm if bpm > 0 else None,
                "key": camelot_key if camelot_key else None,
                "hotCues": hot_cues,
            },
            "djDefaults": {
                "genre": effective_genre,
                "energy": effective_energy,
                "time": effective_time,
                "vibe": effective_vibe,
            },
            "processing": {
                "audioFormat": audio_format,
                "normalize": {
                    "enabled": req.normalize_enabled,
                    "targetI": req.loudness.target_i,
                    "targetTP": req.loudness.target_tp,
                    "targetLRA": req.loudness.target_lra,
                },
            },
            "outputs": {"audioPath": str(final_path)},
        }
        sidecar_name = sanitize_file_component(
            f"{effective_artist} - {effective_title}".strip()
        )
        sidecar_path = inbox_dir / f"{sidecar_name}.dropcrate.json"
        sidecar_path.write_text(json.dumps(sidecar, indent=2))

        # Insert into library database
        track_id = str(uuid.uuid4())[:8]
        db = await get_db()
        await db.execute(
            """INSERT OR REPLACE INTO library_tracks
               (id, file_path, sidecar_path, artist, title, genre, bpm, key, hot_cues, energy, time_slot, vibe,
                source_url, source_id, duration_seconds, audio_format,
                album, year, label, downloaded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                track_id, str(final_path), str(sidecar_path),
                effective_artist, effective_title, effective_genre,
                bpm if bpm > 0 else None,
                camelot_key if camelot_key else None,
                json.dumps(hot_cues) if hot_cues else None,
                effective_energy, effective_time, effective_vibe,
                source_url, source_id, info.get("duration"), audio_format,
                effective_album or None, effective_year or None, effective_label or None,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        await db.commit()

        if job:
            job.completed_ids.append(track_id)
            job_manager.broadcast(job, {
                "type": "item-done", "job_id": ctx["job_id"], "item_id": item_id, "url": url
            })

    except Exception as e:
        import traceback
        logger.error(f"[upload] Pipeline resume failed for {url}: {e}\n{traceback.format_exc()}")
        if job:
            job_manager.broadcast(job, {
                "type": "item-error",
                "job_id": ctx["job_id"],
                "item_id": item_id,
                "url": url,
                "error": str(e),
            })
    finally:
        shutil.rmtree(str(work_dir), ignore_errors=True)
