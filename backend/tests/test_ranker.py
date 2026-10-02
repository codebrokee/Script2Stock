"""Tests for the ranker."""
from app.models import MediaAsset
from app.ranker import rank_assets


def _asset(**kw):
    base = dict(
        scene_id=1, provider="wikimedia", provider_id="x", title="city skyline at night",
        description="urban downtown skyline", url="", download_url="", thumbnail_url="",
        media_type="image", width=1920, height=1080,
    )
    base.update(kw)
    return MediaAsset(**base)


def test_relevant_ranks_higher():
    rel = _asset(provider_id="a", download_url="http://x/a.jpg", title="city skyline urban downtown")
    irrel = _asset(provider_id="b", download_url="http://x/b.jpg", title="underwater coral reef fish", width=640, height=480)
    ranked = rank_assets([irrel, rel], narration="The city skyline glows over downtown at night")
    assert ranked[0].provider_id == "a"
    assert ranked[0].score >= ranked[1].score


def test_deduplication():
    a = _asset(provider_id="dup", download_url="http://x/same.jpg", title="forest trees")
    b = _asset(provider_id="dup", download_url="http://x/same.jpg", title="forest trees")
    c = _asset(provider_id="other", download_url="http://x/other.jpg", title="forest trees")
    ranked = rank_assets([a, b, c], narration="forest trees woods", top_n=12)
    ids = [(m.provider, m.provider_id) for m in ranked]
    assert len(ids) == len(set(ids)) == 2


def test_top_n_limit():
    assets = [_asset(provider_id=str(i), download_url=f"http://x/{i}.jpg", title=f"clip {i}") for i in range(20)]
    assert len(rank_assets(assets, narration="clip video", top_n=12)) == 12


def test_scoring_formula_bounds():
    a = _asset(title="nothing relevant here xyz", width=0, height=0)
    ranked = rank_assets([a], narration="quantum astrophysics lecture")
    assert 0.0 <= ranked[0].score <= 1.5
