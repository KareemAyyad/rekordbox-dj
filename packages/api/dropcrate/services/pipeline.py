"""Pipeline orchestrator — port of downloadBatch + downloadOne.

Processes a queue of YouTube URLs through the full audio pipeline:
metadata → classify → download → fingerprint → normalize → tag → finalize
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

from dropcrate import config
from dropcrate.database import get_db
from dropcrate.models.schemas import QueueStartRequest
from dropcrate.services import download, fingerprint, harmonic, normalize, tagger, transcode
from dropcrate.services.classify_heuristic import heuristic_classify
from dropcrate.services.job_manager import Job, job_manager
from dropcrate.services.naming import make_rekordbox_filename, sanitize_file_component
from dropcrate.services.title_parser import normalize_from_youtube_title
from dropcrate.services.metadata import fetch_video_info


logger = logging.getLogger(__name__)

MAX_CONCURRENT = 3

# Stores pipeline context for items awaiting user file upload
# Key: item_id, Value: dict with all metadata needed to resume from fingerprint stage
_pending_uploads: dict[str, dict] = {}


async def _maybe_generate_rekordbox_xml(job: Job, inbox_dir: Path) -> None:
    """Generate rekordbox XML after a batch if the setting is enabled.

    Uses the full library (not just the current batch) and writes into a
    timestamped folder like ``DropCrate 2026-02-26/dropcrate_import.xml``.
    """
    if not job.completed_ids:
        return
    try:
        from dropcrate.services.rekordbox_xml import generate_rekordbox_xml

        db = await get_db()
        row = await db.execute_fetchall("SELECT rekordbox_xml_enabled FROM settings WHERE id = 1")
        if not row or not row[0]["rekordbox_xml_enabled"]:
            return

        # Use FULL library, not just batch tracks
        tracks = await db.execute_fetchall(
            "SELECT * FROM library_tracks ORDER BY downloaded_at DESC"
        )
        if not tracks:
            return

        track_dicts = [dict(t) for t in tracks]

        # Timestamped folder: DropCrate YYYY-MM-DD
        folder_name = f"DropCrate {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
        xml_dir = inbox_dir / folder_name
        xml_dir.mkdir(parents=True, exist_ok=True)
        xml_path = xml_dir / "dropcrate_import.xml"
        generate_rekordbox_xml(track_dicts, xml_path)
    except Exception as exc:
        import logging
        logging.getLogger("dropcrate.pipeline").warning(
            "Rekordbox XML generation failed: %s", exc
        )
        job_manager.broadcast(job, {
            "type": "warning",
            "job_id": job.id,
            "message": f"Rekordbox XML generation failed: {exc}",
        })


async def run_pipeline(job: Job, req: QueueStartRequest) -> None:
    """Main pipeline entry point. Runs as a background task."""
    inbox_dir = Path(req.inbox_dir)
    inbox_dir.mkdir(parents=True, exist_ok=True)

    job_manager.broadcast(job, {
        "type": "queue-start",
        "job_id": job.id,
        "count": len(req.items),
        "inbox_dir": str(inbox_dir),
        "mode": req.mode.value,
    })

    sem = asyncio.Semaphore(MAX_CONCURRENT)
    tasks = []
    for item in req.items:
        tasks.append(_process_with_semaphore(sem, job, req, item, inbox_dir))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Log any silently swallowed exceptions from gather
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            item = req.items[i]
            logger.error(f"Unhandled exception for item {item.id} ({item.url}): {result}")
            job_manager.broadcast(job, {
                "type": "item-error",
                "job_id": job.id,
                "item_id": item.id,
                "url": item.url,
                "error": str(result),
            })

    # Generate rekordbox XML with auto-playlists for completed tracks
    await _maybe_generate_rekordbox_xml(job, inbox_dir)

    job_manager.broadcast(job, {"type": "queue-done", "job_id": job.id})


async def _process_with_semaphore(sem, job, req, item, inbox_dir):
    async with sem:
        if job.cancel_requested:
            job_manager.broadcast(job, {
                "type": "item-error",
                "job_id": job.id,
                "item_id": item.id,
                "url": item.url,
                "error": "Cancelled",
            })
            return
        await _process_one(job, req, item, inbox_dir)


async def _process_one(job: Job, req: QueueStartRequest, item, inbox_dir: Path) -> None:
    """Process a single queue item through the full pipeline."""
    url = item.url
    dj_defaults = item.preset_snapshot

    job_manager.broadcast(job, {
        "type": "item-start", "job_id": job.id, "item_id": item.id, "url": url
    })

    def progress(stage: str):
        if not job.cancel_requested:
            job_manager.broadcast(job, {
                "type": "item-progress",
                "job_id": job.id,
                "item_id": item.id,
                "url": url,
                "stage": stage,
            })

    try:
        # Stage 1: Metadata
        progress("metadata")
        try:
            info = await fetch_video_info(url)
        except Exception as meta_err:
            logger.warning(f"[pipeline] Metadata extraction failed for {url}: {meta_err}")
            # Extract video ID from URL for minimal context
            vid_match = re.search(r'(?:v=|/)([a-zA-Z0-9_-]{11})', url)
            source_id = vid_match.group(1) if vid_match else hashlib.sha1(url.encode()).hexdigest()[:10]
            work_dir = inbox_dir / f".dropcrate_tmp_{source_id}"
            work_dir.mkdir(parents=True, exist_ok=True)
            _pending_uploads[item.id] = {
                "job_id": job.id,
                "item_id": item.id,
                "url": url,
                "info": {"title": "Unknown Title", "id": source_id},
                "source_url": url,
                "source_id": source_id,
                "normalized": {"artist": "Unknown", "title": "Unknown", "version": ""},
                "classification": {"genre": dj_defaults.genre or "Other", "energy": dj_defaults.energy or "", "time": dj_defaults.time or "", "vibe": dj_defaults.vibe or ""},
                "title_had_separator": False,
                "dj_defaults": {"genre": dj_defaults.genre, "energy": dj_defaults.energy, "time": dj_defaults.time, "vibe": dj_defaults.vibe},
                "work_dir": str(work_dir),
                "inbox_dir": str(inbox_dir),
                "req": req,
            }
            job_manager.broadcast(job, {
                "type": "item-upload-needed",
                "job_id": job.id,
                "item_id": item.id,
                "url": url,
                "title": f"YouTube video ({source_id})",
                "error": str(meta_err),
            })
            return

        source_url = info.get("webpage_url") or url
        source_id = info.get("id") or hashlib.sha1(source_url.encode()).hexdigest()[:10]

        if job.cancel_requested:
            raise RuntimeError("Cancelled")

        # Stage 2: Classify
        progress("classify")
        classification = heuristic_classify(item.id, info)
        effective_genre = (
            dj_defaults.genre
            if dj_defaults.genre and dj_defaults.genre != "Other"
            else (classification.genre or "Other")
        )
        effective_energy = dj_defaults.energy or (classification.energy or "")
        effective_time = dj_defaults.time or (classification.time or "")
        effective_vibe = dj_defaults.vibe or (classification.vibe or "")

        # Parse title
        raw_title = (info.get("title") or "Unknown Title").strip()
        title_had_separator = bool(re.search(r"(\s-\s|\s\u2013\s|\s\u2014\s|\s\|\s)", raw_title))
        normalized = normalize_from_youtube_title(raw_title, info.get("uploader"))

        base_name = sanitize_file_component(f"{normalized.artist} - {normalized.title}".strip())
        work_dir = inbox_dir / f".dropcrate_tmp_{source_id}"
        work_dir.mkdir(parents=True, exist_ok=True)

        try:
            if job.cancel_requested:
                raise RuntimeError("Cancelled")

            # Stage 3: Download
            progress("download")
            try:
                downloaded_path = await download.download_audio(url, work_dir)
            except Exception as dl_err:
                logger.warning(f"[pipeline] Download failed for {url}: {dl_err}")
                # Store pipeline context so upload endpoint can resume
                _pending_uploads[item.id] = {
                    "job_id": job.id,
                    "item_id": item.id,
                    "url": url,
                    "info": info,
                    "source_url": source_url,
                    "source_id": source_id,
                    "normalized": {"artist": normalized.artist, "title": normalized.title, "version": normalized.version},
                    "classification": {"genre": effective_genre, "energy": effective_energy, "time": effective_time, "vibe": effective_vibe},
                    "title_had_separator": title_had_separator,
                    "dj_defaults": {"genre": dj_defaults.genre, "energy": dj_defaults.energy, "time": dj_defaults.time, "vibe": dj_defaults.vibe},
                    "work_dir": str(work_dir),
                    "inbox_dir": str(inbox_dir),
                    "req": req,
                }
                job_manager.broadcast(job, {
                    "type": "item-upload-needed",
                    "job_id": job.id,
                    "item_id": item.id,
                    "url": url,
                    "title": info.get("title", "Unknown"),
                    "error": str(dl_err),
                })
                return  # Don't clean up work_dir — upload endpoint needs it

            downloaded_ext = downloaded_path.suffix.lower()

            # Download thumbnail
            thumb_url = tagger.pick_best_thumbnail_url(info)
            thumb_path = None
            if thumb_url:
                thumb_path = await tagger.download_thumbnail(thumb_url, work_dir / "cover.jpg")

            if job.cancel_requested:
                raise RuntimeError("Cancelled")

            # Stage 4: Fingerprint
            progress("fingerprint")
            matched = await fingerprint.try_match_music_metadata(
                audio_path=downloaded_path,
                fallback_artist=normalized.artist,
                fallback_title=normalized.title,
                fallback_version=normalized.version,
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
                effective_artist = normalized.artist
                effective_title = normalized.title
                effective_version = normalized.version
                effective_album = None
                effective_year = None
                effective_label = None

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

            if job.cancel_requested:
                raise RuntimeError("Cancelled")

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
                # Check if we can just rename (same format, no normalization)
                is_same_format = (
                    (downloaded_ext == ".m4a" and audio_format == "mp3")
                    or downloaded_ext == final_ext
                )
                if not req.normalize_enabled and is_same_format and downloaded_ext == final_ext:
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

            # Write sidecar JSON
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
                    track_id,
                    str(final_path),
                    str(sidecar_path),
                    effective_artist,
                    effective_title,
                    effective_genre,
                    bpm if bpm > 0 else None,
                    camelot_key if camelot_key else None,
                    json.dumps(hot_cues) if hot_cues else None,
                    effective_energy,
                    effective_time,
                    effective_vibe,
                    source_url,
                    source_id,
                    info.get("duration"),
                    audio_format,
                    effective_album or None,
                    effective_year or None,
                    effective_label or None,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            await db.commit()

            # Track completed IDs for batch XML generation
            job.completed_ids.append(track_id)

            job_manager.broadcast(job, {
                "type": "item-done", "job_id": job.id, "item_id": item.id, "url": url
            })

        finally:
            # Clean up work directory
            shutil.rmtree(str(work_dir), ignore_errors=True)

    except Exception as e:
        import traceback
        err_trace = traceback.format_exc()
        logger.error(f"FATAL ERROR in _process_one for {url}: {e}\n{err_trace}")
        job_manager.broadcast(job, {
            "type": "item-error",
            "job_id": job.id,
            "item_id": item.id,
            "url": url,
            "error": f"{str(e)}",
        })
