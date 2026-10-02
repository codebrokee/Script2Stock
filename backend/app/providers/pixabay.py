"""Pixabay provider (images + videos). Requires PIXABAY_API_KEY."""
from __future__ import annotations

import httpx

from ..config import settings
from .base import MediaProvider, NormalizedMedia


class PixabayProvider(MediaProvider):
    name = "pixabay"

    def __init__(self, api_key: str = "") -> None:
        self.api_key = api_key or settings.PIXABAY_API_KEY

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def search(
        self, query: str, client: httpx.AsyncClient, per_page: int = 6, media_type: str = "any"
    ) -> list[NormalizedMedia]:
        if not self.is_configured:
            return []
        out: list[NormalizedMedia] = []
        try:
            if media_type in ("any", "image"):
                r = await client.get(
                    "https://pixabay.com/api/",
                    params={
                        "key": self.api_key,
                        "q": query,
                        "per_page": per_page,
                        "image_type": "photo",
                        "safesearch": "true",
                    },
                    timeout=15,
                )
                if r.status_code == 200:
                    for h in r.json().get("hits", []):
                        out.append(
                            NormalizedMedia(
                                provider="pixabay",
                                provider_id=f"img_{h.get('id')}",
                                title=(h.get("tags") or f"Pixabay photo {h.get('id')}")[:200],
                                description=h.get("tags") or "",
                                url=h.get("pageURL", ""),
                                download_url=h.get("largeImageURL") or h.get("webformatURL", ""),
                                thumbnail_url=h.get("previewURL") or h.get("webformatURL", ""),
                                media_type="image",
                                width=int(h.get("imageWidth", 0) or 0),
                                height=int(h.get("imageHeight", 0) or 0),
                                license="commercial-free",
                                license_url="https://pixabay.com/service/license/",
                                creator=h.get("user") or "",
                            )
                        )
            if media_type in ("any", "video"):
                r = await client.get(
                    "https://pixabay.com/api/videos/",
                    params={"key": self.api_key, "q": query, "per_page": per_page, "safesearch": "true"},
                    timeout=15,
                )
                if r.status_code == 200:
                    for h in r.json().get("hits", []):
                        videos = (h.get("videos") or {})
                        best = videos.get("large") or videos.get("medium") or videos.get("small") or {}
                        out.append(
                            NormalizedMedia(
                                provider="pixabay",
                                provider_id=f"vid_{h.get('id')}",
                                title=(h.get("tags") or f"Pixabay video {h.get('id')}")[:200],
                                description=h.get("tags") or "",
                                url=h.get("pageURL", ""),
                                download_url=best.get("url", ""),
                                thumbnail_url=h.get("previewURL") or h.get("userImageURL", ""),
                                media_type="video",
                                width=int(best.get("width", 0) or 0),
                                height=int(best.get("height", 0) or 0),
                                duration=float(h.get("duration", 0) or 0),
                                license="commercial-free",
                                license_url="https://pixabay.com/service/license/",
                                creator=h.get("user") or "",
                            )
                        )
        except Exception:
            return out
        return out
