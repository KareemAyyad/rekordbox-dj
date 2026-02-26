"""Comprehensive tests for heuristic DJ tag classification."""

from dropcrate.services.classify_heuristic import heuristic_classify


# --- Content kind detection ---

def test_track_with_genre():
    result = heuristic_classify("1", {
        "title": "Amazing Afro House Track",
        "categories": ["Music"],
        "tags": ["music", "afro house"],
        "duration": 300,
    })
    assert result.kind == "track"
    assert result.genre == "Afro House"
    assert result.confidence > 0.5


def test_dj_set_detection():
    result = heuristic_classify("2", {
        "title": "DJ Set at Boiler Room London 2024",
        "categories": ["Music"],
        "tags": ["dj set", "boiler room"],
        "duration": 3600,
    })
    assert result.kind == "set"


def test_tutorial_detection():
    result = heuristic_classify("3", {
        "title": "How To DJ - Beatmatching Tutorial for Beginners",
        "categories": ["Education"],
        "tags": ["dj tutorial"],
        "duration": 600,
    })
    assert result.kind == "video"
    assert result.genre is None


def test_podcast_detection():
    result = heuristic_classify("6", {
        "title": "Weekly Music Podcast Episode 45",
        "categories": ["Music"],
        "tags": ["podcast", "music"],
        "duration": 3600,
    })
    assert result.kind == "podcast"


def test_zero_confidence_unknown():
    result = heuristic_classify("5", {
        "title": "",
        "categories": [],
        "tags": [],
    })
    assert result.kind in ("video", "unknown")


def test_live_set_with_full_set_keyword():
    result = heuristic_classify("7", {
        "title": "Boris Brejcha Full Set at Tomorrowland",
        "categories": ["Music"],
        "tags": ["techno", "live"],
        "duration": 5400,
    })
    assert result.kind == "set"


def test_short_track_not_set():
    result = heuristic_classify("8", {
        "title": "Artist - Great Track",
        "categories": ["Music"],
        "tags": ["music", "house"],
        "duration": 240,
    })
    assert result.kind == "track"


def test_essential_mix():
    result = heuristic_classify("9", {
        "title": "Essential Mix - Pete Tong BBC Radio 1",
        "categories": ["Music"],
        "tags": ["essential mix", "bbc"],
        "duration": 7200,
    })
    assert result.kind == "set"


def test_rekordbox_tutorial():
    result = heuristic_classify("11", {
        "title": "Rekordbox DJ Tutorial - Hot Cues and Beat Grid",
        "categories": ["Education"],
        "tags": ["rekordbox", "tutorial"],
        "duration": 900,
    })
    assert result.kind == "video"
    assert result.genre is None


def test_serato_tutorial():
    result = heuristic_classify("12", {
        "title": "How to use Serato DJ Pro for beginners",
        "categories": ["Music"],
        "tags": ["serato", "dj tips"],
        "duration": 600,
    })
    assert result.kind == "video"


# --- Genre detection ---

def test_techno_genre():
    result = heuristic_classify("20", {
        "title": "Amelie Lens - Techno Set at Tomorrowland",
        "categories": ["Music"],
        "tags": ["techno"],
        "duration": 200,
    })
    assert result.genre is not None
    assert "Techno" in result.genre


def test_hard_techno():
    result = heuristic_classify("21", {
        "title": "Hard Techno Industrial Mix 2024",
        "categories": ["Music"],
        "tags": ["hard techno"],
        "duration": 300,
    })
    assert result.genre == "Hard Techno"


def test_melodic_techno():
    result = heuristic_classify("22", {
        "title": "Melodic Techno Progressive Mix",
        "categories": ["Music"],
        "tags": ["melodic techno"],
        "duration": 300,
    })
    assert result.genre == "Melodic Techno"


def test_minimal_techno():
    result = heuristic_classify("23", {
        "title": "Minimal Techno Track",
        "categories": ["Music"],
        "tags": ["minimal"],
        "duration": 300,
    })
    assert result.genre == "Minimal Techno"


