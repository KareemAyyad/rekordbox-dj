# DropCrate

<!--
Repo tags (GitHub-friendly): local-first • rekordbox • dj-tools • yt-dlp • ffmpeg • audio-processing • metadata • tauri-ready • typescript • macos • windows
-->

![Local-first](https://img.shields.io/badge/local--first-yes-111827)
![Rekordbox](https://img.shields.io/badge/Rekordbox-watch--folder-111827)
![DJ-safe audio](https://img.shields.io/badge/audio-AIFF%20%2B%20loudness%20normalize-111827)
![TypeScript](https://img.shields.io/badge/TypeScript-Node%2020%2B-111827)

Local, high-performance DJ downloader + audio extractor + Rekordbox-ready metadata engine.

Built by **Kareem Ayyad** for **Alaa Ayyad**.

## What it does

Paste → Download → DJ-safe Audio → Tags + Artwork → Watch-folder import into Rekordbox.

**Strong defaults (for Afro/House crate-building):**
- Output: **AIFF**, **44.1kHz PCM**, **loudness normalized** (EBU R128 two-pass)
- Rekordbox tags: **Artist**, **Title**, **Genre**, **Artwork**
- Comments field: **ENERGY / TIME / VIBE + SOURCE / URL / YOUTUBE_ID** for Smart Playlists

## Quickstart

Prereqs:
- Node.js 20+

Install:
- `npm install --cache ./.npm-cache`

Optional (better auto-tagging):
- Copy `.env.example` → `.env` and set `OPENAI_API_KEY`

Optional (near-perfect Artist/Title/Album/Year):
- Install `fpcalc` (Chromaprint) **or** use the bundled one at `./.dropcrate/bin/fpcalc`
- Set `DROPCRATE_ACOUSTID_KEY` in `.env`
- Verify the key: `npm run acoustid:keycheck`

Run (DJ-safe defaults):
- `npm run dev:dropcrate -- download "<youtube-url>" --inbox "./DJ Library/00_INBOX"`

Fast mode (native codec, no normalization):
- `npm run dev:dropcrate -- download "<youtube-url>" --fast --inbox "./DJ Library/00_INBOX"`

Build:
- `npm run build`

## Browser-first dev (recommended right now)

Run the full app in your browser (real downloads + progress events via a local bridge):
- `npm run dev`
- Open `http://localhost:5173`

This starts:
- `apps/bridge/` (API + SSE events on `http://localhost:8787`)
- `apps/desktop/` (web UI on `http://localhost:5173`)

Optional (auto-classification):
- Set `OPENAI_API_KEY` (and optionally `DROPCRATE_OPENAI_MODEL`)

## E2E smoke tests (real data)

- Classify 20 real YouTube search results (mixes, tracks, tutorials, podcasts, non-music): `npm run e2e:smoke`
- Same + queue edge case (private video fails gracefully, next item still completes): `npm run e2e:smoke:download`

## Rekordbox workflow (watch folder)

1) Set Rekordbox to watch your inbox folder (example): `~/DJ Library/00_INBOX/`  
2) DropCrate writes finished files into that folder  
3) Rekordbox imports automatically as items complete

Full setup guide: `docs/rekordbox.md:1`

## Documentation (start here)

- Overview + product spec: `docs/overview.md:1`
- System architecture + diagrams: `docs/architecture.md:1`
- Metadata + tagging spec (Rekordbox-first): `docs/metadata.md:1`
- CLI reference: `docs/cli.md:1`
- Troubleshooting: `docs/troubleshooting.md:1`
- Development notes: `docs/development.md:1`

## Project layout

```
apps/
  cli/              # `dropcrate` CLI
packages/
  core/             # downloader + audio pipeline + tagging
docs/               # full documentation set
```

## Status

Current state is a **working pipeline** with a browser-first UI (`npm run dev:web:full`) and a CLI.

Roadmap: `docs/overview.md:1`
