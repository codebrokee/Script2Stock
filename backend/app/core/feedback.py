"""Feedback loop: user select/reject actions reweight queries on re-search.

Rule: each query starts at 1.0; a select adds +0.5 (cap 2.0), a reject
subtracts 0.25 (floor 0.5). Queries with no feedback default to 1.0 at
apply time. Multipliers feed RRF fusion via pipeline.fuse_and_rerank.
"""
from __future__ import annotations

from sqlmodel import Session, select

from ..models import Feedback, Scene

SELECT_BOOST = 0.5
REJECT_PENALTY = 0.25
MIN_MULTIPLIER = 0.5
MAX_MULTIPLIER = 2.0


def record_feedback(
    session: Session,
    scene_id: int,
    media_id: int,
    action: str,
    query_used: str = "",
) -> None:
    session.add(Feedback(scene_id=scene_id, media_id=media_id, action=action,
                         query_used=(query_used or "").strip().lower()))
    session.commit()


def _top_query(session: Session, scene_id: int) -> str:
    from ..models import SearchQuery

    row = session.exec(
        select(SearchQuery).where(SearchQuery.scene_id == scene_id).order_by(SearchQuery.rank)
    ).first()
    return row.query if row else ""


def record_scene_feedback(session: Session, scene_id: int, media_id: int, action: str) -> None:
    """Record select/reject against the scene's top-ranked query."""
    record_feedback(session, scene_id, media_id, action, _top_query(session, scene_id))


def reweight_queries(session: Session, script_id: int) -> dict[str, float]:
    """Per-query multipliers in [0.5, 2.0] from this script's feedback."""
    scene_ids = [s.id for s in session.exec(select(Scene).where(Scene.script_id == script_id)).all()]
    if not scene_ids:
        return {}
    rows = session.exec(select(Feedback).where(Feedback.scene_id.in_(scene_ids))).all()
    mults: dict[str, float] = {}
    for r in rows:
        q = (r.query_used or "").strip().lower()
        if not q:
            continue
        m = mults.get(q, 1.0)
        m = m + SELECT_BOOST if r.action == "select" else m - REJECT_PENALTY
        mults[q] = max(MIN_MULTIPLIER, min(MAX_MULTIPLIER, m))
    return mults
