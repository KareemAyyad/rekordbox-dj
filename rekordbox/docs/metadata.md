# Metadata & Tagging (Rekordbox-first)

DropCrate’s rule: **Rekordbox should feel “ready” immediately**—searchable, smart-playlist friendly, and auditable.

## Fields written into media

Written via `ffmpeg` metadata remuxing:

- `artist` → Rekordbox **Artist**
- `title` → Rekordbox **Title**
- `genre` → Rekordbox **Genre**
- `comment` → Rekordbox **Comments**
- Artwork → embedded cover image (best thumbnail available)

## Comments format (Smart Playlist friendly)

The `Comments` field is structured, line-based:

```
ENERGY: 3/5
TIME: Peak
VIBE: Driving
SOURCE: YouTube
URL: https://www.youtube.com/watch?v=...
YOUTUBE_ID: ...
```

This is intentionally **simple text** so Rekordbox can filter/search reliably.
If ENERGY/TIME/VIBE are unknown, those lines are omitted (SOURCE/URL/YOUTUBE_ID are always written).

## Default DJ taxonomy (for your use case)

DropCrate now prefers **conservative defaults**:
- Genre: `Other` when unknown
- ENERGY/TIME/VIBE: blank when unknown

When `OPENAI_API_KEY` is set (browser mode), DropCrate auto-tags using YouTube metadata + an LLM and only applies tags when confidence is high.

## Artist/Title normalization rules (current)

Input is YouTube title + uploader.

1) If title contains a common separator (`" - "`, `" – "`, `" | "`)  
   - Left side → `Artist`
   - Right side → `Title`
2) Otherwise:
   - `Artist = uploader`
   - `Title = cleaned title`
3) If the title ends with a version-like parenthetical (e.g. `(Extended Mix)`, `(Remix)`), we treat it as version and keep it in Title as `(Version)` for Rekordbox predictability.

## Sidecar JSON (`*.dropcrate.json`)

Every downloaded track gets a sidecar file to make the pipeline auditable and debuggable.

Example keys:
- `sourceUrl`, `sourceId`
- raw YouTube fields: `title`, `uploader`, `duration`
- `normalized`: resolved `artist/title/version`
- `djDefaults`: genre/energy/time/vibe used
- `processing`: audioFormat + loudness normalize settings
- `outputs`: file paths for audio/video

## What’s next (to reach “perfect”)

- Fingerprint + database match (AcoustID → MusicBrainz) for authoritative artist/title/album/year (optional, gated by high confidence)
- BPM/Key detection + Camelot mapping
- Filename template: `Artist - Title (Version) [BPM Key].aiff`

## Optional: fingerprint → MusicBrainz (as-close-to-perfect mode)

If `DROPCRATE_ACOUSTID_KEY` is set and `fpcalc` is available, DropCrate will:
- Fingerprint the downloaded audio (Chromaprint)
- Resolve a MusicBrainz recording via AcoustID
- Override `Artist/Title/Album/Year` only when the match score is high

Env vars: `.env.example:1`
