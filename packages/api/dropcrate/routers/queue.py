from __future__ import annotations

import asyncio

from fastapi import APIRouter

from dropcrate.models.schemas import QueueStartRequest, QueueStartResponse, QueueStopRequest
from dropcrate.services.job_manager import job_manager
from dropcrate.services.pipeline import run_pipeline

router = APIRouter()


@router.post("/api/queue/start")
async def queue_start(req: QueueStartRequest) -> QueueStartResponse:
    job = job_manager.create_job()
    asyncio.create_task(run_pipeline(job, req))
    return QueueStartResponse(job_id=job.id)


@router.post("/api/queue/stop")
async def queue_stop(req: QueueStopRequest):
    if req.job_id:
        job_manager.cancel_job(req.job_id)
    return {"ok": True}
