from __future__ import annotations

import asyncio
import json
import shutil
import uuid

from fastapi import APIRouter, Query, UploadFile, File
from fastapi.responses import FileResponse, Response, StreamingResponse

from dropcrate import config
from dropcrate.models.segment_schemas import (
    AutoSegmentRequest,
    AutoSegmentResponse,
    SeparateRequest,
    SeparateResponse,
    SegmentResult,
    UploadResponse,
)
from dropcrate.services.job_manager import JobManager
from dropcrate.services.sam_audio import (
    DEFAULT_DJ_PROMPTS,
    cleanup_old_sessions,
    get_audio_info,
)
from dropcrate.services import stems

router = APIRouter()

# Dedicated job manager for segment SSE events
segment_job_manager = JobManager()

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".flac", ".aiff", ".aif", ".ogg", ".m4a", ".wma"}
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200 MB


def _find_original(session_dir):
    """Find the original audio file in a session directory."""
    originals = list(session_dir.glob("original.*"))
    return originals[0] if originals else None


@router.post("/api/segment/upload", response_model=UploadResponse)
async def upload_audio(file: UploadFile = File(...)):
    """Upload an audio file for segmentation."""
    filename = file.filename or "audio.wav"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return Response(
            status_code=400,
            content=f"Unsupported format. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    cleanup_old_sessions()

    session_id = str(uuid.uuid4())[:8]
    session_dir = config.SEGMENTS_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    original_path = session_dir / f"original{ext}"
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        shutil.rmtree(session_dir, ignore_errors=True)
        return Response(status_code=400, content="File too large. Max 200 MB.")

    original_path.write_bytes(content)

    try:
        info = get_audio_info(original_path)
    except Exception as e:
        shutil.rmtree(session_dir, ignore_errors=True)
        return Response(status_code=400, content=f"Could not read audio file: {e}")

    return UploadResponse(
        session_id=session_id,
        filename=filename,
        duration_seconds=info["duration_seconds"],
        sample_rate=info["sample_rate"],
        channels=info["channels"],
    )


@router.post("/api/segment/separate", response_model=SeparateResponse)
async def separate_audio(req: SeparateRequest):
    """Mode 1: Separate a specific sound described by text prompt."""
    session_dir = config.SEGMENTS_DIR / req.session_id
    if not session_dir.exists():
        return Response(status_code=404, content="Session not found")

    audio_path = _find_original(session_dir)
    if not audio_path:
        return Response(status_code=404, content="Original audio not found")

    result = await sam_audio_service.separate(
        session_dir=session_dir,
        audio_path=audio_path,
        prompt=req.prompt,
        label=req.prompt[:50],
        guidance_scale=req.guidance_scale,
        num_steps=req.num_steps,
        reranking_candidates=req.reranking_candidates,
    )

    segment = SegmentResult(
        id=result["id"],
        prompt=result["prompt"],
        label=result["label"],
        target_url=f"/api/segment/stream/{req.session_id}/{result['target_filename']}",
        residual_url=f"/api/segment/stream/{req.session_id}/{result['residual_filename']}",
        duration_seconds=result["duration_seconds"],
    )

    return SeparateResponse(ok=True, segment=segment)


@router.post("/api/segment/auto", response_model=AutoSegmentResponse)
async def auto_segment(req: AutoSegmentRequest):
    """Mode 2: Auto-segment into all DJ categories. Progress via SSE."""
    session_dir = config.SEGMENTS_DIR / req.session_id
    if not session_dir.exists():
        return Response(status_code=404, content="Session not found")

    audio_path = _find_original(session_dir)
    if not audio_path:
        return Response(status_code=404, content="Original audio not found")

    if req.categories:
        prompt_map = {label: prompt for label, prompt in DEFAULT_DJ_PROMPTS}
        categories = [(cat, prompt_map.get(cat, cat)) for cat in req.categories]
    else:
        categories = None

    job = segment_job_manager.create_job()

    async def _run():
        try:
            # Tell frontend we are processing 4 stems locally
            segment_job_manager.broadcast(job, {"type": "auto-start", "total": 4})
            segment_job_manager.broadcast(job, {"type": "model-loading"})
            
            # Start Demucs inference
            segment_job_manager.broadcast(job, {"type": "model-ready"})
            segment_job_manager.broadcast(job, {
                "type": "segment-start",
                "label": "Vocals, Drums, Bass, Other",
                "index": 1,
                "total": 4,
            })

            # Run strict local inference
            results = await stems.separate_audio(str(audio_path), str(session_dir))

            segments = []
            for stem_name, stem_path in results.items():
                seg = {
                    "id": str(uuid.uuid4())[:8],
                    "prompt": f"Isolated {stem_name}",
                    "label": stem_name.capitalize(),
                    "target_url": f"/api/segment/stream/{req.session_id}/{stem_name}.wav",
                    "residual_url": "", # Demucs guarantees isolated multitracks, no residual needed
                    "duration_seconds": 0, # Not strictly needed by frontend
                }
                segments.append(seg)
                segment_job_manager.broadcast(job, {"type": "segment-done", "segment": seg})

            segment_job_manager.broadcast(job, {"type": "auto-done", "segments": segments})
        except Exception as e:
            segment_job_manager.broadcast(job, {"type": "auto-error", "error": str(e)})

    asyncio.create_task(_run())

    return AutoSegmentResponse(ok=True, job_id=job.id)


@router.get("/api/segment/events")
async def segment_events(job_id: str = Query(...)):
    """SSE stream for separation progress events."""
    job = segment_job_manager.get_job(job_id)
    if not job:
        return Response(status_code=404, content="Job not found")

    client_id, queue = segment_job_manager.subscribe(job)

    async def event_stream():
        try:
            yield "\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("type") in ("auto-done", "auto-error"):
                        break
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            segment_job_manager.unsubscribe(job, client_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/api/segment/stream/{session_id}/{filename}")
async def stream_audio(session_id: str, filename: str):
    """Stream audio file for browser playback."""
    file_path = config.SEGMENTS_DIR / session_id / filename
    if not file_path.exists() or not file_path.is_file():
        return Response(status_code=404, content="File not found")

    try:
        file_path.resolve().relative_to(config.SEGMENTS_DIR.resolve())
    except ValueError:
        return Response(status_code=403, content="Forbidden")

    return FileResponse(
        path=str(file_path),
        media_type="audio/wav",
        headers={"Accept-Ranges": "bytes"},
    )


@router.get("/api/segment/download/{session_id}/{filename}")
async def download_audio(session_id: str, filename: str):
    """Download separated audio file."""
    file_path = config.SEGMENTS_DIR / session_id / filename
    if not file_path.exists() or not file_path.is_file():
        return Response(status_code=404, content="File not found")

    try:
        file_path.resolve().relative_to(config.SEGMENTS_DIR.resolve())
    except ValueError:
        return Response(status_code=403, content="Forbidden")

    return FileResponse(
        path=str(file_path),
        media_type="audio/wav",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/segment/original/{session_id}")
async def stream_original(session_id: str):
    """Stream the original uploaded audio file."""
    session_dir = config.SEGMENTS_DIR / session_id
    if not session_dir.exists():
        return Response(status_code=404, content="Session not found")

    audio_path = _find_original(session_dir)
    if not audio_path:
        return Response(status_code=404, content="Original audio not found")

    ext = audio_path.suffix.lower()
    media_types = {
        ".wav": "audio/wav", ".mp3": "audio/mpeg", ".flac": "audio/flac",
        ".aiff": "audio/aiff", ".aif": "audio/aiff", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
    }

    return FileResponse(
        path=str(audio_path),
        media_type=media_types.get(ext, "audio/wav"),
        headers={"Accept-Ranges": "bytes"},
    )


@router.delete("/api/segment/session/{session_id}")
async def delete_session(session_id: str):
    """Clean up a segment session and all its files."""
    session_dir = config.SEGMENTS_DIR / session_id
    if session_dir.exists():
        shutil.rmtree(session_dir, ignore_errors=True)
    return {"ok": True}
