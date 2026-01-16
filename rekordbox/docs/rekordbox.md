# Rekordbox setup (Watch Folder)

DropCrate is designed around a watch-folder workflow:

1) Choose an inbox folder that Rekordbox watches (default recommended):
   - `~/DJ Library/00_INBOX/`
2) Configure Rekordbox to auto-import from that folder
3) Run DropCrate and point `--inbox` to that watch folder

## Recommended library structure

```
DJ Library/
├── 00_INBOX/
├── 10_TRACKS/
│   ├── Afro House/
│   ├── House/
│   └── Other/
├── 20_SETS/
└── 99_ARCHIVE/
```

## Smart Playlists (how DropCrate is meant to be used)

Because DJ tags live in `Comments`, you can create Smart Playlists like:

- Afro House + `ENERGY: 4/5`
- `TIME: Warmup` and BPM under 120 (once BPM is added)
- `VIBE: Tribal` for specific set flavors

## Practical workflow

- Download into `00_INBOX`
- Review/import in Rekordbox
- Move “keepers” into `10_TRACKS/<Genre>/` later (DropCrate will automate this in a future version)

