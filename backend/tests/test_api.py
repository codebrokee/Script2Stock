"""API + cache + job tests."""
import asyncio
import time

from app.cache import cache_key, cache_set, cache_get
from app.models import MediaAsset, Scene, Script


def test_cache_roundtrip_and_expiry(session):
    cache_set(session, "k1", {"a": 1}, ttl_seconds=3600)
    assert cache_get(session, "k1") == {"a": 1}
    cache_set(session, "k2", {"b": 2}, ttl_seconds=-1)
    assert cache_get(session, "k2") is None
    assert cache_key("p", "e", {"q": "x"}) == cache_key("p", "e", {"q": "x"})
    assert cache_key("p", "e", {"q": "x"}) != cache_key("p", "e", {"q": "y"})


def _wait_for(client, job_id: str, want: set[str], timeout: float = 30) -> dict:
    deadline = time.time() + timeout
    last: dict = {}
    while time.time() < deadline:
        last = client.get(f"/api/jobs/{job_id}").json()
        assert last["status"] != "error", last
        if last["status"] in want:
            return last
        time.sleep(0.2)
    raise AssertionError(f"job {job_id} never reached {want}: {last}")


def test_create_script_job_flow(client, test_engine, monkeypatch):
    from sqlmodel import Session

    from app import services

    async def fake_populate(session, scene, **kw):
        return []

    monkeypatch.setattr(services, "populate_media_for_scene", fake_populate)
    monkeypatch.setattr(services, "_new_session", lambda: Session(test_engine))
    r = client.post("/api/scripts", json={"title": "T", "text": "First scene here about cities.\n\nSecond scene about oceans."})
    assert r.status_code == 202, r.text
    job_id = r.json()["job_id"]
    last = _wait_for(client, job_id, {"done"})
    assert last["total_scenes"] >= 2
    assert last["script_id"]
    assert last["done_scenes"] == last["total_scenes"]
    sb = client.get(f"/api/scripts/{last['script_id']}/storyboard").json()
    assert len(sb["scenes"]) >= 2
    assert sb["scenes"][0]["queries"]


def test_cancel_job(client, test_engine, monkeypatch):
    from sqlmodel import Session

    from app import services

    async def slow_populate(session, scene, **kw):
        await asyncio.sleep(3)
        return []

    monkeypatch.setattr(services, "populate_media_for_scene", slow_populate)
    monkeypatch.setattr(services, "_new_session", lambda: Session(test_engine))
    text = "Scene one about cities here today.\n\nScene two about oceans here today.\n\nScene three about forests here today."
    r = client.post("/api/scripts", json={"title": "T", "text": text})
    job_id = r.json()["job_id"]
    time.sleep(0.5)
    stop = client.delete(f"/api/jobs/{job_id}")
    assert stop.status_code == 202
    last = _wait_for(client, job_id, {"cancelled"}, timeout=20)
    assert last["script_id"], "cancelled jobs keep partial results"


def test_pause_resume_job(client, test_engine, monkeypatch):
    from sqlmodel import Session

    from app import services

    async def slow_populate(session, scene, **kw):
        await asyncio.sleep(1.5)
        return []

    monkeypatch.setattr(services, "populate_media_for_scene", slow_populate)
    monkeypatch.setattr(services, "_new_session", lambda: Session(test_engine))
    text = "Scene one about cities here today.\n\nScene two about oceans here today."
    r = client.post("/api/scripts", json={"title": "T", "text": text})
    job_id = r.json()["job_id"]
    time.sleep(0.5)
    assert client.post(f"/api/jobs/{job_id}/pause").status_code == 200
    paused = client.get(f"/api/jobs/{job_id}").json()
    assert paused["paused"] is True
    assert client.post(f"/api/jobs/{job_id}/resume").status_code == 200
    last = _wait_for(client, job_id, {"done"}, timeout=20)
    assert last["paused"] is False


def test_job_not_found(client):
    assert client.get("/api/jobs/nope").status_code == 404
    assert client.delete("/api/jobs/nope").status_code == 404


def test_select_reject_flow(client, session):
    script = Script(title="T", text="hello world test scene")
    session.add(script)
    session.commit()
    session.refresh(script)
    scene = Scene(script_id=script.id, index=0, narration="hello", start_char=0, end_char=5)
    session.add(scene)
    session.commit()
    session.refresh(scene)
    asset = MediaAsset(scene_id=scene.id, provider="wikimedia", provider_id="f1", title="t",
                       media_type="image", width=100, height=100)
    session.add(asset)
    session.commit()
    session.refresh(asset)
    r = client.post(f"/api/scenes/{scene.id}/media/{asset.id}/select")
    assert r.status_code == 200 and r.json()["asset"]["status"] == "selected"
    r = client.post(f"/api/scenes/{scene.id}/media/{asset.id}/reject")
    assert r.status_code == 200 and r.json()["asset"]["status"] == "rejected"


def test_error_shape_on_missing_script(client):
    r = client.get("/api/scripts/99999/storyboard")
    assert r.status_code == 404
    assert "detail" in r.json()


def test_save_list_load_storyboard(client, session):
    script = Script(title="Saved One", text="hello world")
    session.add(script)
    session.commit()
    session.refresh(script)
    state = {"id": script.id, "title": "Saved One", "scenes": [{"index": 0}]}
    r = client.post("/api/storyboards", json={"script_id": script.id, "state": state})
    assert r.status_code == 201, r.text
    saved_id = r.json()["id"]
    items = client.get("/api/storyboards").json()["storyboards"]
    assert len(items) == 1
    assert items[0]["id"] == saved_id and items[0]["title"] == "Saved One"
    assert items[0]["scene_count"] == 1
    full = client.get(f"/api/storyboards/{saved_id}").json()
    assert full["state"]["title"] == "Saved One"
    assert client.get("/api/storyboards/99999").status_code == 404