def test_acid_techno():
    result = heuristic_classify("24", {
        "title": "Acid Techno Session",
        "categories": ["Music"],
        "tags": ["acid"],
        "duration": 300,
    })
    assert result.genre == "Acid"


def test_tech_house():
    result = heuristic_classify("25", {
        "title": "Tech House Mix Summer 2024",
        "categories": ["Music"],
        "tags": ["tech house"],
        "duration": 300,
    })
    assert result.genre == "Tech House"


def test_deep_house():
    result = heuristic_classify("26", {
        "title": "Deep House Vibes Playlist",
        "categories": ["Music"],
        "tags": ["deep house"],
        "duration": 300,
    })
    assert result.genre == "Deep House"


def test_progressive_house():
    result = heuristic_classify("27", {
        "title": "Progressive House Mix",
        "categories": ["Music"],
        "tags": ["progressive"],
        "duration": 300,
    })
    assert result.genre == "Progressive House"


def test_amapiano():
    result = heuristic_classify("28", {
        "title": "Amapiano Mix 2024",
        "categories": ["Music"],
        "tags": ["amapiano"],
        "duration": 300,
    })
    assert result.genre == "Amapiano"


def test_afro_house():
    result = heuristic_classify("29", {
        "title": "Afro House Festival Mix",
        "categories": ["Music"],
        "tags": ["afro house"],
        "duration": 300,
    })
    assert result.genre == "Afro House"


def test_drum_and_bass():
    result = heuristic_classify("30", {
        "title": "Drum and Bass Mix",
        "categories": ["Music"],
        "tags": ["dnb"],
        "duration": 300,
    })
    assert result.genre == "Drum & Bass"


def test_dubstep():
    result = heuristic_classify("31", {
        "title": "Dubstep Banger",
        "categories": ["Music"],
        "tags": ["dubstep"],
        "duration": 300,
    })
    assert result.genre == "Dubstep"


def test_trance():
    result = heuristic_classify("32", {
        "title": "Trance Classics Set",
        "categories": ["Music"],
        "tags": ["trance"],
        "duration": 300,
    })
    assert result.genre == "Trance"


def test_psytrance():
    result = heuristic_classify("33", {
        "title": "Psytrance Goa Set",
        "categories": ["Music"],
        "tags": ["psytrance"],
        "duration": 300,
    })
    assert result.genre == "Psytrance"


def test_breaks():
    result = heuristic_classify("34", {
        "title": "Breaks and Breakbeat Mix",
        "categories": ["Music"],
        "tags": ["breaks"],
        "duration": 300,
    })
    assert result.genre == "Breaks"


def test_disco():
    result = heuristic_classify("35", {
        "title": "Disco Nu-Disco Grooves",
        "categories": ["Music"],
        "tags": ["disco"],
        "duration": 300,
    })
    assert "Disco" in result.genre


def test_uk_garage():
    result = heuristic_classify("36", {
        "title": "UK Garage Mix 2-step",
        "categories": ["Music"],
        "tags": ["ukg"],
        "duration": 300,
    })
    assert result.genre == "UK Garage"


def test_generic_house():
    result = heuristic_classify("37", {
        "title": "House Music Track",
        "categories": ["Music"],
        "tags": ["house"],
        "duration": 300,
    })
    assert result.genre == "House"


def test_electro():
    result = heuristic_classify("38", {
        "title": "Electro Beats",
        "categories": ["Music"],
        "tags": ["electro"],
        "duration": 300,
    })
    assert result.genre == "Electro"


def test_downtempo():
    result = heuristic_classify("39", {
        "title": "Downtempo Ambient Chill Out",
        "categories": ["Music"],
        "tags": ["downtempo"],
        "duration": 300,
    })
    assert result.genre == "Downtempo"


# --- Energy / Time / Vibe detection ---

def test_warmup_energy():
    result = heuristic_classify("40", {
        "title": "Warmup Set Opening DJ Mix",
        "categories": ["Music"],
        "tags": ["music", "house"],
        "duration": 3600,
    })
    assert result.energy == "2/5"
    assert result.time == "Warmup"


