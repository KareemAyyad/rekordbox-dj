"""Chromaprint fingerprinting + AcoustID + MusicBrainz lookup.

Port of packages/core/src/metadata/musicbrainz.ts.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import httpx

from dropcrate import config

_ACOUSTID_CACHE: dict[str, dict] = {}
_CACHE_MAX = 500


@dataclass
class MusicMatch:
    provider: str
    acoustid_score: float
    recording_mbid: str
    recording_title: str
    artist: str
    album: str | None
    year: str | None
    label: str | None
    applied: bool


@dataclass
class MatchedMetadata:
    artist: str
    title: str
    version: str | None
    album: str | None
    year: str | None
    label: str | None
    match: MusicMatch


async def try_match_music_metadata(
    audio_path: Path,
    fallback_artist: str,
    fallback_title: str,
    fallback_version: str | None,
    title_had_separator: bool,
) -> MatchedMetadata | None:
    """Attempt fingerprint-based metadata matching. Returns None if unavailable or low confidence."""
    key = config.ACOUSTID_KEY
    if not key:
        return None

    # Get fingerprint
    try:
        duration, fingerprint = await _get_chromaprint(audio_path)
    except Exception:
        return None

    # Cache lookup
    cache_key = hashlib.sha1(f"{duration}:{fingerprint}".encode()).hexdigest()
    cached = _ACOUSTID_CACHE.get(cache_key)

    if cached is None:
        try:
            cached = await _acoustid_lookup(key, duration, fingerprint)
            # LRU cache
            _ACOUSTID_CACHE[cache_key] = cached
            if len(_ACOUSTID_CACHE) > _CACHE_MAX:
                oldest = next(iter(_ACOUSTID_CACHE))
                del _ACOUSTID_CACHE[oldest]
        except Exception:
            return None

    best = _pick_best_acoustid(cached)
    if not best:
        return None

    # Conservative thresholds
    required = 0.95 if title_had_separator else 0.85
    if best["score"] < required:
        return None

    # MusicBrainz lookup
    try:
        mb = await _musicbrainz_recording(best["mbid"])
    except Exception:
        return None

    artist = _join_artist_credit(mb.get("artist-credit", []))
    title = str(mb.get("title", "")).strip()
    if not artist or not title:
        return None

    album, year, label = _pick_best_release(mb.get("releases"))

    # Apply fallback version
    final_title, version = _apply_fallback_version(title, fallback_version)
    applied = artist != fallback_artist or final_title != fallback_title

    match = MusicMatch(
        provider="acoustid+musicbrainz",
        acoustid_score=best["score"],
        recording_mbid=best["mbid"],
        recording_title=title,
        artist=artist,
        album=album,
        year=year,
        label=label,
        applied=applied,
    )

    return MatchedMetadata(
        artist=artist,
        title=final_title,
        version=version,
        album=album,
        year=year,
        label=label,
        match=match,
    )


async def _get_chromaprint(audio_path: Path) -> tuple[float, str]:
    """Run fpcalc and return (duration, fingerprint)."""
    proc = await asyncio.create_subprocess_exec(
        config.FPCALC_PATH,
        "-json",
        str(audio_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=20)
    if proc.returncode != 0:
        raise RuntimeError("fpcalc failed")
    data = json.loads(stdout)
    return float(data["duration"]), str(data["fingerprint"])


async def _acoustid_lookup(key: str, duration: float, fingerprint: str) -> dict:
    """POST to AcoustID API."""
    async with httpx.AsyncClient(timeout=25) as client:
        resp = await client.post(
            "https://api.acoustid.org/v2/lookup",
            data={
                "client": key,
                "meta": "recordings",
                "duration": str(round(duration)),
                "fingerprint": fingerprint,
            },
        )
        resp.raise_for_status()
        return resp.json()


def _pick_best_acoustid(resp: dict) -> dict | None:
    results = resp.get("results", [])
    best_score = -1.0
    best_mbid = None
    for r in results:
        score = r.get("score", 0)
        recordings = r.get("recordings", [])
        if not recordings:
            continue
        rec_id = recordings[0].get("id")
        if rec_id and score > best_score:
            best_score = score
            best_mbid = rec_id
    if not best_mbid or best_score < 0:
        return None
    return {"score": best_score, "mbid": best_mbid}


async def _musicbrainz_recording(mbid: str) -> dict:
    """Fetch recording details from MusicBrainz."""
    url = f"https://musicbrainz.org/ws/2/recording/{mbid}"
    async with httpx.AsyncClient(timeout=25) as client:
        resp = await client.get(
            url,
            params={"inc": "artists+releases+labels", "fmt": "json"},
            headers={"User-Agent": "DropCrate/0.1.0 (local)"},
        )
        resp.raise_for_status()
        return resp.json()


def _join_artist_credit(ac: list) -> str:
    parts = []
    for p in ac:
        name = str(p.get("artist", {}).get("name") or p.get("name", "")).strip()
        if name:
            parts.append(name)
    return " & ".join(parts)


def _pick_best_release(releases: list | None) -> tuple[str | None, str | None, str | None]:
    if not releases:
        return None, None, None
    best = next((r for r in releases if str(r.get("status", "")).lower() == "official"), releases[0])
    album = str(best.get("title", "")).strip() or None
    date = str(best.get("date", ""))
    year = date[:4] if len(date) >= 4 else None
    label_info = best.get("label-info", [])
    label = None
    if label_info:
        label = str(label_info[0].get("label", {}).get("name", "")).strip() or None
    return album, year, label


def _apply_fallback_version(title: str, fallback_version: str | None) -> tuple[str, str | None]:
    """Extract version from MusicBrainz title, or apply fallback from YouTube."""
    import re

    match = re.match(r"^(.+?)\s*\(([^)]{2,80})\)\s*$", title)
    if match:
        return title, match.group(2).strip()

    version = (fallback_version or "").strip()
    if not version:
        return title, None
    return f"{title} ({version})", version
