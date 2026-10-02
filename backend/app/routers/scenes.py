"""Scene media endpoints: search, select, reject."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..database import get_session
from ..core import feedback
from ..models import MediaAsset, Scene
from ..services import manual_search, scene_to_read

router = APIRouter(prefix="/api", tags=["scenes"])


def _scene_or_404(session: Session, scene_id: int) -> Scene:
    scene = session.get(Scene, scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail=f"scene {scene_id} not found")
    return scene


@router.get("/scenes/{scene_id}/search")
async def search_scene(
    scene_id: int,
    q: str = Query(min_length=1, max_length=300),
    session: Session = Depends(get_session),
) -> dict:
    scene = _scene_or_404(session, scene_id)
    try:
        assets = await manual_search(session, scene, q)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"provider search failed: {exc}")
    if not assets:
        return {"scene_id": scene_id, "query": q, "media": [], "message": "No media found — try manual search"}
    return {"scene_id": scene_id, "query": q,
            "media": [a.model_dump() for a in sorted(assets, key=lambda x: x.score, reverse=True)]}


@router.post("/scenes/{scene_id}/media/{asset_id}/select")
def select_media(scene_id: int, asset_id: int, session: Session = Depends(get_session)) -> dict:
    scene = _scene_or_404(session, scene_id)
    asset = session.get(MediaAsset, asset_id)
    if asset is None or asset.scene_id != scene.id:
        raise HTTPException(status_code=404, detail=f"asset {asset_id} not found in scene {scene_id}")
    asset.status = "selected"
    session.add(asset)
    session.commit()
    feedback.record_scene_feedback(session, scene.id, asset.id, "select")
    session.refresh(asset)
    return {"ok": True, "asset": asset.model_dump()}


@router.post("/scenes/{scene_id}/media/{asset_id}/reject")
def reject_media(scene_id: int, asset_id: int, session: Session = Depends(get_session)) -> dict:
    scene = _scene_or_404(session, scene_id)
    asset = session.get(MediaAsset, asset_id)
    if asset is None or asset.scene_id != scene.id:
        raise HTTPException(status_code=404, detail=f"asset {asset_id} not found in scene {scene_id}")
    asset.status = "rejected"
    session.add(asset)
    session.commit()
    feedback.record_scene_feedback(session, scene.id, asset.id, "reject")
    session.refresh(asset)
    return {"ok": True, "asset": asset.model_dump()}
