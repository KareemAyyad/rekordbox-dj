"""Port of packages/core/src/metadata/normalize.ts — YouTube title normalization."""

from __future__ import annotations

import re
from dataclasses import dataclass

JUNK_TITLE_PATTERNS = [
    re.compile(r"\b(official\s+video|official\s+music\s+video)\b", re.I),
    re.compile(r"\b(official\s+audio)\b", re.I),
    re.compile(r"\b(lyric\s+video|lyrics?)\b", re.I),
    re.compile(r"\b(visuali[sz]er)\b", re.I),
    re.compile(r"\b(hd|4k|8k)\b", re.I),
    re.compile(r"\b(full\s+album)\b", re.I),
]

VERSION_HINTS = [
    "original mix",
    "extended mix",
    "radio edit",
    "club mix",
    "dub",
    "edit",
    "remix",
    "rework",
    "bootleg",
    "vip mix",
    "vip",
    "mix",
]

UPPER_WORDS = {"dj", "mc", "ii", "iii", "iv", "uk", "us", "nyc", "la", "dc", "aka"}
LOWER_WORDS = {"the", "a", "an", "and", "or", "of", "vs", "vs.", "feat", "feat.", "ft", "ft.", "x"}

CORRECTIONS: dict[str, str] = {
    "jay-z": "JAY-Z",
    "jay z": "JAY-Z",
    "a$ap": "A$AP",
    "asap": "A$AP",
    "xxxtentacion": "XXXTentacion",
    "6lack": "6LACK",
    "t-pain": "T-Pain",
    "j cole": "J. Cole",
    "j. cole": "J. Cole",
    "the weeknd": "The Weeknd",
    "d.j.": "DJ",
    "m.c.": "MC",
}


@dataclass
class NormalizedMetadata:
    artist: str
    title: str
    version: str | None


def normalize_from_youtube_title(raw_title: str, uploader: str | None = None) -> NormalizedMetadata:
    raw = (raw_title or "").strip()
    uploader = (uploader or "").strip()

    title = raw

    # Remove bracketed noise
    title = re.sub(r"\[[^\]]*\]", " ", title).strip()

    # Remove common junk tokens
    for pattern in JUNK_TITLE_PATTERNS:
        title = pattern.sub(" ", title)
    title = _clean_spaces(title)

    # Remove empty parentheses left behind
    title = re.sub(r"\(\s*\)", " ", title)
    title = _clean_spaces(title)

    # Split on common artist-title separators
    artist_guess, title_guess = _split_artist_title(title)
    if artist_guess is None:
        artist_guess = uploader or "Unknown Artist"
    if title_guess is None:
        title_guess = title

    # Extract version from parentheses
    title_guess, version = _extract_version(title_guess)

    # Make title carry version for Rekordbox predictability
    final_title = f"{title_guess} ({version})" if version else title_guess

    return NormalizedMetadata(
        artist=_to_title_case_artist(_clean_spaces(artist_guess)),
        title=_clean_spaces(final_title),
        version=version,
    )


def _split_artist_title(value: str) -> tuple[str | None, str | None]:
    separators = [" - ", " \u2013 ", " \u2014 ", " | "]
    for sep in separators:
        idx = value.find(sep)
        if idx > 0:
            left = value[:idx].strip()
            right = value[idx + len(sep) :].strip()
            if left and right:
                return left, right
    return None, None


def _extract_version(title: str) -> tuple[str, str | None]:
    match = re.search(r"\(([^)]{2,80})\)\s*$", title)
    if not match:
        return _clean_spaces(title), None

    inside = _clean_spaces(match.group(1))
    normalized = inside.lower()
    is_versiony = any(h in normalized for h in VERSION_HINTS)
    if not is_versiony:
        return _clean_spaces(title), None

    stripped = _clean_spaces(title[: match.start()].strip())
    return stripped, inside


def _clean_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _to_title_case_artist(name: str) -> str:
    trimmed = name.strip()
    if not trimmed:
        return trimmed

    lower_name = trimmed.lower()
    if lower_name in CORRECTIONS:
        return CORRECTIONS[lower_name]

    # Split on whitespace, hyphens, ampersands (keeping separators)
    words = re.split(r"(\s+|[-&])", trimmed)
    result: list[str] = []

    for word in words:
        if not word:
            continue

        # Preserve separators as-is
        if re.match(r"^(\s+|[-&])$", word):
            result.append(word)
            continue

        lower = word.lower()

        # Check word-level corrections
        if lower in CORRECTIONS:
            result.append(CORRECTIONS[lower])
            continue

        # Uppercase words
        if lower in UPPER_WORDS:
            result.append(word.upper())
            continue

        # Lowercase words (unless first real word)
        real_words = [w for w in result if not re.match(r"^(\s+|[-&])$", w)]
        is_first_word = len(real_words) == 0
        if lower in LOWER_WORDS and not is_first_word:
            result.append(lower)
            continue

        # Default: capitalize first letter
        result.append(word[0].upper() + word[1:].lower() if len(word) > 1 else word.upper())

    return "".join(result)
