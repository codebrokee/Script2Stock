"""Local sentence embeddings (all-MiniLM-L6-v2) with SQLite caching.

Graceful fallback: if sentence-transformers (or torch) cannot be imported,
every function returns None and the pipeline falls back to keyword-only
scoring. Embeddings are cached in the ``embedding_cache`` table keyed by
model + text hash — the same string is never embedded twice.
"""
from __future__ import annotations

import hashlib
from typing import Sequence

import numpy as np
from sqlmodel import Session

from ...config import DATA_DIR, settings
from ...models import EmbeddingCache

MODEL_DIR = DATA_DIR / "models"

_model: object = None
_model_failed = False


def _get_model() -> object | None:
    global _model, _model_failed
    if _model is not None or _model_failed:
        return _model
    try:
        from sentence_transformers import SentenceTransformer

        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        _model = SentenceTransformer(settings.EMBEDDING_MODEL, cache_folder=str(MODEL_DIR))
        return _model
    except Exception:
        _model_failed = True
        return None


def is_available() -> bool:
    return _get_model() is not None


def encode(texts: Sequence[str]) -> np.ndarray | None:
    """L2-normalized embeddings for a batch, or None when unavailable."""
    model = _get_model()
    if model is None or not texts:
        return None
    try:
        vecs = model.encode(list(texts), normalize_embeddings=True, show_progress_bar=False)  # type: ignore[attr-defined]
        return np.asarray(vecs, dtype=np.float32)
    except Exception:
        return None


def _hash(text: str) -> str:
    return hashlib.sha256(f"{settings.EMBEDDING_MODEL}::{text}".encode()).hexdigest()


def cached_encode(session: Session, text: str) -> np.ndarray | None:
    """Single embedding via the SQLite cache, or None when unavailable."""
    key = _hash(text)
    row = session.get(EmbeddingCache, key)
    if row is not None:
        try:
            return np.frombuffer(row.vector, dtype=np.float32)
        except Exception:
            pass
    vecs = encode([text])
    if vecs is None:
        return None
    vec = np.asarray(vecs[0], dtype=np.float32)
    try:
        session.add(EmbeddingCache(text_hash=key, text=text[:500], vector=vec.tobytes(),
                                   model=settings.EMBEDDING_MODEL))
        session.commit()
    except Exception:
        session.rollback()
    return vec


def _renorm(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v if n == 0 else v / n


def semantic_scores(
    scene_text: str,
    scene_concepts: Sequence[str],
    media_items: Sequence[object],
    session: Session | None = None,
) -> list[float] | None:
    """Cosine similarity of each item to the scene, in [0, 1].

    Scene embedding = mean of narration + concept embeddings (renormalized).
    Media embedding = title + description. Returns None when embeddings are
    unavailable OR there is nothing to score, so callers fall back cleanly.
    """
    from ...models import MediaAsset

    items: list[MediaAsset] = list(media_items)  # type: ignore[assignment]
    if not items:
        return []
    scene_parts = [scene_text, *(scene_concepts or [])]
    if session is None:
        vecs = encode(scene_parts)
        if vecs is None:
            return None
        scene_vec = _renorm(vecs.mean(axis=0))
        media_texts = [(f"{m.title} {m.description}".strip() or m.provider) for m in items]
        mvecs = encode(media_texts)
        if mvecs is None:
            return None
    else:
        parts = [cached_encode(session, t) for t in scene_parts]
        if any(p is None for p in parts):
            return None
        scene_vec = _renorm(np.mean(np.stack(parts), axis=0))  # type: ignore[arg-type]
        mvecs_list = []
        for m in items:
            v = cached_encode(session, (f"{m.title} {m.description}".strip() or m.provider))
            if v is None:
                return None
            mvecs_list.append(v)
        mvecs = np.stack(mvecs_list)
    sims = (mvecs @ scene_vec).tolist()
    return [max(0.0, min(1.0, float(s))) for s in sims]
