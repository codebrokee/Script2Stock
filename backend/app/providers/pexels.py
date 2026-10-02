"""Pexels provider (images + videos). Requires PEXELS_API_KEY."""
from __future__ import annotations

import httpx

from ..config import settings
from .base import MediaProvider, NormalizedMedia


class PexelsProvider(MediaProvider):
    name = "pexels"

    def __init__(self, api_key: str = "") -> None:
        self.api_key = api_key or settings.PEXELS_API_KEY

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict[str, str]:
        return {"Authorization": self.api_key}

    async def search(
        self, query: str, client: httpx.AsyncClient, per_page: int = 6, media_type: str = "any"
    ) -> list[NormalizedMedia]:
        if not self.is_configured:
            return []
        out: list[NormalizedMedia] = []
        try:
            if media_type in ("any", "image"):
                r = await client.get(
                    "https://api.pexels.com/v1/search",
                    headers=self._headers(),
                    params={"query": query, "per_page": per_page},
                    timeout=15,
                )
                if r.status_code == 200:
                    for p in r.json().get("photos", []):
                        src = p.get("src", {})
                        out.append(
                            NormalizedMedia(
                                provider="pexels",
                                provider_id=f"img_{p.get('id')}",
                                title=p.get("alt") or f"Pexels photo {p.get('id')}",
                                description=p.get("alt") or "",
                                url=p.get("url", ""),
                                download_url=src.get("original") or src.get("large2x") or "",
                                thumbnail_url=src.get("medium") or src.get("small") or "",
                                media_type="image",
                                width=int(p.get("width", 0) or 0),
                                height=int(p.get("height", 0) or 0),
                                license="commercial-free",
                                license_url="https://www.pexels.com/license/",
                                creator=(p.get("photographer") or ""),
                            )
                        )
            if media_type in ("any", "video"):
                r = await client.get(
                    "https://api.pexels.com/videos/search",
                    headers=self._headers(),
                    params={"query": query, "per_page": per_page},
                    timeout=15,
                )
                if r.status_code == 200:
                    for v in r.json().get("videos", []):
                        files = v.get("video_files", []) or []
                        best = max(files, key=lambda f: (f.get("width", 0) or 0), default=None)
                        preview = v.get("image", "")
                        out.append(
                            NormalizedMedia(
                                provider="pexels",
                                provider_id=f"vid_{v.get('id')}",
                                title=f"Pexels video {v.get('id')}",
                                description="",
                                url=v.get("url", ""),
                                download_url=(best or {}).get("link", ""),
                                thumbnail_url=preview,
                                media_type="video",
                                width=int((best or {}).get("width", 0) or 0),
                                height=int((best or {}).get("height", 0) or 0),
                                duration=float(v.get("duration", 0) or 0),
                                license="commercial-free",
                                license_url="https://www.pexels.com/license/",
                                creator=(v.get("user") or {}).get("name", ""),
                            )
                        )
        except Exception:
            return out
        return out
