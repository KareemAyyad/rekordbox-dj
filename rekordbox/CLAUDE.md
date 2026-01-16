# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DropCrate is a local-first DJ downloader + audio processor + Rekordbox-ready metadata engine. It downloads from YouTube, transcodes to DJ-safe audio (AIFF, normalized), tags metadata, and outputs to a Rekordbox watch-folder.

## Build & Development Commands

```bash
# Install dependencies
npm install --cache ./.npm-cache

# Typecheck all workspaces
npm run typecheck

# Build core + CLI
npm run build

# Browser-first dev (recommended) - starts bridge + web UI
npm run dev

# Run CLI in dev mode
npm run dev:dropcrate -- download "<url>" --inbox "./DJ Library/00_INBOX"

# Desktop Electron dev
npm run dev:desktop

# Run E2E smoke tests (real YouTube data)
npm run e2e:smoke
npm run e2e:smoke:download  # includes queue edge case

# Verify AcoustID fingerprint key
npm run acoustid:keycheck
```

## Monorepo Architecture

```
packages/core/     # Pipeline logic: download, transcode, normalize, tag
  src/pipeline/    # downloadBatch.ts, downloadOne.ts (main entry points)
  src/ytdlp/       # yt-dlp wrapper
  src/metadata/    # autoclassify, fingerprint, musicbrainz, normalize

apps/cli/          # CLI wrapper calling @dropcrate/core
apps/bridge/       # Express server (API + SSE) for browser dev
apps/desktop/      # React + Tailwind UI, Electron wrapper
```

**Data flow**: User pastes URL → yt-dlp downloads → ffmpeg transcodes/normalizes → metadata tagged → file written to inbox folder → Rekordbox imports via watch-folder.

## Key Patterns

- **All pipeline logic goes in `packages/core/`** - apps just call `downloadBatch()` and handle events
- **Filesystem is source of truth** - final track file is primary artifact, sidecar `.dropcrate.json` for provenance
- **DJ-safe defaults**: AIFF output, 44.1kHz PCM, EBU R128 loudness normalization (-14 LUFS)
- **`--fast` mode**: skips normalization, keeps native codec for quick grabs
- **Browser mode** uses bridge at `localhost:8787` with SSE for progress events

## Environment Variables

- `OPENAI_API_KEY` - enables LLM-based auto-tagging (browser mode)
- `DROPCRATE_OPENAI_MODEL` - override OpenAI model
- `DROPCRATE_ACOUSTID_KEY` - enables fingerprint → MusicBrainz matching
- `DROPCRATE_FPCALC_PATH` - path to Chromaprint fpcalc binary
- `DROPCRATE_YTDLP_PATH` - custom yt-dlp path
- `DROPCRATE_COOKIES_FROM_BROWSER` - browser to extract cookies from
- `DROPCRATE_YTDLP_COOKIES` - path to cookies file

## Coding Conventions

- TypeScript ESM, Node 20+
- 2-space indentation, camelCase for variables/functions, PascalCase for types
- Pipeline code in `packages/core/src/pipeline/`
- No formal test suite yet - validate with `npm run typecheck` and real downloads
