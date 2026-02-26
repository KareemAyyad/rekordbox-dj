"""Tests for library API endpoints (list/download)."""

import pytest
from pathlib import Path
from unittest.mock import patch


@pytest.mark.asyncio
async def test_library_empty(client):
    resp = await client.get("/api/library")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 0


@pytest.mark.asyncio
async def test_library_after_insert(client):
    """Insert a track directly into DB and verify it shows in the library."""
    from dropcrate.database import get_db

    db = await get_db()
    await db.execute(
        """INSERT INTO library_tracks
           (id, file_path, artist, title, genre, energy, time_slot, vibe,
            source_url, source_id, duration_seconds, audio_format, downloaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            "test-1",
            "/data/inbox/Artist - Title.aiff",
            "Test Artist",
            "Test Title",
            "Afro House",
            "3/5",
            "Peak",
            "Tribal",
            "https://www.youtube.com/watch?v=abc",
            "abc",
            420.0,
            "aiff",
            "2024-06-01T12:00:00Z",
        ),
    )
    await db.commit()

    resp = await client.get("/api/library")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1

    track = next(t for t in data if t["id"] == "test-1")
    assert track["artist"] == "Test Artist"
    assert track["title"] == "Test Title"
    assert track["genre"] == "Afro House"
    assert track["energy"] == "3/5"
    assert track["time"] == "Peak"
    assert track["vibe"] == "Tribal"
    assert track["download_url"] == "/api/library/test-1/download"
    assert track["audio_format"] == "aiff"
    assert track["downloaded_at"] == "2024-06-01T12:00:00Z"


@pytest.mark.asyncio
async def test_library_search(client):
    from dropcrate.database import get_db

    db = await get_db()
    await db.execute(
        """INSERT OR REPLACE INTO library_tracks
           (id, file_path, artist, title, genre, downloaded_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        ("search-1", "/tmp/a.aiff", "ARTBAT", "Flame", "Melodic Techno", "2024-01-01"),
    )
    await db.execute(
        """INSERT OR REPLACE INTO library_tracks
           (id, file_path, artist, title, genre, downloaded_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        ("search-2", "/tmp/b.aiff", "Black Coffee", "Drive", "Afro House", "2024-01-02"),
    )
    await db.commit()

    # Search for "ARTBAT"
    resp = await client.get("/api/library?search=ARTBAT")
    assert resp.status_code == 200
    data = resp.json()
    assert any(t["artist"] == "ARTBAT" for t in data)

    # Search for "Afro House"
    resp = await client.get("/api/library?search=Afro%20House")
    assert resp.status_code == 200
    data = resp.json()
    assert any(t["genre"] == "Afro House" for t in data)


@pytest.mark.asyncio
async def test_library_sort_by_artist(client):
    from dropcrate.database import get_db

    db = await get_db()
    await db.execute(
        """INSERT OR REPLACE INTO library_tracks
           (id, file_path, artist, title, genre, downloaded_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        ("sort-1", "/tmp/a.aiff", "Zzz Artist", "Track", "House", "2024-01-01"),
    )
    await db.execute(
        """INSERT OR REPLACE INTO library_tracks
           (id, file_path, artist, title, genre, downloaded_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        ("sort-2", "/tmp/b.aiff", "Aaa Artist", "Track", "House", "2024-01-02"),
    )
    await db.commit()

    resp = await client.get("/api/library?sort=artist")
    assert resp.status_code == 200
    data = resp.json()
    artists = [t["artist"] for t in data if t["id"] in ("sort-1", "sort-2")]
    if len(artists) == 2:
        assert artists[0] == "Aaa Artist"
        assert artists[1] == "Zzz Artist"


@pytest.mark.asyncio
async def test_library_sort_by_date(client):
    resp = await client.get("/api/library?sort=date")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_library_sort_by_title(client):
    resp = await client.get("/api/library?sort=title")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_library_download_not_found(client):
    resp = await client.get("/api/library/nonexistent/download")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_library_download_file_missing_on_disk(client):
    """Track exists in DB but file was deleted from disk."""
    from dropcrate.database import get_db

    db = await get_db()
    await db.execute(
        """INSERT OR REPLACE INTO library_tracks
           (id, file_path, artist, title, genre, downloaded_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        ("missing-1", "/nonexistent/path/file.aiff", "A", "T", "House", "2024-01-01"),
    )
    await db.commit()

    resp = await client.get("/api/library/missing-1/download")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_library_download_existing_file(client, tmp_path):
    """Track exists in DB and file exists on disk."""
    from dropcrate.database import get_db

    # Create a real file
    test_file = tmp_path / "test_track.aiff"
    test_file.write_bytes(b"fake audio content")

    db = await get_db()
    await db.execute(
        """INSERT OR REPLACE INTO library_tracks
           (id, file_path, artist, title, genre, downloaded_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        ("dl-1", str(test_file), "Artist", "Title", "House", "2024-01-01"),
    )
    await db.commit()

    resp = await client.get("/api/library/dl-1/download")
    assert resp.status_code == 200
