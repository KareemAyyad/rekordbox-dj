# DropCrate Quickstart

Get up and running with DropCrate in 5 minutes.

## Prerequisites

- Node.js 20+
- npm

## Installation

```bash
# Clone and install
git clone <repo-url>
cd rekordbox
npm install --cache ./.npm-cache

# Build
npm run build
```

## Quick Start (Browser UI)

The browser UI is the recommended way to use DropCrate:

```bash
npm run dev:web:full
```

Then open http://localhost:5173 in your browser.

### Basic Workflow

1. **Paste URLs**: Add YouTube URLs (one per line or comma-separated)
2. **Auto-classify**: Click "Classify" to auto-detect genre, energy, and vibe
3. **Set inbox**: Choose your Rekordbox watch folder (e.g., `~/DJ Library/00_INBOX`)
4. **Download**: Click "Start Downloads"

Files will appear in your inbox folder, ready for Rekordbox import.

## Quick Start (CLI)

For command-line usage:

```bash
# Basic download (DJ-safe: AIFF + normalized)
npm run dev:dropcrate -- download "https://youtube.com/watch?v=..." --inbox "./DJ Library/00_INBOX"

# Fast mode (keeps original codec, no normalization)
npm run dev:dropcrate -- download "https://youtube.com/watch?v=..." --fast

# Multiple URLs with parallel downloads
npm run dev:dropcrate -- download "URL1" "URL2" "URL3" --concurrent 3

# See all options
npm run dev:dropcrate -- download --help
```

## Output Formats

| Mode | Format | Normalization | Use Case |
|------|--------|---------------|----------|
| `--dj-safe` | AIFF 44.1kHz/16-bit | -14 LUFS | Club/Festival DJing |
| `--fast` | Original codec | None | Quick preview |

## Optional: Enhanced Metadata

### AcoustID Fingerprinting

Get accurate artist/title from audio fingerprinting:

1. Install Chromaprint: `brew install chromaprint` (macOS) or `apt install libchromaprint-tools` (Linux)
2. Get an API key from https://acoustid.org/my-applications
3. Add to `.env`:
   ```
   DROPCRATE_ACOUSTID_KEY=your_key_here
   ```

### OpenAI Auto-classification

For smarter genre/energy detection in browser mode:

1. Add to `.env`:
   ```
   OPENAI_API_KEY=your_key_here
   ```

## Troubleshooting

### Rate Limiting (429 errors)

YouTube may rate-limit requests. Solutions:
- Wait a few minutes and retry
- Use browser cookies: `DROPCRATE_COOKIES_FROM_BROWSER=chrome`

### Age-Restricted Content

Set up browser cookies:
```
DROPCRATE_COOKIES_FROM_BROWSER=chrome
```

### Geo-Restricted Content

Use a VPN or proxy to access geo-blocked videos.

## Next Steps

- See [CLI documentation](cli.md) for full command reference
- See [troubleshooting](troubleshooting.md) for common issues
- See [architecture](architecture.md) for technical details
