"""Junk filtering and provider hygiene.

Drops watermarked renders, tiny/vector files, wrong-orientation assets, and
merges URL-parameter duplicates — before any ranking spend happens.
"""
from __future__ import annotations

import re

JUNK_PATTERNS = [
    r"watermark",
    r"shutterstock",
    r"istock",
    r"getty images",
    r"dreamstime",
    r"adobe stock",
    r"isolated on white",
    r"white background",
    r"3d render",
    r"\bclipart\b",
    r"\blow resolution\b",
    r"\bsample image\b",
]

_JUNK_RES = [re.compile(p, re.IGNORECASE) for p in JUNK_PATTERNS]

VECTOR_EXTS = (".svg", ".pdf", ".djvu")


def is_junk(media: object) -> bool:
    """True when title/description matches a known junk marker."""
    text = f"{getattr(media, 'title', '')} {getattr(media, 'description', '')}"
    return any(rx.search(text) for rx in _JUNK_RES)


def provider_cleanup(media: object, provider: str = "") -> bool:
    """True when the asset passes provider hygiene (False = drop it)."""
    if is_junk(media):
        return False
    name = (provider or getattr(media, "provider", "") or "").lower()
    width = int(getattr(media, "width", 0) or 0)
    height = int(getattr(media, "height", 0) or 0)
    if name == "wikimedia":
        url = (getattr(media, "download_url", "") or "").lower()
        if url.endswith(VECTOR_EXTS):
            return False
        if width and width < 800:
            return False
    elif name == "pexels":
        if width and height and width <= height:
            return False
    return True


def dedup_key(media: object) -> str:
    """Identity that ignores URL query params (catches ?x=1 vs ?x=2 dupes)."""
    url = (getattr(media, "download_url", "") or "").strip()
    if url:
        return url.split("?")[0].split("#")[0].strip().lower()
    provider = getattr(media, "provider", "")
    provider_id = getattr(media, "provider_id", "")
    return f"{provider}:{provider_id}".lower()
