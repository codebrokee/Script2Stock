"""Unit tests for the matching eval harness (deterministic, offline)."""
from app.core import eval as E
from app.core import pipeline


def _item(title: str, description: str = "") -> object:
    from app.models import MediaAsset

    return MediaAsset(scene_id=0, provider="t", provider_id=title,
                      title=title, description=description)


def test_golden_schema() -> None:
    scenes = E.load_scenes()
    assert len(scenes) == 20
    for s in scenes:
        assert {"id", "narration", "acceptable_keywords", "forbidden_keywords"} <= set(s)
        assert len(s["acceptable_keywords"]) >= 2
        assert len(s["forbidden_keywords"]) >= 1


def test_metric_sanity() -> None:
    scene = {"acceptable_keywords": ["forest", "trees"], "forbidden_keywords": ["wildfire"]}
    ranked = [_item("forest trees trail"), _item("city skyline night"),
              _item("wildfire smoke forest"), _item("forest cabin lake"), _item("desert dunes")]
    assert E.precision_at_k(ranked, scene, k=5) == 0.4
    assert E.hit_rate(ranked, scene, k=5) == 1.0
    assert E.forbidden_rate(ranked, scene, k=5) == 0.2
    assert E.diversity_score(["a", "b", "a"]) == 2 / 3


def test_baseline_runs_and_is_deterministic() -> None:
    scenes = E.load_scenes()
    first = E.evaluate(pipeline.rank_scene, scenes)
    second = E.evaluate(pipeline.rank_scene, scenes)
    assert first == second
    for v in first.values():
        assert 0.0 <= v <= 1.0
    # keyword matching should clearly beat chance on these fixtures
    assert first["precision_at_k"] > 0.3
    assert first["hit_rate"] > 0.5


def test_query_shapes() -> None:
    from app.core import querygen

    for scene in E.load_scenes():
        qs = querygen.generate_queries(scene["narration"])
        assert 4 <= len(qs) <= 8, (scene["id"], qs)
        assert len(set(qs)) == len(qs)
        for q in qs:
            assert 2 <= len(q.split()) <= 4, (scene["id"], q)


def test_embedding_cache_and_fallback(session, monkeypatch) -> None:
    import numpy as np

    from app.providers.ai import embeddings

    calls: list[list[str]] = []

    def fake_encode(texts: list[str]) -> object:
        calls.append(list(texts))
        return np.ones((len(texts), 4), dtype=np.float32)

    monkeypatch.setattr(embeddings, "encode", fake_encode)
    v1 = embeddings.cached_encode(session, "hello world")
    v2 = embeddings.cached_encode(session, "hello world")
    assert v1 is not None and v2 is not None
    assert len(calls) == 1, "second identical text must come from SQLite, not the encoder"
    assert float(abs(v1 - v2).max()) == 0.0


def test_blend_falls_back_to_keyword_only(monkeypatch) -> None:
    from app.core import rerank
    from app.providers.ai import embeddings

    monkeypatch.setattr(embeddings, "encode", lambda texts: None)
    items = E.build_candidates(E.load_scenes()[0], 0)
    out = rerank.rerank("forest trail trees", ["forest"], items, top_n=5)
    assert len(out) == 5
    scores = [m.score for m in out]
    assert scores == sorted(scores, reverse=True)
    assert all(0.0 <= s <= 1.1 for s in scores)


def test_semantic_scores_contract() -> None:
    from app.providers.ai import embeddings

    scene = E.load_scenes()[2]  # forest hike
    items = E.build_candidates(scene, 2)
    if not embeddings.is_available():
        assert embeddings.semantic_scores(scene["narration"], ["forest"], items) is None
        return
    sims = embeddings.semantic_scores(scene["narration"], ["forest"], items)
    assert sims is not None and len(sims) == len(items)
    assert all(0.0 <= s <= 1.0 for s in sims)
    assert sims[0] > sims[3], "relevant item must outscore junk-marked item"


def test_concept_expansion_and_entities() -> None:
    from app.core import concept_map, querygen

    qs = querygen.generate_queries("Leadership and innovation drive growth in every team.")
    assert any("meeting" in q or "huddle" in q or "chart" in q or "lab" in q for q in qs)
    visuals = concept_map.expand_concepts("The Roman Empire built roads.", ["Roman Empire"])
    assert "roman colosseum" in visuals
    assert concept_map.disambiguate("apple", "new iphone technology") == "tech company"
    assert concept_map.disambiguate("apple", "fruit orchard harvest") == "fruit orchard"
    assert concept_map.disambiguate("apple", "something entirely unrelated") is None
    assert concept_map.disambiguate("unknown-term", "context") is None


