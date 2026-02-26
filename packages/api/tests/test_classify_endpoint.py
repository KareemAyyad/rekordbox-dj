"""Tests for the /api/classify endpoint (with mocked yt-dlp)."""

import pytest
from unittest.mock import patch, AsyncMock


FAKE_VIDEO_INFO = {
    "id": "abc123",
    "title": "ARTBAT - Flame (Extended Mix)",
    "uploader": "ARTBAT",
    "channel": "ARTBAT",
    "description": "ARTBAT new release Flame Extended Mix 2024",
    "duration": 420,
    "categories": ["Music"],
    "tags": ["melodic techno", "artbat", "flame", "extended mix"],
    "webpage_url": "https://www.youtube.com/watch?v=abc123",
    "thumbnails": [{"url": "https://img.youtube.com/vi/abc123/maxresdefault.jpg", "width": 1280, "height": 720}],
}


@pytest.mark.asyncio
async def test_classify_single_url(client):
    with patch("dropcrate.routers.classify.fetch_video_info", new_callable=AsyncMock, return_value=FAKE_VIDEO_INFO):
        resp = await client.post("/api/classify", json={
            "items": [{"id": "item-1", "url": "https://www.youtube.com/watch?v=abc123"}]
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["source"] == "heuristic"
    assert len(data["results"]) == 1
    result = data["results"][0]
    assert result["id"] == "item-1"
    assert result["kind"] == "track"
    assert result["genre"] is not None  # Should detect melodic techno or techno
    assert result["confidence"] > 0


@pytest.mark.asyncio
async def test_classify_multiple_urls(client):
    infos = [
        {**FAKE_VIDEO_INFO, "title": "Track 1 - Afro House Vibes", "tags": ["afro house"]},
        {**FAKE_VIDEO_INFO, "title": "Track 2 - Deep House Mix", "tags": ["deep house"]},
    ]
    call_count = 0

    async def mock_fetch(url):
        nonlocal call_count
        result = infos[call_count % len(infos)]
        call_count += 1
        return result

    with patch("dropcrate.routers.classify.fetch_video_info", side_effect=mock_fetch):
        resp = await client.post("/api/classify", json={
            "items": [
                {"id": "item-1", "url": "https://www.youtube.com/watch?v=1"},
                {"id": "item-2", "url": "https://www.youtube.com/watch?v=2"},
            ]
        })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["results"]) == 2
    assert data["results"][0]["id"] == "item-1"
    assert data["results"][1]["id"] == "item-2"


@pytest.mark.asyncio
async def test_classify_dj_set(client):
    set_info = {
        **FAKE_VIDEO_INFO,
        "title": "DJ Cool Live Set at Boiler Room 2024",
        "tags": ["dj set", "boiler room", "house"],
        "duration": 3600,
    }
    with patch("dropcrate.routers.classify.fetch_video_info", new_callable=AsyncMock, return_value=set_info):
        resp = await client.post("/api/classify", json={
            "items": [{"id": "set-1", "url": "https://www.youtube.com/watch?v=set1"}]
        })
    data = resp.json()
    assert data["results"][0]["kind"] == "set"


@pytest.mark.asyncio
async def test_classify_tutorial(client):
    tut_info = {
        **FAKE_VIDEO_INFO,
        "title": "How to DJ Tutorial Beatmatching for Beginners",
        "categories": ["Education"],
        "tags": ["dj tutorial", "how to dj"],
        "duration": 600,
    }
    with patch("dropcrate.routers.classify.fetch_video_info", new_callable=AsyncMock, return_value=tut_info):
        resp = await client.post("/api/classify", json={
            "items": [{"id": "tut-1", "url": "https://www.youtube.com/watch?v=tut1"}]
        })
    data = resp.json()
    assert data["results"][0]["kind"] == "video"
    assert data["results"][0]["genre"] is None


@pytest.mark.asyncio
async def test_classify_fetch_failure(client):
    async def mock_fetch_fail(url):
        raise RuntimeError("Network error")

    with patch("dropcrate.routers.classify.fetch_video_info", side_effect=mock_fetch_fail):
        resp = await client.post("/api/classify", json={
            "items": [{"id": "fail-1", "url": "https://www.youtube.com/watch?v=fail"}]
        })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["results"]) == 1
    assert "Failed" in data["results"][0]["notes"]


@pytest.mark.asyncio
async def test_classify_returns_timing_ms(client):
    with patch("dropcrate.routers.classify.fetch_video_info", new_callable=AsyncMock, return_value=FAKE_VIDEO_INFO):
        resp = await client.post("/api/classify", json={
            "items": [{"id": "t-1", "url": "https://www.youtube.com/watch?v=abc"}]
        })
    data = resp.json()
    assert "ms" in data
    assert isinstance(data["ms"], int)
    assert data["ms"] >= 0


@pytest.mark.asyncio
async def test_classify_structured_output_for_rekordbox(client):
    """Verify the classify endpoint returns structured DJ tags suitable for Rekordbox."""
    music_info = {
        **FAKE_VIDEO_INFO,
        "title": "Black Coffee - Afro House Vocal Dark Organic Track (Extended Mix)",
        "tags": ["afro house", "vocal", "dark", "organic", "music"],
        "categories": ["Music"],
        "duration": 420,
    }
    with patch("dropcrate.routers.classify.fetch_video_info", new_callable=AsyncMock, return_value=music_info):
        resp = await client.post("/api/classify", json={
            "items": [{"id": "rb-1", "url": "https://www.youtube.com/watch?v=rb1"}]
        })
    data = resp.json()
    result = data["results"][0]
    # Should have all Rekordbox-relevant fields
    assert "kind" in result
    assert "genre" in result
    assert "energy" in result
    assert "time" in result
    assert "vibe" in result
    assert "confidence" in result
    assert "notes" in result
    # Genre should be a recognizable DJ genre
    assert result["genre"] in (
        "Afro House", "House", "Tech House", "Deep House", "Progressive House",
        "Melodic House & Techno", "Techno", "Melodic Techno", "Minimal Techno",
        "Hard Techno", "Acid", "Peak Time Techno", "Funky House", "Soulful House",
        "Jackin House", "Drum & Bass", "Dubstep", "UK Garage", "Breaks",
        "Bass House", "Psytrance", "Uplifting Trance", "Trance",
        "Disco / Nu-Disco", "Electro", "Downtempo", "Other", None,
    )


@pytest.mark.asyncio
async def test_classify_empty_items(client):
    resp = await client.post("/api/classify", json={"items": []})
    assert resp.status_code == 200
    data = resp.json()
    assert data["results"] == []
