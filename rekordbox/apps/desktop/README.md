# DropCrate Desktop (Electron)

This app is the UI layer for DropCrate. It calls the existing `@dropcrate/core` pipeline via Electron IPC.

## Run (dev)

Install (recommended for this environment):

```bash
HOME="$PWD" npm install --cache "$PWD/.npm-cache"
```

Desktop:

```bash
npm run dev:desktop
```

Web-only UI (no Electron/IPC; useful for UI iteration):

```bash
npm run dev:web
```

## Build (renderer)

```bash
npm run build:desktop
```

## Notes

- If Electron fails to launch due to OS/sandbox constraints, use `npm run dev:web` to continue UI work.
- The Queue view requires the Electron preload bridge (`window.dropcrate`) to run downloads; web-only mode shows a clear error for backend actions.

