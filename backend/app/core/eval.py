"""Matching eval: golden fixtures, metrics, CSV harness with a regression gate.

Deterministic and offline: candidates are built from fixed templates, so
every layer is measured against the identical candidate pool.
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Callable, Sequence

from ..models import MediaAsset

GOLDEN_DIR = Path(__file__).resolve().parent.parent.parent / "tests" / "golden"
SCENES_PATH = GOLDEN_DIR / "scenes.json"
CSV_PATH = GOLDEN_DIR / "results.csv"

TOP_K = 5
REGRESSION_TOLERANCE = 0.05

TOKEN_RE = re.compile(r"[a-z0-9']+")

NEUTRAL_TITLES = [
    "morning light over hills valley",
    "people walking in a busy street market",
    "close up of hands holding cup",
    "aerial view of river bend",
    "empty room with window light",
]
NEUTRAL_SIZES = [(1920, 1080), (1280, 720), (1080, 1920), (640, 480), (1920, 1080)]


def load_scenes() -> list[dict]:
    with open(SCENES_PATH, encoding="utf-8") as f:
        return json.load(f)


def _hit(text: str, keywords: Sequence[str]) -> bool:
    lowered = text.lower()
    tokens = set(TOKEN_RE.findall(lowered))
    for kw in keywords:
        kw = kw.lower().strip()
        if not kw:
            continue
        if " " in kw:
            if kw in lowered:
                return True
        elif kw in tokens:
            return True
    return False


def is_relevant(item: MediaAsset, acceptable: Sequence[str], forbidden: Sequence[str]) -> bool:
    text = f"{item.title} {item.description}"
    return _hit(text, acceptable) and not _hit(text, forbidden)


def contains_forbidden(item: MediaAsset, forbidden: Sequence[str]) -> bool:
    return _hit(f"{item.title} {item.description}", forbidden)


def precision_at_k(ranked: Sequence[MediaAsset], scene: dict, k: int = TOP_K) -> float:
    top = list(ranked)[:k]
    if not top:
        return 0.0
    hits = sum(1 for m in top if is_relevant(m, scene["acceptable_keywords"], scene["forbidden_keywords"]))
    return hits / len(top)


def hit_rate(ranked: Sequence[MediaAsset], scene: dict, k: int = TOP_K) -> float:
    return 1.0 if any(is_relevant(m, scene["acceptable_keywords"], scene["forbidden_keywords"]) for m in list(ranked)[:k]) else 0.0


def forbidden_rate(ranked: Sequence[MediaAsset], scene: dict, k: int = TOP_K) -> float:
    top = list(ranked)[:k]
    if not top:
        return 0.0
    bad = sum(1 for m in top if contains_forbidden(m, scene["forbidden_keywords"]))
    return bad / len(top)


def simple_tag(title: str) -> str:
    """Fallback coarse tag: first content word (Layer 5 swaps in the real tagger)."""
    from ..query_generator import STOPWORDS

    for w in TOKEN_RE.findall(title.lower()):
        if w not in STOPWORDS and len(w) > 2:
            return w
    return "misc"


def diversity_score(tags: Sequence[str]) -> float:
    if not tags:
        return 0.0
    return len(set(tags)) / len(tags)


def build_candidates(scene: dict, scene_idx: int) -> list[MediaAsset]:
    """Deterministic candidate pool: 3 good, 2 junk-marked bad, 5 neutral."""
    acc = scene["acceptable_keywords"]
    forb = scene["forbidden_keywords"]
    out: list[MediaAsset] = []

    def mk(**kw: object) -> MediaAsset:
        base = dict(scene_id=0, provider="wikimedia", provider_id=f"eval_{scene_idx}_{len(out)}",
                    media_type="image", width=1920, height=1080)
        base.update(kw)  # type: ignore[typeddict-item]
        return MediaAsset(**base)  # type: ignore[arg-type]

    for i in range(3):
        kw1 = acc[i % len(acc)]
        kw2 = acc[(i + 1) % len(acc)]
        out.append(mk(title=f"{kw1} {kw2} landscape photo",
                      description=f"stock photo of {kw1}",
                      download_url=f"https://cdn.example.com/{scene_idx}/good{i}.jpg"))
    forb0 = forb[0] if forb else "unrelated"
    forb1 = forb[1] if len(forb) > 1 else forb0
    out.append(mk(provider="wikimedia", title=f"{forb0} watermark 3d render",
                  description=f"low quality {forb0} preview", width=400, height=300,
                  download_url=f"https://upload.example.com/{scene_idx}/bad.svg"))
    out.append(mk(provider="pexels", title=f"{forb1} isolated on white background clipart",
                  description="", width=720, height=1280,
                  download_url=f"https://images.example.com/{scene_idx}/bad.jpg"))
    for i, title in enumerate(NEUTRAL_TITLES):
        w, h = NEUTRAL_SIZES[i]
        url = f"https://cdn.example.com/shared.jpg?x={scene_idx}{i}" if i >= 3 else f"https://cdn.example.com/{scene_idx}/n{i}.jpg"
        out.append(mk(title=title, description="", width=w, height=h, download_url=url))
    return out


RankFn = Callable[[str, Sequence[MediaAsset]], Sequence[MediaAsset]]


def evaluate(rank_fn: RankFn, scenes: list[dict], k: int = TOP_K) -> dict[str, float]:
    precisions: list[float] = []
    hits: list[float] = []
    forbiddens: list[float] = []
    tags: list[str] = []
    for idx, scene in enumerate(scenes):
        ranked = list(rank_fn(scene["narration"], build_candidates(scene, idx)))[:k]
        precisions.append(precision_at_k(ranked, scene, k))
        hits.append(hit_rate(ranked, scene, k))
        forbiddens.append(forbidden_rate(ranked, scene, k))
        if ranked:
            tags.append(simple_tag(ranked[0].title))
    n = max(1, len(scenes))
    return {
        "precision_at_k": sum(precisions) / n,
        "hit_rate": sum(hits) / n,
        "forbidden_rate": sum(forbiddens) / n,
        "diversity": diversity_score(tags),
    }


def read_rows() -> list[dict[str, str]]:
    if not CSV_PATH.exists():
        return []
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def append_row(layer: str, metrics: dict[str, float]) -> tuple[bool, str]:
    """Append a results row. Returns (ok, message); ok=False on >5% regression."""
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    rows = read_rows()
    msg = "first measurement (no baseline to compare)"
    ok = True
    if rows:
        prev = rows[-1]
        for key in ("precision_at_k", "hit_rate"):
            drop = float(prev[key]) - metrics[key]
            if drop > REGRESSION_TOLERANCE:
                ok = False
                msg = f"REGRESSION: {key} dropped {drop:.3f} vs {prev['layer']} (>0.05)"
                break
        else:
            msg = f"no regression vs {prev['layer']}"
    fieldnames = ["layer", "precision_at_k", "hit_rate", "forbidden_rate", "diversity"]
    write_header = not CSV_PATH.exists()
    with open(CSV_PATH, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        if write_header:
            w.writeheader()
        w.writerow({"layer": layer, **{k: f"{v:.4f}" for k, v in metrics.items()}})
    return ok, msg
