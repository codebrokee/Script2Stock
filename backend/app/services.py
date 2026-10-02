"""Orchestration: script -> scenes -> queries -> provider search -> rank -> persist."""
from __future__ import annotations

import asyncio
from collections.abc import Callable

import httpx
from sqlmodel import Session, select

from . import scene_splitter
from .core import pipeline as matching
from .cache import cache_get, cache_key, cache_set, fetch_thumbnail
from .config import settings
from .jobs import Job, JobCancelled
from .models import MediaAsset, Scene, Script, SearchQuery
from .providers.base import MediaProvider, NormalizedMedia
from .providers.pexels import PexelsProvider
from .providers.pixabay import PixabayProvider
from .providers.wikimedia import WikimediaProvider


def get_providers() -> list[MediaProvider]:
    return [PexelsProvider(), PixabayProvider(), WikimediaProvider()]


def provider_status() -> list[dict[str, object]]:
    out = []
    for p in get_providers():
        out.append({"name": p.name, "configured": p.is_configured})
    return out


def create_script_with_scenes(session: Session, title: str, text: str) -> tuple[Script, list[Scene]]:
    script = Script(title=title, text=text)
    session.add(script)
    session.commit()
    session.refresh(script)
    chunks = scene_splitter.split_script(text)
    scenes: list[Scene] = []
    for idx, ch in enumerate(chunks):
        sc = Scene(
            script_id=script.id, index=idx, narration=ch.narration,
            start_char=ch.start_char, end_char=ch.end_char,
        )
        session.add(sc)
        scenes.append(sc)
    session.commit()
    for sc in scenes:
        session.refresh(sc)
        queries = matching.queries_for_scene(sc.narration)
        for rank, q in enumerate(queries):
            session.add(SearchQuery(scene_id=sc.id, query=q, rank=rank))
    session.commit()
    return script, scenes


def _ttl_for(provider_name: str) -> int:
    if provider_name == "pixabay":
        return settings.CACHE_TTL_PIXABAY
    return settings.CACHE_TTL_DEFAULT


async def _cached_provider_search(
    session: Session,
    provider: MediaProvider,
    query: str,
    client: httpx.AsyncClient,
    per_page: int,
) -> list[NormalizedMedia]:
    """Check SQLite cache before ANY external call; store with TTL."""
    key = cache_key(provider.name, "search", {"q": query, "n": per_page})
    cached = cache_get(session, key)
    if cached is not None:
        return [NormalizedMedia(**item) for item in cached]
    if not provider.is_configured:
        return []
    results = await provider.search(query, client, per_page=per_page)
    if results:
        payload = [r.__dict__ for r in results]
        cache_set(session, key, payload, _ttl_for(provider.name))
    return results


def _to_asset(scene_id: int, n: NormalizedMedia) -> MediaAsset:
    return MediaAsset(
        scene_id=scene_id, provider=n.provider, provider_id=n.provider_id,
        title=n.title, description=n.description, url=n.url,
        download_url=n.download_url, thumbnail_url=n.thumbnail_url,
        media_type=n.media_type, width=n.width, height=n.height,
        duration=n.duration, license=n.license, license_url=n.license_url,
        creator=n.creator, attribution_required=n.attribution_required,
    )


async def populate_media_for_scene(
    session: Session,
    scene: Scene,
    per_query: int = 3,
    max_queries: int = 3,
    on_stage: Callable[[str], None] | None = None,
    is_cancelled: Callable[[], bool] | None = None,
) -> list[MediaAsset]:
    rows = session.exec(select(SearchQuery).where(SearchQuery.scene_id == scene.id).order_by(SearchQuery.rank)).all()
    queries = [r.query for r in rows[:max_queries]] or [scene.narration[:80]]
    providers = get_providers()
    grouped: dict[tuple[str, str], list[NormalizedMedia]] = {}
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        for qi, q in enumerate(queries):
            if is_cancelled and is_cancelled():
                raise JobCancelled(f"cancelled during scene {scene.index}")
            if on_stage:
                on_stage(f"query {qi + 1}/{len(queries)} — searching {len(providers)} providers")
            results = await asyncio.gather(
                *[_cached_provider_search(session, p, q, client, per_query) for p in providers],
                return_exceptions=True,
            )
            for p, res in zip(providers, results):
                if isinstance(res, Exception):
                    continue
                grouped.setdefault((q, p.name), []).extend(res)
    lists = [(q, [_to_asset(scene.id, n) for n in items]) for (q, _p), items in grouped.items() if items]
    if on_stage:
        on_stage(f"fusing {len(lists)} ranked lists")
    ranked = matching.fuse_and_rerank(scene.narration, queries, lists, session=session, top_n=12)
    # cache thumbnails to disk (best-effort)
    for i, a in enumerate(ranked):
        if is_cancelled and is_cancelled():
            raise JobCancelled(f"cancelled during scene {scene.index}")
        try:
            a.cached_thumbnail = await fetch_thumbnail(a.thumbnail_url, f"s{scene.id}_{i}")
        except Exception:
            a.cached_thumbnail = ""
        if on_stage and (i == 0 or (i + 1) == len(ranked) or (i + 1) % 4 == 0):
            on_stage(f"caching thumbnails ({i + 1}/{len(ranked)})")    # replace existing candidates for scene
    existing = session.exec(select(MediaAsset).where(MediaAsset.scene_id == scene.id)).all()
    keep = {(m.provider, m.provider_id): m for m in existing if m.status in ("selected", "rejected")}
    for m in existing:
        session.delete(m)
    session.commit()
    for a in ranked:
        k = (a.provider, a.provider_id)
        if k in keep:
            a.status = keep[k].status
        session.add(a)
    session.commit()
    return session.exec(select(MediaAsset).where(MediaAsset.scene_id == scene.id).order_by(MediaAsset.score.desc())).all()


