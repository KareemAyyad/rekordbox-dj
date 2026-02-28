from __future__ import annotations

import aiosqlite

from dropcrate import config

_db: aiosqlite.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    inbox_dir TEXT NOT NULL DEFAULT '/data/inbox',
    mode TEXT NOT NULL DEFAULT 'dj-safe' CHECK (mode IN ('dj-safe', 'fast')),
    audio_format TEXT NOT NULL DEFAULT 'aiff' CHECK (audio_format IN ('aiff', 'wav', 'flac', 'mp3')),
    normalize_enabled INTEGER NOT NULL DEFAULT 1,
    target_i REAL NOT NULL DEFAULT -14.0,
    target_tp REAL NOT NULL DEFAULT -1.0,
    target_lra REAL NOT NULL DEFAULT 11.0,
    rekordbox_xml_enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS library_tracks (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    sidecar_path TEXT,
    artist TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    genre TEXT NOT NULL DEFAULT 'Other',
    bpm INTEGER,
    key TEXT,
    hot_cues TEXT,
    energy TEXT,
    time_slot TEXT,
    vibe TEXT,
    source_url TEXT,
    source_id TEXT,
    duration_seconds REAL,
    audio_format TEXT,
    album TEXT,
    year TEXT,
    label TEXT,
    downloaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_library_downloaded_at ON library_tracks(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_library_artist ON library_tracks(artist);
CREATE INDEX IF NOT EXISTS idx_library_title ON library_tracks(title);
CREATE INDEX IF NOT EXISTS idx_library_genre ON library_tracks(genre);
"""

# Migrations for existing databases (ALTER TABLE is a no-op in schema but needed for live DBs)
_MIGRATIONS = [
    "ALTER TABLE library_tracks ADD COLUMN hot_cues TEXT",
]


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        config.DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
        _db = await aiosqlite.connect(str(config.DATABASE_PATH))
        _db.row_factory = aiosqlite.Row
        await _db.executescript(SCHEMA)
        # Run migrations for existing databases
        for migration in _MIGRATIONS:
            try:
                await _db.execute(migration)
            except Exception:
                pass  # Column already exists or migration already applied
        await _db.commit()
    return _db


async def close_db() -> None:
    global _db
    if _db is not None:
        await _db.close()
        _db = None
