"""Reciprocal Rank Fusion over per-(query, provider) ranked lists.

Each list votes 1/(k + rank) for every id it contains; votes sum across
lists. Items appearing in several lists (retrieved by multiple queries or
providers) therefore outrank single-list items. Deterministic.
"""
from __future__ import annotations


def rrf_fuse(ranked_lists: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    for lst in ranked_lists:
        for rank, media_id in enumerate(lst, start=1):
            scores[media_id] = scores.get(media_id, 0.0) + 1.0 / (k + rank)
    fused = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return fused
