# CLI reference

## Command

```
dropcrate download <urls...>
```

URLs:
- 1–10 for MVP (FIFO queue)

## Options (most important)

- `--inbox <path>`: output folder (Rekordbox watch folder)
- `--mode <audio|video|both>`: default is `audio`
- `--fast`: keep native codec, **no** loudness normalization (quick grabs)
- `--no-normalize`: disable normalization while keeping other defaults

## DJ tag defaults

DropCrate auto-tags by default. When tags are unknown, it writes:
- `genre = Other`
- `ENERGY/TIME/VIBE` omitted in Comments

## Loudness targets

- `--lufs <num>` (default: `-14`)
- `--true-peak <num>` (default: `-1.0`)
- `--lra <num>` (default: `11`)

## Examples

DJ-safe default (recommended):
```
npm run dev:dropcrate -- download "https://www.youtube.com/watch?v=..." --inbox "./DJ Library/00_INBOX"
```

Fast mode:
```
npm run dev:dropcrate -- download "https://www.youtube.com/watch?v=..." --fast --inbox "./DJ Library/00_INBOX"
```

Note: browser mode (`npm run dev:web:full`) can use `OPENAI_API_KEY` for higher-quality auto-tagging.
