# CLAUDE.md — DropCrate

YouTube-to-DJ pipeline. Downloads, classifies, fingerprints, normalizes, tags, and organizes audio for Rekordbox. Also does source separation (stems) via SAM-Audio. Gift for a DJ — correctness and polish matter.

## Commands

```bash
pnpm dev          # Frontend (3000) + API (8000) concurrently
pnpm dev:web      # Next.js only
pnpm dev:api      # FastAPI with hot reload
pnpm build:web    # Production build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript

# Python
cd packages/api && .venv/bin/python -m pytest tests/ -v
```

## Setup

- Node 20+, pnpm, Python 3.11+, ffmpeg, fpcalc (Chromaprint)
- Python venv: `cd packages/api && python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"`
- All env vars optional — see `packages/api/dropcrate/config.py` for full list

## Architecture

- `apps/web/` — Next.js 14, React 18, Zustand, Tailwind, Sonner toasts
- `packages/api/` — FastAPI, async everywhere, aiosqlite, Pydantic v2
- `packages/runpod-worker/` — RunPod serverless handler for cloud SAM-Audio
- `docker/Dockerfile` — Multi-stage: builds Next.js static → Python runtime with Node.js 18 for PO tokens
- `docker/start.sh` — Launches bgutil PO token server (port 4416) then FastAPI
- SQLite at `./data/dropcrate.db` — schema defined in `database.py`
- SSE for real-time progress (job_manager.py broadcasts to asyncio.Queue subscribers)

## Deployment

- **Render**: Service `srv-d6g8t6tm5p6s73a01v3g` in workspace "Uktob AI" — auto-deploys from main
- **RunPod**: Endpoint `ofosdb95ht439e` (hoover-dj) — GPU serverless for SAM-Audio
- **GitHub**: KareemAyyad/rekordbox-dj, branch main
- Render Dockerfile: `docker/Dockerfile` | RunPod Dockerfile: repo root `Dockerfile`

## YouTube Authentication

PO Token auto-auth via `bgutil-ytdlp-pot-provider` — zero user interaction. OAuth2 is dead (Google killed it Nov 2024). Auth priority:
1. **PO Token** — bgutil server on port 4416, plugin auto-hooks into yt-dlp
2. **Cookies file** — uploaded via Settings page or `DROPCRATE_COOKIES_FILE` env var
3. **Browser cookies** — dev-only via `DROPCRATE_COOKIES_FROM_BROWSER` env var

## Pipeline (7 stages per URL)

metadata → classify → download → fingerprint → normalize → tag → finalize

Each stage broadcasts SSE events. Errors are per-item (batch continues). Max 3 concurrent items.

## Critical Domain Rules

**One-directional flow.** DropCrate feeds INTO Rekordbox. Never replicate what Rekordbox already does:
- No BPM/key detection, waveform generation, beatgrid editing, cue points, playlist management, or track rating

**Rekordbox XML format** (`rekordbox_xml.py`):
- Location URI: `file://localhost/` + URL-encoded POSIX path (spaces → `%20`, slashes NOT encoded)
- XML declaration MUST use double quotes: `<?xml version="1.0" encoding="UTF-8"?>`
- Comments field: use `&#10;` for newlines in XML attributes, but prefer pipe-separated single-line for rekordbox grid view
- All TRACK attributes are strings in XML, even numeric ones
- Playlist nodes: Type="0" = folder, Type="1" = playlist, KeyType="0" = TrackID reference
- After batch: generates XML in timestamped folder (`DropCrate YYYY-MM-DD/`) inside inbox dir
- Manual export: `/api/library/rekordbox-xml` returns XML for entire library

**Classification values** written to tags and used in playlists:
- Genre: "House", "Tech House", "Melodic Techno", "Afro House", etc. (30+ patterns in `classify_heuristic.py`)
- Energy: "2/5", "3/5", "4/5" — maps to Warmup/Closing/Peak
- Time Slot: "Warmup", "Peak", "Closing" — written to ID3 Grouping tag (visible in Rekordbox Grouping column)
- Vibe: "Tribal", "Organic", "Vocal", "Dark", "Minimal", etc.

**DJ-safe normalization**: EBU R128, default -14 LUFS / -1 dBTP / 11 LRA. Two-pass via ffmpeg.

## Known Bugs

(All previously listed XML bugs were fixed in commit d084361)

## Missing Features

1. Duplicate detection — no check if source URL was already downloaded
2. Playlist URL expansion — can't paste YouTube playlist URL and auto-expand to individual tracks
3. Platform-aware source tagging — comment always says "SOURCE: YouTube" even for SoundCloud/Bandcamp

## Style

- Backend: async, Pydantic models in `models/schemas.py`, Ruff (E/F/I/N/W, line-length 100)
- Frontend: Zustand stores per domain, single `api` object in `api-client.ts`, CSS custom properties with `--dc-*` prefix, Sonner for toasts, no component library
- API responses use snake_case; frontend maps to camelCase (see `mapSegment` in api-client.ts)