def test_peak_energy():
    result = heuristic_classify("41", {
        "title": "Peak Time Banger Festival Main Stage",
        "categories": ["Music"],
        "tags": ["music", "techno"],
        "duration": 300,
    })
    assert result.energy == "4/5"
    assert result.time == "Peak"


def test_closing_energy():
    result = heuristic_classify("42", {
        "title": "Closing Set Afterhours",
        "categories": ["Music"],
        "tags": ["music"],
        "duration": 3600,
    })
    assert result.energy == "3/5"
    assert result.time == "Closing"


def test_vibe_dark():
    result = heuristic_classify("43", {
        "title": "Dark Techno Track",
        "categories": ["Music"],
        "tags": ["techno", "dark"],
        "duration": 300,
    })
    assert result.vibe is not None
    assert "Dark" in result.vibe


def test_vibe_vocal():
    result = heuristic_classify("44", {
        "title": "Vocal House Track",
        "categories": ["Music"],
        "tags": ["house", "vocal"],
        "duration": 300,
    })
    assert result.vibe is not None
    assert "Vocal" in result.vibe


def test_vibe_tribal():
    result = heuristic_classify("45", {
        "title": "Tribal Afro House Mix",
        "categories": ["Music"],
        "tags": ["tribal", "afro house"],
        "duration": 300,
    })
    assert result.vibe is not None
    assert "Tribal" in result.vibe


def test_vibe_organic():
    result = heuristic_classify("46", {
        "title": "Organic House Session",
        "categories": ["Music"],
        "tags": ["organic", "house"],
        "duration": 300,
    })
    assert result.vibe is not None
    assert "Organic" in result.vibe


def test_vibe_groovy():
    result = heuristic_classify("48", {
        "title": "Funky Groovy Disco Track",
        "categories": ["Music"],
        "tags": ["funky", "disco"],
        "duration": 300,
    })
    assert result.vibe is not None
    assert "Groovy" in result.vibe


def test_vibe_hypnotic():
    result = heuristic_classify("49", {
        "title": "Hypnotic Techno",
        "categories": ["Music"],
        "tags": ["hypnotic", "techno"],
        "duration": 300,
    })
    assert result.vibe is not None
    assert "Hypnotic" in result.vibe


# --- Confidence scoring ---

def test_high_confidence_track():
    result = heuristic_classify("50", {
        "title": "Dark Minimal Techno Track Opening Warmup",
        "categories": ["Music"],
        "tags": ["techno", "music", "dark"],
        "duration": 300,
    })
    assert result.confidence >= 0.7


def test_low_confidence_no_signals():
    result = heuristic_classify("51", {
        "title": "Random Video Title",
        "categories": [],
        "tags": [],
    })
    assert result.confidence < 0.5


# --- Notes ---

def test_notes_for_podcast():
    result = heuristic_classify("60", {
        "title": "Weekly Music Podcast Episode 45",
        "categories": ["Music"],
        "tags": ["podcast", "music"],
        "duration": 3600,
    })
    assert "podcast" in result.notes.lower() or "show" in result.notes.lower()


def test_notes_for_tutorial():
    result = heuristic_classify("62", {
        "title": "How to DJ Tutorial",
        "categories": ["Education"],
        "tags": ["tutorial"],
        "duration": 600,
    })
    assert "tutorial" in result.notes.lower() or "video" in result.notes.lower()


# --- ClassifyResult has all required fields ---

def test_result_has_all_fields():
    result = heuristic_classify("70", {
        "title": "Test Track",
        "categories": ["Music"],
        "tags": ["house"],
        "duration": 300,
    })
    assert result.id == "70"
    assert hasattr(result, "kind")
    assert hasattr(result, "genre")
    assert hasattr(result, "energy")
    assert hasattr(result, "time")
    assert hasattr(result, "vibe")
    assert hasattr(result, "confidence")
    assert hasattr(result, "notes")
    assert 0.0 <= result.confidence <= 1.0
