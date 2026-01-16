# Repository Guidelines

## Project Structure & Module Organization

- `packages/core/`: downloader + audio pipeline + tagging (shared by CLI and apps).
- `apps/cli/`: CLI entrypoint (`dropcrate`) for fast iteration and debugging.
- `apps/desktop/`: React + Tailwind UI, plus Electron wrapper for packaged macOS/Windows builds.
- `apps/bridge/`: local HTTP bridge (API + SSE events) that lets the UI run in a normal browser while still doing real downloads.
- `docs/`: product + Rekordbox + metadata docs (Mermaid diagrams live here).
- Output/runtime artifacts (not committed):
  - `DJ Library/`: local watch-folder test outputs (e.g. `DJ Library/00_INBOX/`)
  - `.dropcrate/`: cached downloader binaries and helpers

Keep pipeline/metadata logic in `packages/core/`. UI-only logic stays in `apps/desktop/`. Bridge endpoints live in `apps/bridge/`.

## Build, Test, and Development Commands

- `npm install --cache ./.npm-cache`: install dependencies (avoids user global npm cache issues).
- `npm run typecheck`: TypeScript typecheck for all workspaces.
- `npm run build`: build the core + CLI (used by bridge and desktop).
- Browser-first dev (recommended): `npm run dev:web:full` then open `http://localhost:5173`.
- Desktop dev (Electron): `npm run dev:desktop`.
- CLI dev: `npm run dev:dropcrate -- download "<url>" --inbox "./DJ Library/00_INBOX"`.
- Real-data smoke test: `npm run e2e:smoke` (and `npm run e2e:smoke:download` for a queue edge case).
- Fingerprint key check: `npm run acoustid:keycheck`.

## Coding Style & Naming Conventions

- Language: TypeScript (ESM). Target: Node 20+.
- Style: 2-space indentation, `camelCase` for variables/functions, `PascalCase` for types.
- Filenames: `camelCase.ts` for modules, keep pipeline code in `packages/core/src/pipeline/`.
- Avoid one-letter names in new code; prefer explicit names (`downloadedPath`, `inboxDir`).

## Testing Guidelines

There is no formal test harness yet. Keep helpers pure/deterministic and validate with:
- `npm run typecheck`
- A real download to `./DJ Library/00_INBOX/` (Rekordbox watch-folder workflow).

## Commit & Pull Request Guidelines

Use short, imperative commit subjects (e.g. `Fix bridge classify schema`). PRs should include:
- Summary + screenshots for UI changes
- How to test (exact command)
- Notes on default-behavior changes (DJ-safe defaults are product-critical)

## Security & Configuration Tips

- The app is local-first; do not add telemetry or remote persistence.
- Env vars: `OPENAI_API_KEY`, `DROPCRATE_OPENAI_MODEL`, `DROPCRATE_YTDLP_PATH`, `DROPCRATE_COOKIES_FROM_BROWSER`, `DROPCRATE_YTDLP_COOKIES`, `DROPCRATE_ACOUSTID_KEY`, `DROPCRATE_FPCALC_PATH`.
- Do not commit `.env`, generated media, `.dropcrate/`, or `DJ Library/` outputs.
