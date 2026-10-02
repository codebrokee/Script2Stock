"""SQLite-backed API response cache with TTL + thumbnail caching."""
from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
from sqlmodel import Session

from .config import settings
from .models import ApiCache


def cache_key(provider: str, endpoint: str, params: dict[str, Any]) -> str:
    raw = json.dumps({"p": provider, "e": endpoint, "q": params}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def cache_get(session: Session, key: str) -> Optional[Any]:
    row = session.get(ApiCache, key)
    if row is None:
        return None
    age = (datetime.now(timezone.utc) - row.created_at).total_seconds()
    if age > row.ttl_seconds:
        session.delete(row)
        session.commit()
        return None
    try:
        return json.loads(row.response_json)
    except Exception:
        return None


def cache_set(session: Session, key: str, payload: Any, ttl_seconds: int) -> None:
    row = session.get(ApiCache, key)
    data = json.dumps(payload, default=str)
    if row is None:
        session.add(ApiCache(key=key, response_json=data, ttl_seconds=ttl_seconds))
    else:
        row.response_json = data
        row.created_at = datetime.now(timezone.utc)
        row.ttl_seconds = ttl_seconds
    session.commit()


async def fetch_thumbnail(url: str, dest_name: str) -> str:
    """Download thumbnail to disk (non-fatal). Returns relative path or ''."""
    if not url:
        return ""
    thumb_dir = Path(settings.THUMBNAIL_DIR)
    thumb_dir.mkdir(parents=True, exist_ok=True)
    safe = hashlib.sha256(url.encode()).hexdigest()[:16]
    ext = ".jpg"
    for cand in (".jpg", ".jpeg", ".png", ".webp"):
        if url.lower().split("?")[0].endswith(cand):
            ext = ".jpg" if cand == ".jpeg" else cand
            break
    dest = thumb_dir / f"{dest_name}_{safe}{ext}"
    if dest.exists():
        return f"/thumbnails/{dest.name}"
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(url)
            if r.status_code == 200 and r.content:
                await asyncio.to_thread(dest.write_bytes, r.content)
                return f"/thumbnails/{dest.name}"
    except Exception:
        pass
    return ""
