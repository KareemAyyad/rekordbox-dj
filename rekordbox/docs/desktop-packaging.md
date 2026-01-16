# Desktop Packaging (Production)

DropCrate Desktop uses Electron + Vite and is packaged with `electron-builder`.

## Build prerequisites

- Node.js 20+
- macOS builds should be run on macOS
- Windows builds should be run on Windows (recommended)  
  Cross-building Windows from macOS often requires additional tooling (Wine).

## Install

If you run into cache permission issues, use:

```
HOME="$PWD" npm install --cache "$PWD/.npm-cache"
```

## Build renderer

```
npm run build:desktop
```

## Package (no installer, for quick testing)

```
npm run pack:desktop
```

Output: `apps/desktop/release/`

## macOS (Apple Silicon)

```
npm run dist:mac:arm64
```

If DMG creation fails on your machine due to `hdiutil` restrictions, build the ZIP instead:

```
npm run dist:mac:arm64:zip
```

## macOS (Intel x64)

```
npm run dist:mac:x64
```

## Windows (x64)

```
npm run dist:win:x64
```

## Code signing / notarization (macOS)

For a truly “production ready” macOS experience (no warnings), you will need:
- Apple Developer ID signing
- Notarization

This repo does not include signing secrets; configure them in your CI or local environment when you’re ready.

## GitHub Actions (recommended for Windows + repeatable builds)

This repo includes a workflow that builds installers on native runners:
- macOS arm64 artifact
- Windows x64 artifact

Workflow file: `.github/workflows/release.yml:1`
