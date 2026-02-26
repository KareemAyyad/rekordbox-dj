"""Port of packages/core/src/util/naming.ts — Filename sanitization."""

from __future__ import annotations

import re


def sanitize_file_component(value: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]', " ", value)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = re.sub(r"[. ]+$", "", cleaned)
    return cleaned if cleaned else "Untitled"


def make_rekordbox_filename(
    artist: str, title: str, ext: str, bpm: int | None = None, key: str | None = None
) -> str:
    parts = [str(bpm) if bpm else None, key]
    suffix_parts = [p for p in parts if p]
    suffix = f" [{' '.join(suffix_parts)}]" if suffix_parts else ""
    return sanitize_file_component(f"{artist} - {title}{suffix}") + ext
