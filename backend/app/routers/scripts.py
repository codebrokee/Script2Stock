"""Script + storyboard endpoints."""
from __future__ import annotations

import json

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from .. import jobs
from ..database import get_session
from ..models import (
    Script,
    ScriptCreate,
    StoryboardSave,
    StoryboardSaveCreate,
)
from ..services import (
    provider_status,
    run_generation_job,
    storyboard_state,
)

router = APIRouter(prefix="/api", tags=["scripts"])


@router.get("/providers")
def list_providers() -> dict:
    return {"providers": provider_status()}


@router.post("/scripts", status_code=202)
async def create_script(payload: ScriptCreate) -> dict:
    """Start background storyboard generation.

    Returns immediately with a job id — poll GET /api/jobs/{job_id} for
    live progress. Media failures never fail the job; scenes without
    results simply report 0 assets.
    """
    title = payload.title.strip()
    text = payload.text.strip()
    if not title or not text:
        raise HTTPException(status_code=422, detail="title and text are required")
    job = jobs.create_job()
    asyncio.create_task(run_generation_job(job, title, text))
    return {"job_id": job.id, "status": job.status}


def _job_or_404(job_id: str) -> jobs.Job:
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"job {job_id} not found")
    return job


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str) -> dict:
    return _job_or_404(job_id).to_dict()


@router.delete("/jobs/{job_id}", status_code=202)
def cancel_job(job_id: str) -> dict:
    """Request cancellation. Takes effect at the next safe point (between
    scenes / thumbnail downloads); partial results are kept and viewable."""
    job = _job_or_404(job_id)
    job.cancel_event.set()
    job.paused = False
    if job.status in ("queued", "running"):
        job.stage = "Cancelling…"
    return job.to_dict()


@router.post("/jobs/{job_id}/pause")
def pause_job(job_id: str) -> dict:
    """Pause after the current scene finishes. Resume with /resume."""
    job = _job_or_404(job_id)
    if job.status == "running":
        job.paused = True
        job.stage = "Paused — resume to continue"
    return job.to_dict()


@router.post("/jobs/{job_id}/resume")
def resume_job(job_id: str) -> dict:
    job = _job_or_404(job_id)
    job.paused = False
    return job.to_dict()


@router.get("/scripts/{script_id}/storyboard")
async def get_storyboard(script_id: int, session: Session = Depends(get_session)) -> dict:
    script = session.get(Script, script_id)
    if script is None:
        raise HTTPException(status_code=404, detail=f"script {script_id} not found")
    return storyboard_state(session, script)


@router.post("/storyboards", status_code=201)
def save_storyboard(payload: StoryboardSaveCreate, session: Session = Depends(get_session)) -> dict:
    script = session.get(Script, payload.script_id)
    if script is None:
        raise HTTPException(status_code=404, detail=f"script {payload.script_id} not found")
    row = StoryboardSave(script_id=payload.script_id, state_json=json.dumps(payload.state))
    session.add(row)
    session.commit()
    session.refresh(row)
    return {"id": row.id, "script_id": row.script_id, "state": payload.state,
            "created_at": row.created_at.isoformat()}


@router.get("/storyboards")
def list_saved_storyboards(session: Session = Depends(get_session)) -> dict:
    rows = session.exec(select(StoryboardSave).order_by(StoryboardSave.id.desc())).all()
    items = []
    for r in rows:
        script = session.get(Script, r.script_id)
        try:
            scene_count = len(json.loads(r.state_json).get("scenes", []))
        except Exception:
            scene_count = 0
        items.append({
            "id": r.id,
            "script_id": r.script_id,
            "title": script.title if script else f"Script {r.script_id}",
            "scene_count": scene_count,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })
    return {"storyboards": items}


@router.get("/storyboards/{saved_id}")
def get_saved_storyboard(saved_id: int, session: Session = Depends(get_session)) -> dict:
    row = session.get(StoryboardSave, saved_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"saved storyboard {saved_id} not found")
    try:
        state = json.loads(row.state_json)
    except Exception:
        raise HTTPException(status_code=500, detail=f"saved storyboard {saved_id} is corrupt")
    return {"id": row.id, "script_id": row.script_id, "state": state,
            "created_at": row.created_at.isoformat() if row.created_at else ""}


@router.get("/scripts/{script_id}/exports")
def export_storyboard(script_id: int, session: Session = Depends(get_session)) -> dict:
    script = session.get(Script, script_id)
    if script is None:
        raise HTTPException(status_code=404, detail=f"script {script_id} not found")
    return storyboard_state(session, script)