async def manual_search(session: Session, scene: Scene, q: str, per_page: int = 4) -> list[MediaAsset]:
    providers = get_providers()
    grouped: dict[str, list[NormalizedMedia]] = {}
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        results = await asyncio.gather(
            *[_cached_provider_search(session, p, q, client, per_page) for p in providers],
            return_exceptions=True,
        )
        for p, res in zip(providers, results):
            if isinstance(res, Exception):
                continue
            grouped.setdefault(p.name, []).extend(res)
    lists = [(q, [_to_asset(scene.id, n) for n in items]) for _p, items in grouped.items() if items]
    ranked = matching.fuse_and_rerank(q + " " + scene.narration, [q], lists, session=session, top_n=12)
    for i, a in enumerate(ranked):
        try:
            a.cached_thumbnail = await fetch_thumbnail(a.thumbnail_url, f"manual_{scene.id}_{i}")
        except Exception:
            a.cached_thumbnail = ""
    for a in ranked:
        dup = session.exec(
            select(MediaAsset).where(
                MediaAsset.scene_id == scene.id,
                MediaAsset.provider == a.provider,
                MediaAsset.provider_id == a.provider_id,
            )
        ).first()
        if dup is None:
            session.add(a)
    session.commit()
    return session.exec(
        select(MediaAsset).where(MediaAsset.scene_id == scene.id).order_by(MediaAsset.score.desc())
    ).all()


def scene_to_read(session: Session, scene: Scene) -> dict:
    queries = session.exec(
        select(SearchQuery).where(SearchQuery.scene_id == scene.id).order_by(SearchQuery.rank)
    ).all()
    media = session.exec(
        select(MediaAsset).where(MediaAsset.scene_id == scene.id).order_by(MediaAsset.score.desc())
    ).all()
    return {
        "id": scene.id, "script_id": scene.script_id, "index": scene.index,
        "narration": scene.narration, "start_char": scene.start_char, "end_char": scene.end_char,
        "queries": [q.query for q in queries],
        "media": [m.model_dump() for m in media],
    }


def storyboard_state(session: Session, script: Script) -> dict:
    scenes = session.exec(select(Scene).where(Scene.script_id == script.id).order_by(Scene.index)).all()
    return {
        "id": script.id, "title": script.title, "text": script.text,
        "created_at": script.created_at.isoformat() if script.created_at else "",
        "scenes": [scene_to_read(session, s) for s in scenes],
        "providers": provider_status(),
    }


def _new_session() -> Session:
    """Fresh DB session for background workers (monkeypatchable in tests)."""
    from .database import engine as _engine

    return Session(_engine)


async def run_generation_job(job: Job, title: str, text: str) -> None:
    """Background worker: create script + scenes, then populate media scene by scene.

    Updates the job with fine-grained progress. Cancellation and pause take
    effect between scenes (and between thumbnail downloads within a scene).
    Partial results are always kept, so a cancelled job still yields a
    viewable storyboard via job.script_id.
    """
    def _cancelled() -> bool:
        return job.cancel_event.is_set()

    with _new_session() as session:
        try:
            job.status = "running"
            job.stage = "Splitting script into scenes…"
            script, scenes = create_script_with_scenes(session, title, text)
            job.script_id = script.id
            job.total_scenes = len(scenes)
            job.scenes = [{"index": s.index, "status": "pending", "media": 0} for s in scenes]
            for sc in scenes:
                job.throw_if_cancelled()
                await job.wait_if_paused()

                def _emit(msg: str, _idx: int = sc.index, _n: int = len(scenes)) -> None:
                    job.stage = f"Scene {_idx + 1}/{_n}: {msg}"

                job.scenes[sc.index]["status"] = "active"
                job.stage = f"Scene {sc.index + 1}/{len(scenes)}: searching providers…"
                assets = await populate_media_for_scene(
                    session, sc, on_stage=_emit, is_cancelled=_cancelled,
                )
                job.scenes[sc.index]["status"] = "done"
                job.scenes[sc.index]["media"] = len(assets)
                job.done_scenes += 1
                job.media_found += len(assets)
                job.stage = f"Scene {sc.index + 1}/{len(scenes)} done — {len(assets)} assets"
            try:
                job.stage = "Balancing storyboard diversity…"
                matching.apply_board_diversity(session, script.id)
            except Exception as exc:
                print(f"board diversity failed (non-fatal): {exc}")
            job.status = "done"
            job.stage = f"Done — {job.done_scenes} scenes, {job.media_found} assets"
        except JobCancelled:
            job.status = "cancelled"
            job.stage = "Cancelled — partial results kept"
        except Exception as exc:
            job.status = "error"
            job.error = str(exc)
            job.stage = f"Failed: {exc}"
