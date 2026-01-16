# Development

## Prereqs

- Node.js 20+

## Install

```
npm install --cache ./.npm-cache
```

## Scripts

- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Run (dev): `npm run dev:dropcrate -- download "<url>" --inbox "./DJ Library/00_INBOX"`

## Monorepo layout

- `apps/cli`: argument parsing + progress output
- `packages/core`: pipeline logic; intended to be reused by a future GUI

## Tooling notes

- Download engine uses `yt-dlp`. In constrained environments it may:
  - try standalone binaries from GitHub releases
  - fall back to the `yt-dlp` zipapp executed via `python3.10+`
- Audio processing uses `ffmpeg-static` (bundled FFmpeg)

