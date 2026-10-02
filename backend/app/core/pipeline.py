"""Composed matching pipeline.

Entry points stay stable while layers evolve underneath:
- queries_for_scene(): Layer 1 rewrites the internals (core/querygen.py).
- rank_scene(): Layer 2 adds the semantic blend, Layer 3 RRF, Layer 4 junk
  filtering — all behind these signatures so the eval harness, services,
  and routers keep working unchanged.
"""
from __future__ import annotations

from typing import Sequence

from sqlmodel import Session

from ..config import settings
from ..models import MediaAsset


def queries_for_scene(narration: str, max_queries: int = 8) -> list[str]:
    """Search queries for one scene (Layer 1: shape + concept expansion)."""
    from .querygen import generate_queries

    return generate_queries(narration, max_queries=max_queries)


def fuse_and_rerank(
    narration: str,
    concepts: Sequence[str],
    lists: Sequence[tuple[str, Sequence[MediaAsset]]],
    session: Session | None = None,
    top_n: int = 12,
    multipliers: dict[str, float] | None = None,
) -> list[MediaAsset]:
    """RRF-fuse per-(query, provider) lists, boost by feedback multipliers
    (Layer 6), then semantic-rerank the top 60 (Layer 2 blend)."""
    from . import fusion
    from . import junk
    from .rerank import rerank
    from .. import ranker

    per_list_ids: list[list[str]] = []
    by_id: dict[str, MediaAsset] = {}
    provenance: dict[str, set[str]] = {}
    for query, items in lists:
        items = list(items)
        if not items:
            continue
        kept = [m for m in items if junk.provider_cleanup(m, m.provider)]
        if not kept:
            continue
        ordered = ranker.rank_assets(kept, narration, top_n=len(kept))
        seen_local: set[str] = set()
        ids: list[str] = []
        for m in ordered:
            key = junk.dedup_key(m)
            if key in seen_local:
                continue
            seen_local.add(key)
            ids.append(key)
            by_id.setdefault(key, m)
            provenance.setdefault(key, set()).add(query)
        per_list_ids.append(ids)
    if not by_id:
        return []
    fused = fusion.rrf_fuse(per_list_ids, k=settings.RRF_K)
    if multipliers:
        boosted: list[tuple[str, float]] = []
        for mid, score in fused:
            mults = [multipliers.get(q, 1.0) for q in provenance.get(mid, ())]
            boost = sum(mults) / len(mults) if mults else 1.0
            boosted.append((mid, score * boost))
        boosted.sort(key=lambda kv: kv[1], reverse=True)
        fused = boosted
    top = [by_id[mid] for mid, _ in fused[:60]]
    ranked = rerank(narration, list(concepts), top, session=session, top_n=len(top))
    if multipliers:
        # Persist the feedback boost through the rerank so re-search visibly
        # responds; without this, multipliers could only affect top-60 membership.
        rescored: list[tuple[float, MediaAsset]] = []
        for m in ranked:
            mults = [multipliers.get(q, 1.0) for q in provenance.get(junk.dedup_key(m), ())]
            boost = sum(mults) / len(mults) if mults else 1.0
            rescored.append((m.score * boost, m))
        rescored.sort(key=lambda kv: kv[0], reverse=True)
        for score, item in rescored:
            item.score = score
        ranked = [m for _, m in rescored]
    return ranked[:top_n]


def rank_scene(
    narration: str,
    candidates: Sequence[MediaAsset],
    concepts: Sequence[str] | None = None,
    session: Session | None = None,
    top_n: int = 12,
) -> list[MediaAsset]:
    """Ranked candidates for one scene.

    Flat candidate pools are grouped by provider so the same RRF machinery
    applies; per-(query, provider) callers should use fuse_and_rerank.
    """
    groups: dict[str, list[MediaAsset]] = {}
    for m in candidates:
        groups.setdefault(m.provider, []).append(m)
    lists = [(f"provider:{p}", items) for p, items in groups.items()]
    return fuse_and_rerank(narration, concepts or [], lists, session=session, top_n=top_n)
