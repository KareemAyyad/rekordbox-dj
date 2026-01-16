# DropCrate Bridge (Browser Backend)

This service lets the DropCrate UI run fully in the browser (no Electron) while still using the real `@dropcrate/core` pipeline.

## Run

From repo root:

```bash
npm run dev:web:full
```

Endpoints (default port `8787`):
- `GET /health`
- `GET /settings`, `POST /settings`
- `POST /queue/start` → returns `{ jobId }`
- `GET /events?jobId=...` (SSE stream)
- `POST /queue/cancel`
- `GET /library?inboxDir=...`

Notes:
- Settings are stored in `.dropcrate-bridge-settings.json` in repo root.
- This is intended for local development. Do not expose it to the internet.

