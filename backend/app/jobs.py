"""Background generation jobs with progress tracking, pause, and cancel."""
from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field


class JobCancelled(Exception):
    """Raised at safe points when the user cancels a job."""


@dataclass
class Job:
    id: str
    status: str = "queued"  # queued | running | done | error | cancelled
    stage: str = "Queued…"
    script_id: int | None = None
    total_scenes: int = 0
    done_scenes: int = 0
    media_found: int = 0
    scenes: list[dict[str, object]] = field(default_factory=list)
    error: str = ""
    paused: bool = False
    started_at: float = field(default_factory=time.time)
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)

    def throw_if_cancelled(self) -> None:
        if self.cancel_event.is_set():
            raise JobCancelled("cancelled by user")

    async def wait_if_paused(self) -> None:
        while self.paused:
            self.throw_if_cancelled()
            await asyncio.sleep(0.2)

    def to_dict(self) -> dict[str, object]:
        return {
            "job_id": self.id,
            "status": self.status,
            "stage": self.stage,
            "script_id": self.script_id,
            "total_scenes": self.total_scenes,
            "done_scenes": self.done_scenes,
            "media_found": self.media_found,
            "scenes": self.scenes,
            "error": self.error,
            "paused": self.paused,
            "elapsed": round(time.time() - self.started_at, 1),
        }


JOBS: dict[str, Job] = {}


def create_job() -> Job:
    now = time.time()
    stale = [
        jid
        for jid, j in JOBS.items()
        if j.status in ("done", "error", "cancelled") and now - j.started_at > 3600
    ]
    for jid in stale:
        del JOBS[jid]
    while len(JOBS) >= 100:
        oldest = min(JOBS, key=lambda k: JOBS[k].started_at)
        del JOBS[oldest]
    job = Job(id=uuid.uuid4().hex[:12])
    JOBS[job.id] = job
    return job


def get_job(job_id: str) -> Job | None:
    return JOBS.get(job_id)
