"""Tests for settings API endpoints (GET/PUT /api/settings)."""

import pytest


@pytest.mark.asyncio
async def test_get_settings_defaults(client):
    resp = await client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["inbox_dir"] == "/data/inbox"
    assert data["mode"] == "dj-safe"
    assert data["audio_format"] == "aiff"
    assert data["normalize_enabled"] is True
    assert data["loudness"]["target_i"] == -14.0
    assert data["loudness"]["target_tp"] == -1.0
    assert data["loudness"]["target_lra"] == 11.0


@pytest.mark.asyncio
async def test_update_settings_mode(client):
    resp = await client.put("/api/settings", json={"mode": "fast"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # Verify it persisted
    resp = await client.get("/api/settings")
    assert resp.json()["mode"] == "fast"


@pytest.mark.asyncio
async def test_update_settings_audio_format(client):
    resp = await client.put("/api/settings", json={"audio_format": "flac"})
    assert resp.status_code == 200

    resp = await client.get("/api/settings")
    assert resp.json()["audio_format"] == "flac"


@pytest.mark.asyncio
async def test_update_settings_normalize(client):
    resp = await client.put("/api/settings", json={"normalize_enabled": False})
    assert resp.status_code == 200

    resp = await client.get("/api/settings")
    assert resp.json()["normalize_enabled"] is False


@pytest.mark.asyncio
async def test_update_settings_loudness(client):
    resp = await client.put("/api/settings", json={
        "loudness": {"target_i": -16.0, "target_tp": -2.0, "target_lra": 9.0}
    })
    assert resp.status_code == 200

    resp = await client.get("/api/settings")
    data = resp.json()
    assert data["loudness"]["target_i"] == -16.0
    assert data["loudness"]["target_tp"] == -2.0
    assert data["loudness"]["target_lra"] == 9.0


@pytest.mark.asyncio
async def test_update_settings_inbox_dir(client):
    resp = await client.put("/api/settings", json={"inbox_dir": "/tmp/test"})
    assert resp.status_code == 200

    resp = await client.get("/api/settings")
    assert resp.json()["inbox_dir"] == "/tmp/test"


@pytest.mark.asyncio
async def test_update_settings_partial(client):
    """Partial updates should not overwrite other fields."""
    # First set to known state
    await client.put("/api/settings", json={
        "mode": "dj-safe",
        "audio_format": "aiff",
        "normalize_enabled": True,
    })
    # Now update only mode
    await client.put("/api/settings", json={"mode": "fast"})

    resp = await client.get("/api/settings")
    data = resp.json()
    assert data["mode"] == "fast"
    assert data["audio_format"] == "aiff"  # Should remain unchanged
    assert data["normalize_enabled"] is True  # Should remain unchanged


@pytest.mark.asyncio
async def test_update_settings_invalid_mode(client):
    resp = await client.put("/api/settings", json={"mode": "invalid"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_settings_invalid_format(client):
    resp = await client.put("/api/settings", json={"audio_format": "ogg"})
    assert resp.status_code == 422
