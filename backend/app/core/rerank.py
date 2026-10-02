"""Semantic reranking: final = (1-w) * keyword + w * semantic.

keyword_score is the legacy score_asset clamped to [0, 1]; semantic_score is
cosine similarity in [0, 1]; w comes from config (SEMANTIC_WEIGHT, default
0.6). When embeddings are unavailable the blend degrades to keyword-only.
"""
from __future__ import annotations

from typing import Sequence

from sqlmodel import Session

from .. import ranker
from ..config import settings
from ..models import MediaAsset
from ..providers.ai import embeddings


def keyword_scores(narration: str, items: Sequence[MediaAsset]) -> list[float]:
    toks = ranker._tokens(narration or "")
    return [min(1.0, ranker.score_asset(m, toks)) for m in items]


def blend_scores(
    narration: str,
    concepts: Sequence[str],
    items: Sequence[MediaAsset],
    session: Session | None = None,
) -> list[float]:
    kw = keyword_scores(narration, items)
    sem = embeddings.semantic_scores(narration, concepts, items, session=session)
    if sem is None:
        return kw
    w = float(settings.SEMANTIC_WEIGHT)
    return [(1.0 - w) * a + w * b for a, b in zip(kw, sem)]


def rerank(
    narration: str,
    concepts: Sequence[str],
    items: Sequence[MediaAsset],
    session: Session | None = None,
    top_n: int = 12,
) -> list[MediaAsset]:
    if not items:
        return []
    scores = blend_scores(narration, concepts, items, session=session)
    ordered = sorted(zip(scores, list(items)), key=lambda kv: kv[0], reverse=True)
    out: list[MediaAsset] = []
    for score, item in ordered[:top_n]:
        item.score = score
        out.append(item)
    return out
