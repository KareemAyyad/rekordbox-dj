"""Rekordbox XML export — generates DJ_PLAYLISTS XML with auto-playlists.

Produces a standard rekordbox XML file that can be imported via
File > Import Collection in XML format. Tracks include all DropCrate
metadata and are organized into auto-generated playlists by genre,
energy level, and time slot.

Format spec: https://cdn.rekordbox.com/files/20200410160904/xml_format_list.pdf
"""

from __future__ import annotations

import os
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote
from xml.etree.ElementTree import Element, SubElement, ElementTree, indent


# Maps audio_format values to the Kind string rekordbox expects.
KIND_MAP = {
    "aiff": "AIFF Audio File",
    "wav": "WAV Audio File",
    "flac": "FLAC Audio File",
    "mp3": "MP3 Audio File",
}

# Maps energy fraction to human-readable name for playlists.
ENERGY_LABEL = {
    "1/5": "Low",
    "2/5": "Medium-Low",
    "3/5": "Medium",
    "4/5": "High",
    "5/5": "Very High",
}

# Maps energy fraction to rekordbox Rating (0-255 scale, 51 per star).
ENERGY_RATING = {
    "1/5": "51",
    "2/5": "102",
    "3/5": "153",
    "4/5": "204",
    "5/5": "255",
}


def _file_uri(absolute_path: str) -> str:
    """Convert an absolute file path to a rekordbox file URI.

    Example:
        '/Users/kareem/Music/Dua Lipa - Levitating.aiff'
        → 'file://localhost/Users/kareem/Music/Dua%20Lipa%20-%20Levitating.aiff'

    Rekordbox requires ``file://localhost/`` prefix with URL-encoded path.
    Forward slashes are NOT encoded.  Spaces become ``%20``.
    """
    # Ensure POSIX-style path
    posix = absolute_path.replace("\\", "/")
    # Remove leading slash for encoding, then re-add
    if posix.startswith("/"):
        posix = posix[1:]
    encoded = quote(posix, safe="/:@!$&'()*+,;=-._~")
    return f"file://localhost/{encoded}"


def _date_only(iso_timestamp: str | None) -> str:
    """Extract yyyy-mm-dd from an ISO timestamp string."""
    if not iso_timestamp:
        return ""
    return iso_timestamp[:10]


def _year_only(value: str | None) -> str:
    """Extract a 4-digit year from a date or year string."""
    if not value:
        return ""
    m = re.search(r"\b(\d{4})\b", value)
    return m.group(1) if m else ""


def _safe_int(value, default: int = 0) -> str:
    """Convert a value to an integer string, or return default."""
    if value is None:
        return str(default)
    try:
        return str(int(float(value)))
    except (ValueError, TypeError):
        return str(default)


