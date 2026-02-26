"""Port of packages/core/src/metadata/autoclassify.ts — Heuristic DJ tag classification."""

from __future__ import annotations

import re

from dropcrate.models.schemas import ClassifyResult, ContentKind


def heuristic_classify(item_id: str, info: dict) -> ClassifyResult:
    title = (info.get("title") or "").lower()
    uploader = (info.get("uploader") or info.get("channel") or "").lower()
    desc = (info.get("description") or "").lower()
    duration = info.get("duration")

    text = f"{title}\n{uploader}\n{desc}"

    categories = [c.lower() for c in (info.get("categories") or [])]
    tags = [str(t).lower() for t in (info.get("tags") or [])]
    has_music_category = any("music" in c for c in categories)
    has_music_tags = any(
        re.search(r"\b(music|audio|song|track|remix|mix|dj|house|techno|afro|amapiano)\b", t, re.I)
        for t in tags
    )
    has_music_signals = has_music_category or has_music_tags

    # Kind detection
    looks_like_tutorial = bool(
        re.search(r"\b(how to dj|dj tutorial|tutorial|lesson|masterclass|learn to dj|dj tips)\b", text, re.I)
        or re.search(
            r"\b(rekordbox|serato|traktor|cdj|controller|beatmatch|beat matching|hot cue|hotcue|quantize|phrasing)\b",
            text, re.I,
        )
    )

    has_mix_keywords = bool(
        re.search(
            r"\b(live set|dj set|dj live|live dj|live mix|dj mix|mix|set at|session|livestream|live stream|boiler room|resident advisor|ra live|essential mix)\b",
            text, re.I,
        )
    )

    has_set_tags = any(
        re.search(r"(livedjset|djset|djliveset|liveset|livemix|djmix|radioshow)", t, re.I)
        or re.search(r"\b(dj|mix|set|boilerroom|boiler room|essentialmix|essential mix|radio show|podcast)\b", t, re.I)
        for t in tags
    )
    has_set_signals = has_mix_keywords or has_set_tags

    looks_like_set = bool(
        re.search(r"\b(full set)\b", text, re.I)
        or (has_set_signals and (duration is None or duration >= 20 * 60))
        or (re.search(r"\b(session)\b", text, re.I) and (duration is None or duration >= 20 * 60))
    )

    has_podcast_keywords = bool(re.search(r"\b(podcast|radio show|episode)\b", text, re.I))
    has_live_set_keywords = bool(
        re.search(
            r"\b(live set|dj set|dj live|live dj|live mix|dj mix|session|livestream|live stream|boiler room|resident advisor|ra live|essential mix)\b",
            text, re.I,
        )
    )
    looks_like_podcast = (
        has_podcast_keywords
        and not has_live_set_keywords
        and (duration is None or duration >= 15 * 60)
        and (has_set_signals or has_music_signals)
    )

    if looks_like_tutorial:
        kind = ContentKind.VIDEO
    elif looks_like_podcast:
        kind = ContentKind.PODCAST
    elif looks_like_set:
        kind = ContentKind.SET
    elif has_music_signals:
        kind = ContentKind.TRACK
    elif title:
        kind = ContentKind.VIDEO
    else:
        kind = ContentKind.UNKNOWN

    # Genre heuristics
    genre = _detect_genre(text)

    # Energy/time heuristics
    energy = None
    time_slot = None
    if re.search(r"\b(warmup|warm up|opening)\b", text):
        energy, time_slot = "2/5", "Warmup"
    elif re.search(r"\b(closing|afterhours|after hours)\b", text):
        energy, time_slot = "3/5", "Closing"
    elif re.search(r"\b(peak|banger|festival|main stage)\b", text):
        energy, time_slot = "4/5", "Peak"

    # Vibe heuristics
    vibes: list[str] = []
    vibe_map = {
        r"\btribal\b": "Tribal",
        r"\borganic\b": "Organic",
        r"\bvocal\b": "Vocal",
        r"\binstrumental\b": "Instrumental",
        r"\bdark\b": "Dark",
        r"\bminimal\b": "Minimal",
        r"\blatin\b": "Latin",
        r"\b(groovy|funky)\b": "Groovy",
        r"\bhypnotic\b": "Hypnotic",
        r"\bdriving\b": "Driving",
        r"\benergetic\b|high[\s-]?energy": "Energetic",
        r"\b(chill|relaxed)\b": "Chill",
    }
    for pattern, vibe_name in vibe_map.items():
        if re.search(pattern, text):
            vibes.append(vibe_name)

    # Special: melodic/uplifting only if not already a genre
    if re.search(r"\bmelodic\b", text) and genre not in ("Melodic Techno", "Melodic House & Techno"):
        vibes.append("Melodic")
    if re.search(r"\buplifting\b", text) and genre != "Uplifting Trance":
        vibes.append("Uplifting")

    vibe = ", ".join(vibes) if vibes else None

    # Confidence
    confidence = 0.0
    if kind != ContentKind.UNKNOWN:
        confidence += 0.25
    if has_music_signals:
        confidence += 0.15
    if genre:
        confidence += 0.40
    if energy or time_slot:
        confidence += 0.15
    if vibe:
        confidence += 0.10
    confidence = max(0.0, min(1.0, confidence))

    # Notes
    if kind == ContentKind.PODCAST:
        notes = "Detected long-form podcast/show; DJ tags may be less relevant."
    elif kind == ContentKind.SET:
        notes = "Detected long-form mix/set; tags are approximate."
    elif kind == ContentKind.VIDEO:
        notes = "Detected tutorial/video; DJ tags are omitted."
    else:
        notes = "Heuristic classification from YouTube metadata (conservative; may return nulls)."

    # Null out tags for non-music content
    if kind in (ContentKind.VIDEO, ContentKind.PODCAST):
        final_genre = None
    else:
        final_genre = genre or ("Other" if kind in (ContentKind.TRACK, ContentKind.SET) else None)

    return ClassifyResult(
        id=item_id,
        kind=kind,
        genre=final_genre,
        energy=energy,
        time=time_slot,
        vibe=vibe,
        confidence=confidence,
        notes=notes,
    )


