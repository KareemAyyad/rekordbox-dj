# Troubleshooting

## “Sound is very low”

That’s normal for many YouTube sources. Use the default DJ-safe mode (normalization on) or explicitly:

```
npm run dev:dropcrate -- download "<url>" --inbox "./DJ Library/00_INBOX"
```

Disable normalization only if you know the source is already mastered loud:

```
npm run dev:dropcrate -- download "<url>" --no-normalize --fast --inbox "./DJ Library/00_INBOX"
```

## “yt-dlp fails to run”

DropCrate auto-fetches `yt-dlp` and may fall back to a Python zipapp.

Fixes:
- Ensure you have Python 3.10+ available (`python3.11 --version`)
- Or set a known-good yt-dlp path:
  - `DROPCRATE_YTDLP_PATH=/path/to/yt-dlp`

## “Sign in to confirm you’re not a bot”

Some networks/accounts trigger a YouTube bot-check. DropCrate supports passing cookies to `yt-dlp`:

- Use browser cookies (recommended): `DROPCRATE_COOKIES_FROM_BROWSER=chrome` (or `safari`, `firefox`)
- Or use an exported cookies file: `DROPCRATE_YTDLP_COOKIES=/path/to/cookies.txt`

Browser mode loads `.env` automatically (copy `.env.example` → `.env`).

## “Rekordbox didn’t auto-import”

Checklist:
- Rekordbox watch folder points to the same `--inbox` path
- You have permissions to write into that folder
- Try writing to a local folder first (`./DJ Library/00_INBOX`) and confirm imports

## “Fingerprint matching didn’t change Artist/Title”

Fingerprint matching is optional and only runs when:
- `DROPCRATE_ACOUSTID_KEY` is set
- `fpcalc` (Chromaprint) is installed or `DROPCRATE_FPCALC_PATH` points to it

Install `fpcalc`:
- macOS (Homebrew): `brew install chromaprint`
- Windows: install “Chromaprint” (or put `fpcalc.exe` on PATH and set `DROPCRATE_FPCALC_PATH`)

DropCrate is conservative: it will only override Artist/Title/Album/Year when the fingerprint match score is high.
