"""Mocked provider tests (no network)."""
import httpx
import pytest
import respx

from app.providers.pexels import PexelsProvider
from app.providers.pixabay import PixabayProvider
from app.providers.wikimedia import WikimediaProvider


@pytest.mark.asyncio
async def test_pexels_images_normalized():
    async with httpx.AsyncClient() as client:
        with respx.mock:
            respx.get("https://api.pexels.com/v1/search").mock(
                return_value=httpx.Response(200, json={"photos": [{
                    "id": 1, "width": 4000, "height": 3000, "url": "https://pexels.com/p/1",
                    "photographer": "Jane",
                    "src": {"original": "https://img/orig.jpg", "medium": "https://img/med.jpg"},
                    "alt": "city skyline",
                }]})
            )
            respx.get("https://api.pexels.com/videos/search").mock(return_value=httpx.Response(200, json={"videos": []}))
            results = await PexelsProvider(api_key="KEY").search("city", client, per_page=1)
    assert len(results) == 1
    r = results[0]
    assert r.provider == "pexels" and r.media_type == "image"
    assert r.download_url == "https://img/orig.jpg"
    assert r.license == "commercial-free"


@pytest.mark.asyncio
async def test_pexels_missing_key_returns_empty():
    async with httpx.AsyncClient() as client:
        assert await PexelsProvider(api_key="").search("city", client) == []


@pytest.mark.asyncio
async def test_pixabay_normalized():
    async with httpx.AsyncClient() as client:
        with respx.mock:
            respx.get("https://pixabay.com/api/").mock(
                return_value=httpx.Response(200, json={"hits": [{
                    "id": 7, "tags": "forest trees", "pageURL": "https://pixabay.com/p/7",
                    "largeImageURL": "https://pix/large.jpg", "previewURL": "https://pix/prev.jpg",
                    "imageWidth": 1920, "imageHeight": 1080, "user": "bob",
                }]})
            )
            respx.get("https://pixabay.com/api/videos/").mock(return_value=httpx.Response(200, json={"hits": []}))
            results = await PixabayProvider(api_key="KEY").search("forest", client, per_page=1)
    assert len(results) == 1
    assert results[0].provider == "pixabay"
    assert results[0].width == 1920


@pytest.mark.asyncio
async def test_wikimedia_no_key_needed():
    payload = {"query": {"pages": {"123": {
        "pageid": 123, "title": "File:Test.jpg",
        "imageinfo": [{"url": "https://upload/full.jpg", "thumburl": "https://upload/thumb.jpg",
                       "width": 800, "height": 600,
                       "extmetadata": {"LicenseShortName": {"value": "CC0"}}}],
    }}}}
    async with httpx.AsyncClient() as client:
        with respx.mock:
            respx.get("https://commons.wikimedia.org/w/api.php").mock(
                return_value=httpx.Response(200, json=payload))
            results = await WikimediaProvider().search("test", client, per_page=1)
    assert len(results) == 1
    assert results[0].provider == "wikimedia"
    assert results[0].license == "CC0"
    assert results[0].attribution_required is False
