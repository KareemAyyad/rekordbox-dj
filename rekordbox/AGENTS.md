# Repository Guidelines

## Project Structure & Module Organization

- `packages/core/`: downloader + audio pipeline + tagging (shared by CLI and apps).
- `apps/cli/`: CLI entrypoint (`dropcrate`) for fast iteration and debugging.
- `apps/desktop/`: React + Tailwind UI. Serves as the web frontend.
- `apps/bridge/`: Unified web server and local bridge (API + SSE events). Now serves the frontend statically in production mode.
- `docs/`: product + Rekordbox + metadata docs (Mermaid diagrams live here).
- `Dockerfile` & `render.yaml`: Deployment configuration for Render.com.
- Output/runtime artifacts (not committed):
  - `DJ Library/`: local watch-folder test outputs (e.g. `DJ Library/00_INBOX/`)
  - `.dropcrate/`: cached downloader binaries and helpers

Keep pipeline/metadata logic in `packages/core/`. UI-only logic stays in `apps/desktop/`. Bridge endpoints live in `apps/bridge/`.

## Build, Test, and Development Commands

- `npm install --cache ./.npm-cache`: install dependencies (avoids user global npm cache issues).
- `npm run typecheck`: TypeScript typecheck for all workspaces.
- `npm run build:web`: Build core and frontend for unified web deployment.
- `npm run serve:web`: Start the unified web server (Bridge + Frontend) on port 10000 (default for Render) or 8787 (local).
- Unified Web dev: `npm run dev:web:full` starts the bridge and vite dev server concurrently.
- CLI dev: `npm run dev:dropcrate -- download "<url>" --inbox "./DJ Library/00_INBOX"`.
- Desktop dev (Electron): `npm run dev:desktop` (Legacy/Local only).
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
- Deployment: Use the root `render.yaml` for one-click deployment to Render using Docker.
- Env vars: `PORT` (defaults to 10000 on Render), `OPENAI_API_KEY`, `DROPCRATE_OPENAI_MODEL`, `DROPCRATE_INBOX_DIR` (set to `/data/inbox` on Render for persistence), `DROPCRATE_COOKIES_FROM_BROWSER`, `DROPCRATE_YTDLP_COOKIES`, `DROPCRATE_ACOUSTID_KEY`.
- Do not commit `.env`, generated media, `.dropcrate/`, or `DJ Library/` outputs.
