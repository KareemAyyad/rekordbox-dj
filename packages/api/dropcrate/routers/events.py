from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Query
from fastapi.responses import Response, StreamingResponse

from dropcrate.services.job_manager import job_manager

router = APIRouter()


@router.get("/api/queue/events")
async def queue_events(job_id: str = Query(...)):
    job = job_manager.get_job(job_id)
    if not job:
        return Response(status_code=404, content="Job not found")

    client_id, queue = job_manager.subscribe(job)

    async def event_stream():
        try:
            yield "\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("type") == "queue-done":
                        break
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            job_manager.unsubscribe(job, client_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
