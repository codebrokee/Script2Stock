"""Storyboard-level diversity: avoid five forest clips in a row.

coarse_tag() labels each asset with its top noun (spaCy, regex fallback).
diverse_rank() walks scenes in order and discounts each candidate by
1/(1+n) where n = times its tag already topped a previous scene.
enforce_ratio() nudges each scene's top_n toward the target video share.
"""
from __future__ import annotations

import re
from typing import Sequence

from ..models import MediaAsset
from ..query_generator import STOPWORDS, WORD_RE, _get_nlp

TAG_RE = re.compile(r"[A-Za-z][A-Za-z0-9'\-]*")


def coarse_tag(media: MediaAsset) -> str:
    """Top noun of the title: spaCy noun head, else first meaningful word."""
    title = (media.title or "").strip()
    if not title:
        return "misc"
    nlp = _get_nlp()
    if nlp is not None:
        try:
            doc = nlp(title)  # type: ignore[attr-defined]
            for tok in doc:
                if tok.pos_ == "NOUN" and tok.text.lower() not in STOPWORDS:
                    return tok.lemma_.lower()
        except Exception:
            pass
    for w in TAG_RE.findall(title.lower()):
        if w not in STOPWORDS and len(w) > 2:
            return w
    return "misc"


def diverse_rank(scenes_media: Sequence[Sequence[MediaAsset]]) -> list[list[MediaAsset]]:
    """Rescore each scene with a repetition penalty from prior top picks."""
    tag_counts: dict[str, int] = {}
    out: list[list[MediaAsset]] = []
    for items in scenes_media:
        rescored: list[tuple[float, MediaAsset]] = []
        for m in items:
            tag = coarse_tag(m)
            penalty = 1.0 / (1.0 + tag_counts.get(tag, 0))
            rescored.append((m.score * penalty, m))
        rescored.sort(key=lambda kv: kv[0], reverse=True)
        for score, m in rescored:
            m.score = score
        if rescored:
            tag_counts[coarse_tag(rescored[0][1])] = tag_counts.get(coarse_tag(rescored[0][1]), 0) + 1
        out.append([m for _, m in rescored])
    return out


def enforce_ratio(
    scenes_media: Sequence[Sequence[MediaAsset]],
    target_video_ratio: float = 0.6,
    top_n: int = 12,
) -> list[list[MediaAsset]]:
    """Reorder each scene's top_n toward target_video_ratio videos (stable)."""
    out: list[list[MediaAsset]] = []
    for items in scenes_media:
        ranked = sorted(items, key=lambda m: m.score, reverse=True)
        top = ranked[:top_n]
        rest = ranked[top_n:]
        want = round(len(top) * target_video_ratio)
        have = sum(1 for m in top if m.media_type == "video")
        pool = sorted(rest, key=lambda m: m.score, reverse=True)
        while have < want:
            swap = next((m for m in pool if m.media_type == "video"), None)
            victim = next((m for m in reversed(top) if m.media_type != "video"), None)
            if swap is None or victim is None:
                break
            top[top.index(victim)] = swap
            pool.remove(swap)
            have += 1
        while have > want:
            swap = next((m for m in pool if m.media_type != "video"), None)
            victim = next((m for m in reversed(top) if m.media_type == "video"), None)
            if swap is None or victim is None:
                break
            top[top.index(victim)] = swap
            pool.remove(swap)
            have -= 1
        out.append(sorted(top, key=lambda m: m.score, reverse=True))
    return out
