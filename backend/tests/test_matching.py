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