def test_rrf_favors_repeated_items() -> None:
    from app.core import fusion

    fused = fusion.rrf_fuse([["a", "b", "c"], ["b", "a"], ["a"]], k=60)
    order = [mid for mid, _ in fused]
    assert order[0] == "a", fused  # in all 3 lists
    assert set(order) == {"a", "b", "c"}
    scores = dict(fused)
    assert scores["a"] > scores["b"] > scores["c"]


def test_fuse_and_rerank_end_to_end() -> None:
    from app.core import pipeline

    scene = E.load_scenes()[2]  # forest hike
    cands = E.build_candidates(scene, 2)
    goods, bads, neutrals = cands[:3], cands[3:5], cands[5:]
    lists = [("q1 forest trail", goods + neutrals[:2]), ("q2 trees", goods[1:] + bads + neutrals[2:4])]
    out = pipeline.fuse_and_rerank(scene["narration"], ["forest"], lists, top_n=5)
    assert len(out) == 5
    assert E.precision_at_k(out, scene) >= 0.6
    assert E.hit_rate(out, scene) == 1.0


def test_feedback_multipliers_boost_provenance() -> None:
    from app.core import pipeline
    from app.models import MediaAsset

    def item(pid: str, title: str) -> MediaAsset:
        return MediaAsset(scene_id=0, provider="t", provider_id=pid,
                          title=title, description="")

    x = item("X", "forest lake")
    y = item("Y", "forest trail trees")
    a, b, c = (item(pid, "desert dunes night") for pid in ("A", "B", "C"))
    lists = [("loved query", [x, a]), ("other query", [y, b]), ("other query", [y, c])]
    plain = pipeline.fuse_and_rerank("forest trail", [], lists, top_n=5)
    boosted = pipeline.fuse_and_rerank(
        "forest trail", [], lists, top_n=5, multipliers={"loved query": 5.0})
    assert [m.provider_id for m in plain][0] == "Y"
    assert [m.provider_id for m in boosted][0] == "X"


def _junk_item(**kw: object) -> object:
    from app.models import MediaAsset

    base = dict(scene_id=0, provider="wikimedia", provider_id="j",
                title="t", description="", width=1920, height=1080)
    base.update(kw)  # type: ignore[typeddict-item]
    return MediaAsset(**base)  # type: ignore[arg-type]


def test_junk_patterns() -> None:
    from app.core import junk

    assert junk.is_junk(_junk_item(title="city skyline watermark"))
    assert junk.is_junk(_junk_item(title="logo isolated on white background"))
    assert junk.is_junk(_junk_item(title="dragon 3d render"))
    assert junk.is_junk(_junk_item(title="flower clipart border"))
    assert not junk.is_junk(_junk_item(title="forest trail trees"))
    assert not junk.is_junk(_junk_item(title="cartoon network studio"))
    assert not junk.is_junk(_junk_item(title="white House lawn"))


def test_provider_cleanup_rules() -> None:
    from app.core import junk

    assert not junk.provider_cleanup(_junk_item(download_url="https://x/y.svg"), "wikimedia")
    assert not junk.provider_cleanup(_junk_item(width=400, height=300), "wikimedia")
    assert junk.provider_cleanup(_junk_item(width=800, height=600), "wikimedia")
    assert junk.provider_cleanup(_junk_item(width=0, height=0), "wikimedia")  # unknown size kept
    assert not junk.provider_cleanup(_junk_item(width=720, height=1280), "pexels")
    assert junk.provider_cleanup(_junk_item(width=1280, height=720), "pexels")
    assert not junk.provider_cleanup(_junk_item(title="free watermark photo"), "pexels")
    assert junk.provider_cleanup(_junk_item(title="clean landscape"), "other")


def test_dedup_key_strips_params() -> None:
    from app.core import junk

    a = _junk_item(download_url="https://cdn.example.com/f.jpg?x=1")
    b = _junk_item(download_url="https://cdn.example.com/f.jpg?x=2")
    assert junk.dedup_key(a) == junk.dedup_key(b) == "https://cdn.example.com/f.jpg"
    c = _junk_item(download_url="")
    assert junk.dedup_key(c) == "wikimedia:j"


def test_fusion_drops_junk_and_merges_dupes() -> None:
    from app.core import pipeline

    scene = E.load_scenes()[2]
    cands = E.build_candidates(scene, 2)
    lists = [("q1", cands)]
    out = pipeline.fuse_and_rerank(scene["narration"], [], lists, top_n=10)
    titles = " | ".join(m.title for m in out)
    assert "watermark" not in titles and "clipart" not in titles
    urls = [m.download_url.split("?")[0] for m in out]
    assert len(urls) == len(set(urls)), "param-permuted dupes must merge"
