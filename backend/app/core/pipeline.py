"""Composed matching pipeline.

Entry points stay stable while layers evolve underneath:
- queries_for_scene(): Layer 1 rewrites the internals (core/querygen.py).
- rank_scene(): Layer 2 adds the semantic blend, Layer 3 RRF, Layer 4 junk
  filtering — all behind these signatures so the eval harness, services,
  and routers keep working unchanged.
"""
from __future__ import annotations

from typing import Sequence

from .. import ranker
from ..models import MediaAsset


def queries_for_scene(narration: str, max_queries: int = 8) -> list[str]:
    """Search queries for one scene (Layer 1: shape + concept expansion)."""
    from .querygen import generate_queries

    return generate_queries(narration, max_queries=max_queries)


def rank_scene(
    narration: str,
    candidates: Sequence[MediaAsset],
    top_n: int = 12,
) -> list[MediaAsset]:
    """Ranked candidates for one scene (Layer 2+: semantic blend)."""
    return ranker.rank_assets(list(candidates), narration, top_n=top_n)