def generate_rekordbox_xml(tracks: list[dict], output_path: Path) -> Path:
    """Generate a rekordbox-compatible XML file with tracks and auto-playlists.

    Args:
        tracks: List of dicts with keys from the ``library_tracks`` table.
            Required: file_path, artist, title, genre, audio_format
            Optional: energy, time_slot, vibe, duration_seconds, downloaded_at,
                      album, year, label
        output_path: Where to write the XML file.

    Returns:
        Path to the generated XML file.
    """
    root = Element("DJ_PLAYLISTS", Version="1.0.0")
    SubElement(root, "PRODUCT", Name="DropCrate", Version="1.0.0", Company="")

    # --- COLLECTION ---
    collection = SubElement(root, "COLLECTION", Entries=str(len(tracks)))

    # Assign sequential TrackID and build lookup for playlists
    track_ids: dict[str, int] = {}  # dropcrate id → XML TrackID

    for idx, t in enumerate(tracks, start=1):
        file_path = t.get("file_path", "")
        dc_id = t.get("id", str(idx))
        track_ids[dc_id] = idx

        energy = (t.get("energy") or "").strip()

        attrs: dict[str, str] = {
            "TrackID": str(idx),
            "Name": t.get("title", "") or "Untitled",
            "Artist": t.get("artist", "") or "Unknown",
            "Genre": t.get("genre", "") or "",
            "Location": _file_uri(file_path),
            "Rating": ENERGY_RATING.get(energy, "0"),
        }

        # Optional fields — only include if present
        audio_fmt = t.get("audio_format", "")
        if audio_fmt and audio_fmt in KIND_MAP:
            attrs["Kind"] = KIND_MAP[audio_fmt]

        duration = t.get("duration_seconds")
        if duration is not None:
            attrs["TotalTime"] = _safe_int(duration)

        date_added = _date_only(t.get("downloaded_at"))
        if date_added:
            attrs["DateAdded"] = date_added

        # Grouping = time slot (visible in rekordbox's Grouping column)
        time_slot = (t.get("time_slot") or "").strip()
        if time_slot:
            attrs["Grouping"] = time_slot

        # Single-line pipe-separated comment with DJ tags
        comment_parts: list[str] = []
        vibe = (t.get("vibe") or "").strip()
        if energy:
            comment_parts.append(f"ENERGY: {energy}")
        if time_slot:
            comment_parts.append(f"TIME: {time_slot}")
        if vibe:
            comment_parts.append(f"VIBE: {vibe}")
        source_url = t.get("source_url") or ""
        source_id = t.get("source_id") or ""
        if source_url:
            comment_parts.append(f"SOURCE: YouTube")
            comment_parts.append(f"URL: {source_url}")
        if source_id:
            comment_parts.append(f"YOUTUBE_ID: {source_id}")
        if comment_parts:
            attrs["Comments"] = " | ".join(comment_parts)

        album = (t.get("album") or "").strip()
        if album:
            attrs["Album"] = album

        year_str = _year_only(t.get("year"))
        if year_str:
            attrs["Year"] = year_str

        label = (t.get("label") or "").strip()
        if label:
            attrs["Label"] = label

        # File size (read from disk if file exists)
        if file_path and os.path.isfile(file_path):
            try:
                attrs["Size"] = str(os.path.getsize(file_path))
            except OSError:
                pass

        SubElement(collection, "TRACK", **attrs)

    # --- PLAYLISTS ---
    playlists_root = SubElement(root, "PLAYLISTS")
    root_node = SubElement(playlists_root, "NODE", Type="0", Name="ROOT", Count="1")
    dropcrate_folder = SubElement(root_node, "NODE", Type="0", Name="DropCrate", Count="3")

    # Build groupings from track data
    by_genre: dict[str, list[int]] = defaultdict(list)
    by_time: dict[str, list[int]] = defaultdict(list)
    by_energy: dict[str, list[int]] = defaultdict(list)

    for t in tracks:
        dc_id = t.get("id", "")
        tid = track_ids.get(dc_id)
        if tid is None:
            continue

        genre = (t.get("genre") or "").strip()
        if genre and genre != "Other":
            by_genre[genre].append(tid)

        time_slot = (t.get("time_slot") or "").strip()
        if time_slot:
            by_time[time_slot].append(tid)

        energy = (t.get("energy") or "").strip()
        if energy:
            label = ENERGY_LABEL.get(energy, energy)
            by_energy[label].append(tid)

    def _add_playlist_group(parent: Element, name: str, groups: dict[str, list[int]]) -> None:
        if not groups:
            return
        folder = SubElement(parent, "NODE", Type="0", Name=name, Count=str(len(groups)))
        for playlist_name in sorted(groups.keys()):
            tids = groups[playlist_name]
            playlist = SubElement(
                folder, "NODE",
                Type="1", Name=playlist_name,
                Entries=str(len(tids)), KeyType="0",
            )
            for tid in tids:
                SubElement(playlist, "TRACK", Key=str(tid))

    _add_playlist_group(dropcrate_folder, "By Genre", by_genre)
    _add_playlist_group(dropcrate_folder, "By Time Slot", by_time)
    _add_playlist_group(dropcrate_folder, "By Energy", by_energy)

    # Update DropCrate folder Count to reflect actual sub-folders
    actual_count = sum(1 for g in [by_genre, by_time, by_energy] if g)
    dropcrate_folder.set("Count", str(actual_count))

    # Pretty-print for readability
    indent(root, space="  ")

    tree = ElementTree(root)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Write XML declaration manually with double quotes (rekordbox compat)
    with open(output_path, "wb") as f:
        f.write(b'<?xml version="1.0" encoding="UTF-8"?>\n')
        tree.write(f, encoding="UTF-8", xml_declaration=False)

    return output_path