def _detect_genre(text: str) -> str | None:
    """Detect genre from text. Order matters — more specific patterns first."""
    genre_patterns: list[tuple[str, str]] = [
        # Afro/Amapiano
        (r"\bamapiano\b", "Amapiano"),
        (r"\bafro\s*house\b|\bafro\b", "Afro House"),
        # Techno variants
        (r"\bhard\s*techno\b|\bindustrial\s*techno\b", "Hard Techno"),
        (r"\bmelodic\s*techno\b", "Melodic Techno"),
        (r"\bminimal\s*techno\b|\bminimal\b", "Minimal Techno"),
        (r"\bacid\s*techno\b|\bacid\b", "Acid"),
        (r"\bpeak\s*time\s*techno\b|\bdriving\s*techno\b", "Peak Time Techno"),
        (r"\btechno\b", "Techno"),
        # House variants
        (r"\btech\s*house\b", "Tech House"),
        (r"\bprogressive\s*house\b|\bprogressive\b", "Progressive House"),
        (r"\bdeep\s*house\b", "Deep House"),
        (r"\bfunky\s*house\b|\bfunky\b", "Funky House"),
        (r"\bsoulful\s*house\b|\bsoulful\b", "Soulful House"),
        (r"\bjackin\b|\bjackin'\s*house\b", "Jackin House"),
        (r"\bmelodic\s*house\b|\bmelodic\b", "Melodic House & Techno"),
        (r"\bhouse\b", "House"),
        # Bass music
        (r"\bdrum\s*(and|&|n)\s*bass\b|\bdnb\b|\bjungle\b", "Drum & Bass"),
        (r"\bdubstep\b", "Dubstep"),
        (r"\buk\s*garage\b|\bukg\b|\b2[- ]?step\b", "UK Garage"),
        (r"\bbreaks\b|\bbreakbeat\b", "Breaks"),
        (r"\bbassline\b|\bbass\s*house\b", "Bass House"),
        # Trance
        (r"\bpsy\s*trance\b|\bpsytrance\b|\bgoa\b", "Psytrance"),
        (r"\buplifting\s*trance\b|\buplifting\b", "Uplifting Trance"),
        (r"\btrance\b", "Trance"),
        # Other electronic
        (r"\bdisco\b|\bnu[\s-]?disco\b", "Disco / Nu-Disco"),
        (r"\belectro\b", "Electro"),
        (r"\bdowntempo\b|\bchill\s*out\b|\bambient\b", "Downtempo"),
    ]

    for pattern, genre_name in genre_patterns:
        if re.search(pattern, text):
            return genre_name
    return None
