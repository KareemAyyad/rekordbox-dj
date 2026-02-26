from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field


@dataclass
class Job:
    id: str
    cancel_requested: bool = False
    history: list[dict] = field(default_factory=list)
    subscribers: dict[str, asyncio.Queue] = field(default_factory=dict)


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}

    def create_job(self) -> Job:
        job_id = str(uuid.uuid4())[:8]
        job = Job(id=job_id)
        self._jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def broadcast(self, job: Job, event: dict) -> None:
        job.history.append(event)
        if len(job.history) > 500:
            job.history = job.history[-500:]
        for q in job.subscribers.values():
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass

    def subscribe(self, job: Job) -> tuple[str, asyncio.Queue]:
        client_id = str(uuid.uuid4())[:8]
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        job.subscribers[client_id] = q
        # Replay history
        for evt in job.history:
            try:
                q.put_nowait(evt)
            except asyncio.QueueFull:
                break
        return client_id, q

    def unsubscribe(self, job: Job, client_id: str) -> None:
        job.subscribers.pop(client_id, None)

    def cancel_job(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if job:
            job.cancel_requested = True
            return True
        return False

    def cleanup_job(self, job_id: str) -> None:
        self._jobs.pop(job_id, None)


job_manager = JobManager()
