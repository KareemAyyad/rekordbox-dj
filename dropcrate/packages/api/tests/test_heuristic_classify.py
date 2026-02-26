from dropcrate.services.classify_heuristic import heuristic_classify


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


def test_techno_genre():
    result = heuristic_classify("4", {
        "title": "Amelie Lens - Techno Set at Tomorrowland",
        "categories": ["Music"],
        "tags": ["techno"],
        "duration": 200,
    })
    assert result.genre in ("Techno", None) or "Techno" in (result.genre or "")


def test_zero_confidence_unknown():
    result = heuristic_classify("5", {
        "title": "",
        "categories": [],
        "tags": [],
    })
    assert result.kind in ("video", "unknown")


def test_podcast_detection():
    result = heuristic_classify("6", {
        "title": "Weekly Music Podcast Episode 45",
        "categories": ["Music"],
        "tags": ["podcast", "music"],
        "duration": 3600,
    })
    assert result.kind == "podcast"
