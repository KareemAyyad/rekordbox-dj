# DropCrate — Overview

**DropCrate** is a local-only desktop tool (currently CLI-first) that takes YouTube links and produces **Rekordbox-ready** tracks with **DJ-safe loudness**, clean filenames, and consistent tags.

Built by **Kareem Ayyad** for **Alaa Ayyad**.

## Product principles

- **It just works**: paste links, wait, import is automatic via watch folder.
- **DJ ergonomics**: strong defaults, minimal decisions, consistent results.
- **Local-first**: no accounts, no cloud dependency, fast iteration.
- **Rekordbox-first**: metadata choices are optimized for Rekordbox search + Smart Playlists.

## MVP scope (shipping slice)

- Queue up to **10** YouTube URLs (FIFO)
- Download best available audio (and optionally video)
- Produce **DJ-safe audio by default**
  - **AIFF**, 44.1kHz PCM
  - **Loudness normalized** (EBU R128 two-pass) for consistent playback volume
- Embed metadata + artwork
- Write into a Rekordbox watch folder (`00_INBOX`)
- Emit a `.dropcrate.json` sidecar per track (auditable provenance + processing details)

## Roadmap (next)

**v0.2**
- Deterministic Artist/Title/Version normalization rules (expanded)
- Genre taxonomy + standardized tags
- Duplicate detection (source URL + audio hash)

**v0.3**
- BPM + Key detection (and Camelot)
- Filename includes `[BPM Key]`

**v0.4**
- GUI (Tauri + React): Paste/Queue → Processing → Review

