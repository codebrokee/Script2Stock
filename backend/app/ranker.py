"""Ranker: score = keyword_overlap*0.5 + orientation*0.2 + resolution*0.2 + type_pref*0.1.

Deduplicates on (provider, provider_id) and download_url; penalizes dupes.
"""
from __future__ import annotations

import math
import re
from typing import Sequence

from .models import MediaAsset
from .query_generator import STOPWORDS

WORD_RE = re.compile(r"[a-z0-9']+")


def _tokens(text: str) -> set[str]:
    return {w for w in WORD_RE.findall(text.lower()) if w not in STOPWORDS and len(w) > 1}


def keyword_overlap(asset: MediaAsset, scene_tokens: set[str]) -> float:
    if not scene_tokens:
        return 0.0
    asset_tokens = _tokens(f"{asset.title} {asset.description}")
    if not asset_tokens:
        return 0.0
    return len(asset_tokens & scene_tokens) / max(1, len(scene_tokens))


def orientation_match(asset: MediaAsset, preferred: str = "landscape") -> float:
    if not asset.width or not asset.height:
        return 0.5
    is_landscape = asset.width >= asset.height
    if preferred == "landscape":
        return 1.0 if is_landscape else 0.3
    if preferred == "portrait":
        return 1.0 if not is_landscape else 0.3
    return 0.7


def resolution_score(asset: MediaAsset) -> float:
    mp = (asset.width * asset.height) / 1_000_000 if asset.width and asset.height else 0
    # 0 MP -> 0.2, >=8MP -> 1.0, log-ish scale
    if mp <= 0:
        return 0.2
    return min(1.0, 0.2 + 0.8 * (math.log10(1 + mp) / math.log10(9)))


def media_type_preference(asset: MediaAsset, prefer_video: bool = False) -> float:
    is_video = asset.media_type == "video"
    if prefer_video:
        return 1.0 if is_video else 0.6
    return 0.8 if is_video else 1.0  # slight image preference by default? keep neutral-ish
    # spec: media_type_preference * 0.1 — keep deterministic


def score_asset(
    asset: MediaAsset,
    scene_tokens: set[str],
    preferred_orientation: str = "landscape",
    prefer_video: bool = False,
) -> float:
    return (
        keyword_overlap(asset, scene_tokens) * 0.5
        + orientation_match(asset, preferred_orientation) * 0.2
        + resolution_score(asset) * 0.2
        + media_type_preference(asset, prefer_video) * 0.1
    )


def rank_assets(
    assets: Sequence[MediaAsset],
    narration: str,
    preferred_orientation: str = "landscape",
    prefer_video: bool = False,
    top_n: int = 12,
) -> list[MediaAsset]:
    scene_tokens = _tokens(narration or "")
    seen_ids: set[tuple[str, str]] = set()
    seen_urls: set[str] = set()
    scored: list[MediaAsset] = []
    for a in assets:
        key = (a.provider, a.provider_id)
        dupe = key in seen_ids or (a.download_url and a.download_url in seen_urls)
        s = score_asset(a, scene_tokens, preferred_orientation, prefer_video)
        if dupe:
            s -= 0.5  # penalize duplicates
        a.score = s
        seen_ids.add(key)
        if a.download_url:
            seen_urls.add(a.download_url)
        scored.append(a)
    # dedupe: keep first (highest pre-sort?) — sort then drop dupes keeping best
    scored.sort(key=lambda x: x.score, reverse=True)
    deduped: list[MediaAsset] = []
    kept_ids: set[tuple[str, str]] = set()
    kept_urls: set[str] = set()
    for a in scored:
        key = (a.provider, a.provider_id)
        if key in kept_ids:
            continue
        if a.download_url and a.download_url in kept_urls:
            continue
        kept_ids.add(key)
        if a.download_url:
            kept_urls.add(a.download_url)
        deduped.append(a)
    return deduped[:top_n]
