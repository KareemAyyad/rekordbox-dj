"""Tests for tag building and thumbnail URL selection."""

from dropcrate.services.tagger import _build_tags, pick_best_thumbnail_url


# --- _build_tags ---

def test_build_tags_basic():
    tags = _build_tags(artist="Artist", title="Title", genre="House")
    assert tags["artist"] == "Artist"
    assert tags["title"] == "Title"
    assert tags["genre"] == "House"
    assert "comment" in tags


def test_build_tags_comment_has_source():
    tags = _build_tags(
        artist="A", title="T", genre="House",
        source_url="https://youtube.com/watch?v=abc", source_id="abc"
    )
    assert "SOURCE: YouTube" in tags["comment"]
    assert "URL: https://youtube.com/watch?v=abc" in tags["comment"]
    assert "YOUTUBE_ID: abc" in tags["comment"]


def test_build_tags_comment_has_energy():
    tags = _build_tags(artist="A", title="T", genre="House", energy="3/5")
    assert "ENERGY: 3/5" in tags["comment"]


def test_build_tags_comment_has_time():
    tags = _build_tags(artist="A", title="T", genre="House", time_slot="Peak")
    assert "TIME: Peak" in tags["comment"]


def test_build_tags_comment_has_vibe():
    tags = _build_tags(artist="A", title="T", genre="House", vibe="Dark, Driving")
    assert "VIBE: Dark, Driving" in tags["comment"]


def test_build_tags_comment_omits_empty_energy():
    tags = _build_tags(artist="A", title="T", genre="House", energy="")
    assert "ENERGY:" not in tags["comment"]


def test_build_tags_comment_omits_empty_time():
    tags = _build_tags(artist="A", title="T", genre="House", time_slot="")
    assert "TIME:" not in tags["comment"]


def test_build_tags_comment_omits_empty_vibe():
    tags = _build_tags(artist="A", title="T", genre="House", vibe="")
    assert "VIBE:" not in tags["comment"]


def test_build_tags_with_album():
    tags = _build_tags(artist="A", title="T", genre="House", album="Great Album")
    assert tags["album"] == "Great Album"


def test_build_tags_no_album_if_empty():
    tags = _build_tags(artist="A", title="T", genre="House", album="")
    assert "album" not in tags


def test_build_tags_with_year():
    tags = _build_tags(artist="A", title="T", genre="House", year="2024")
    assert tags["date"] == "2024"


def test_build_tags_no_year_if_empty():
    tags = _build_tags(artist="A", title="T", genre="House", year="")
    assert "date" not in tags


def test_build_tags_with_label():
    tags = _build_tags(artist="A", title="T", genre="House", label="Defected Records")
    assert tags["publisher"] == "Defected Records"


def test_build_tags_no_label_if_empty():
    tags = _build_tags(artist="A", title="T", genre="House", label="")
    assert "publisher" not in tags


def test_build_tags_all_fields():
    tags = _build_tags(
        artist="Artist",
        title="Track",
        genre="Afro House",
        energy="4/5",
        time_slot="Peak",
        vibe="Tribal, Organic",
        album="Album",
        year="2024",
        label="Label Records",
        source_url="https://youtube.com/watch?v=xyz",
        source_id="xyz",
    )
    assert tags["artist"] == "Artist"
    assert tags["title"] == "Track"
    assert tags["genre"] == "Afro House"
    assert tags["album"] == "Album"
    assert tags["date"] == "2024"
    assert tags["publisher"] == "Label Records"
    assert "ENERGY: 4/5" in tags["comment"]
    assert "TIME: Peak" in tags["comment"]
    assert "VIBE: Tribal, Organic" in tags["comment"]
    assert "SOURCE: YouTube" in tags["comment"]
    assert "URL: https://youtube.com/watch?v=xyz" in tags["comment"]
    assert "YOUTUBE_ID: xyz" in tags["comment"]


# --- pick_best_thumbnail_url ---

def test_thumbnail_picks_largest():
    info = {
        "thumbnails": [
            {"url": "https://img/small.jpg", "width": 120, "height": 90},
            {"url": "https://img/large.jpg", "width": 1280, "height": 720},
            {"url": "https://img/medium.jpg", "width": 480, "height": 360},
        ]
    }
    assert pick_best_thumbnail_url(info) == "https://img/large.jpg"


def test_thumbnail_falls_back_to_thumbnail_field():
    info = {"thumbnail": "https://img/default.jpg"}
    assert pick_best_thumbnail_url(info) == "https://img/default.jpg"


def test_thumbnail_no_thumbnails():
    info = {}
    assert pick_best_thumbnail_url(info) is None


def test_thumbnail_with_preference():
    info = {
        "thumbnails": [
            {"url": "https://img/a.jpg", "width": 100, "height": 100, "preference": 100},
            {"url": "https://img/b.jpg", "width": 200, "height": 200, "preference": -1},
        ]
    }
    # a has score 100*100 + 100 = 10100, b has score 200*200 + (-1) = 39999
    result = pick_best_thumbnail_url(info)
    assert result == "https://img/b.jpg"


def test_thumbnail_skips_entries_without_url():
    info = {
        "thumbnails": [
            {"width": 1000, "height": 1000},
            {"url": "https://img/valid.jpg", "width": 10, "height": 10},
        ]
    }
    assert pick_best_thumbnail_url(info) == "https://img/valid.jpg"
