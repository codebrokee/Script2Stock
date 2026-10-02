"""Wikimedia Commons provider — no API key required."""
from __future__ import annotations

import httpx

from .base import MediaProvider, NormalizedMedia

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "Script2Stock/0.1 (local-first storyboard tool; https://localhost)"


class WikimediaProvider(MediaProvider):
    name = "wikimedia"

    async def search(
        self, query: str, client: httpx.AsyncClient, per_page: int = 6, media_type: str = "any"
    ) -> list[NormalizedMedia]:
        out: list[NormalizedMedia] = []
        try:
            r = await client.get(
                API,
                headers={"User-Agent": USER_AGENT},
                params={
                    "action": "query",
                    "format": "json",
                    "generator": "search",
                    "gsrsearch": query,
                    "gsrnamespace": 6,
                    "gsrlimit": per_page,
                    "prop": "imageinfo",
                    "iiprop": "url|size|extmetadata",
                    "iiurlwidth": 640,
                },
                timeout=15,
            )
            if r.status_code != 200:
                return out
            pages = (r.json().get("query") or {}).get("pages", {}) or {}
            for _pid, p in pages.items():
                infos = p.get("imageinfo", []) or [{}]
                info = infos[0] if infos else {}
                meta = info.get("extmetadata") or {}
                title = p.get("title", "").replace("File:", "")
                thumb = info.get("thumburl") or info.get("url", "")
                full = info.get("url", "")
                lic = (meta.get("LicenseShortName") or {}).get("value", "unknown")
                artist = (meta.get("Artist") or {}).get("value", "")
                license_url = (meta.get("LicenseUrl") or {}).get("value", "")
                is_video = full.lower().endswith((".mp4", ".webm", ".ogv", ".ogg"))
                mtype = "video" if is_video else "image"
                if media_type != "any" and mtype != media_type:
                    continue
                lic_lower = f"{lic}".lower()
                if "cc0" in lic_lower or "public domain" in lic_lower:
                    license_name = "CC0"
                    attrib = False
                elif "cc-by-sa" in lic_lower or "cc-by" in lic_lower:
                    license_name = "CC-BY"
                    attrib = True
                else:
                    license_name = lic or "unknown"
                    attrib = True
                out.append(
                    NormalizedMedia(
                        provider="wikimedia",
                        provider_id=f"file_{p.get('pageid')}",
                        title=title[:200],
                        description=(meta.get("ImageDescription") or {}).get("value", "")[:500],
                        url=f"https://commons.wikimedia.org/wiki/{title.replace(' ', '_')}",
                        download_url=full,
                        thumbnail_url=thumb,
                        media_type=mtype,  # type: ignore[arg-type]
                        width=int(info.get("width", 0) or 0),
                        height=int(info.get("height", 0) or 0),
                        license=license_name,
                        license_url=license_url,
                        creator=artist[:200],
                        attribution_required=attrib,
                    )
                )
        except Exception:
            return out
        return out
