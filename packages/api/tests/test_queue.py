"""Tests for queue API endpoints (start/stop)."""

import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_queue_start(client):
    """Test that POST /api/queue/start returns a job_id."""
    with patch("dropcrate.routers.queue.run_pipeline", new_callable=AsyncMock):
        resp = await client.post("/api/queue/start", json={
            "inbox_dir": "/data/inbox",
            "mode": "dj-safe",
            "audio_format": "aiff",
            "normalize_enabled": True,
            "loudness": {"target_i": -14, "target_tp": -1, "target_lra": 11},
            "items": [
                {"id": "q-1", "url": "https://www.youtube.com/watch?v=abc123"},
            ],
        })
    assert resp.status_code == 200
    data = resp.json()
    assert "job_id" in data
    assert len(data["job_id"]) > 0


@pytest.mark.asyncio
async def test_queue_start_multiple_items(client):
    with patch("dropcrate.routers.queue.run_pipeline", new_callable=AsyncMock):
        resp = await client.post("/api/queue/start", json={
            "inbox_dir": "/data/inbox",
            "mode": "dj-safe",
            "audio_format": "flac",
            "normalize_enabled": False,
            "loudness": {"target_i": -14, "target_tp": -1, "target_lra": 11},
            "items": [
                {"id": "q-1", "url": "https://www.youtube.com/watch?v=1"},
                {"id": "q-2", "url": "https://www.youtube.com/watch?v=2"},
                {"id": "q-3", "url": "https://www.youtube.com/watch?v=3"},
            ],
        })
    assert resp.status_code == 200
    assert "job_id" in resp.json()


@pytest.mark.asyncio
async def test_queue_start_with_preset_snapshot(client):
    with patch("dropcrate.routers.queue.run_pipeline", new_callable=AsyncMock):
        resp = await client.post("/api/queue/start", json={
            "inbox_dir": "/data/inbox",
            "mode": "dj-safe",
            "audio_format": "aiff",
            "normalize_enabled": True,
            "loudness": {"target_i": -14, "target_tp": -1, "target_lra": 11},
            "items": [{
                "id": "q-1",
                "url": "https://www.youtube.com/watch?v=abc",
                "preset_snapshot": {
                    "genre": "Afro House",
                    "energy": "3/5",
                    "time": "Peak",
                    "vibe": "Tribal",
                },
            }],
        })
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_queue_start_fast_mode(client):
    with patch("dropcrate.routers.queue.run_pipeline", new_callable=AsyncMock):
        resp = await client.post("/api/queue/start", json={
            "inbox_dir": "/data/inbox",
            "mode": "fast",
            "audio_format": "mp3",
            "normalize_enabled": False,
            "loudness": {"target_i": -14, "target_tp": -1, "target_lra": 11},
            "items": [
                {"id": "q-1", "url": "https://www.youtube.com/watch?v=abc"},
            ],
        })
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_queue_start_empty_items_rejected(client):
    resp = await client.post("/api/queue/start", json={
        "inbox_dir": "/data/inbox",
        "mode": "dj-safe",
        "audio_format": "aiff",
        "normalize_enabled": True,
        "loudness": {"target_i": -14, "target_tp": -1, "target_lra": 11},
        "items": [],
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_queue_start_invalid_format_rejected(client):
    resp = await client.post("/api/queue/start", json={
        "inbox_dir": "/data/inbox",
        "mode": "dj-safe",
        "audio_format": "ogg",
        "normalize_enabled": True,
        "loudness": {"target_i": -14, "target_tp": -1, "target_lra": 11},
        "items": [{"id": "q-1", "url": "https://www.youtube.com/watch?v=abc"}],
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_queue_stop(client):
    resp = await client.post("/api/queue/stop", json={"job_id": "nonexistent"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_queue_stop_null_job_id(client):
    resp = await client.post("/api/queue/stop", json={})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_queue_events_invalid_job(client):
    resp = await client.get("/api/queue/events?job_id=nonexistent")
    assert resp.status_code == 404
