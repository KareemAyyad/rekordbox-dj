"""Comprehensive tests for YouTube title → artist/title/version normalization."""

from dropcrate.services.title_parser import normalize_from_youtube_title


# --- Basic splitting ---

def test_basic_split():
    r = normalize_from_youtube_title("Artist - Title")
    assert r.artist == "Artist"
    assert r.title == "Title"
    assert r.version is None


def test_em_dash_separator():
    r = normalize_from_youtube_title("Artist \u2013 Title")
    assert r.artist == "Artist"
    assert r.title == "Title"


def test_em_dash_separator_long():
    r = normalize_from_youtube_title("Artist \u2014 Title")
    assert r.artist == "Artist"
    assert r.title == "Title"


def test_pipe_separator():
    r = normalize_from_youtube_title("Artist | Title")
    assert r.artist == "Artist"
    assert r.title == "Title"


def test_no_separator_uses_uploader():
    r = normalize_from_youtube_title("Some Cool Track", uploader="DJ Cool")
    assert r.artist == "DJ Cool"
    assert r.title == "Some Cool Track"


def test_no_separator_no_uploader():
    r = normalize_from_youtube_title("Just A Track Name")
    assert r.artist == "Unknown Artist"
    assert r.title == "Just A Track Name"


# --- Version extraction ---

def test_version_extended_mix():
    r = normalize_from_youtube_title("Artist - Title (Extended Mix)")
    assert r.artist == "Artist"
    assert r.title == "Title (Extended Mix)"
    assert r.version == "Extended Mix"


def test_version_radio_edit():
    r = normalize_from_youtube_title("Artist - Title (Radio Edit)")
    assert r.version == "Radio Edit"


def test_version_remix():
    r = normalize_from_youtube_title("Artist - Title (DJ Cool Remix)")
    assert r.version == "DJ Cool Remix"


def test_version_club_mix():
    r = normalize_from_youtube_title("Artist - Title (Club Mix)")
    assert r.version == "Club Mix"


def test_version_original_mix():
    r = normalize_from_youtube_title("Artist - Title (Original Mix)")
    assert r.version == "Original Mix"


def test_version_dub():
    r = normalize_from_youtube_title("Artist - Title (Dub)")
    assert r.version == "Dub"


def test_version_vip_mix():
    r = normalize_from_youtube_title("Artist - Title (VIP Mix)")
    assert r.version == "VIP Mix"


def test_version_bootleg():
    r = normalize_from_youtube_title("Artist - Title (Bootleg)")
    assert r.version == "Bootleg"


def test_version_rework():
    r = normalize_from_youtube_title("Artist - Title (Rework)")
    assert r.version == "Rework"


def test_non_version_paren_kept():
    """Parentheses that don't match version hints should stay in the title."""
    r = normalize_from_youtube_title("Artist - Title (feat. Other)")
    assert r.version is None
    assert "feat. Other" in r.title


# --- Junk removal ---

def test_junk_official_video():
    r = normalize_from_youtube_title("Artist - Title [Official Video]")
    assert "Official" not in r.title


def test_junk_official_music_video():
    r = normalize_from_youtube_title("Artist - Title (Official Music Video)")
    assert "Official" not in r.title


def test_junk_official_audio():
    r = normalize_from_youtube_title("Artist - Title [Official Audio]")
    assert "Official" not in r.title


def test_junk_lyrics():
    r = normalize_from_youtube_title("Artist - Title [Lyrics]")
    assert "Lyrics" not in r.title


def test_junk_hd():
    r = normalize_from_youtube_title("Artist - Title HD")
    assert "HD" not in r.title


def test_junk_4k():
    r = normalize_from_youtube_title("Artist - Title 4K")
    assert "4K" not in r.title


def test_junk_visualizer():
    r = normalize_from_youtube_title("Artist - Title [Visualizer]")
    assert "Visualizer" not in r.title


def test_junk_full_album():
    r = normalize_from_youtube_title("Artist - Title [Full Album]")
    assert "Full Album" not in r.title


def test_multiple_junk_tokens():
    r = normalize_from_youtube_title("Artist - Title [Official Video] (Lyrics) HD")
    assert "Official" not in r.title
    assert "HD" not in r.title


# --- Title case artist ---

def test_title_case_lowercase():
    r = normalize_from_youtube_title("dj snake - Turn Down For What")
    assert r.artist == "DJ Snake"


def test_title_case_allcaps():
    r = normalize_from_youtube_title("DISCLOSURE - You & Me")
    assert r.artist == "Disclosure"


def test_correction_jay_z():
    r = normalize_from_youtube_title("jay-z - Song")
    assert r.artist == "JAY-Z"


def test_correction_asap():
    r = normalize_from_youtube_title("a$ap rocky - Song")
    assert r.artist == "A$AP Rocky"


def test_correction_weeknd():
    r = normalize_from_youtube_title("the weeknd - Blinding Lights")
    assert r.artist == "The Weeknd"


def test_correction_tpain():
    r = normalize_from_youtube_title("t-pain - Buy U A Drank")
    assert r.artist == "T-Pain"


def test_correction_jcole():
    r = normalize_from_youtube_title("j cole - Middle Child")
    assert r.artist == "J. Cole"


def test_uppercase_dj():
    r = normalize_from_youtube_title("dj mix - Track")
    assert r.artist == "DJ Mix"


def test_uppercase_mc():
    r = normalize_from_youtube_title("mc hammer - Song")
    assert r.artist == "MC Hammer"


def test_lowercase_connectives():
    r = normalize_from_youtube_title("ABOVE AND BEYOND - Sun And Moon")
    assert "and" in r.artist.lower()


def test_uppercase_uk():
    r = normalize_from_youtube_title("uk artist - Song")
    assert "UK" in r.artist


# --- Edge cases ---

def test_empty_title():
    r = normalize_from_youtube_title("")
    assert r.artist is not None
    assert r.title is not None


def test_whitespace_only():
    r = normalize_from_youtube_title("   ")
    assert r.artist is not None


def test_very_long_title():
    long = "Artist - " + "A" * 500
    r = normalize_from_youtube_title(long)
    assert r.artist == "Artist"


def test_unicode_in_title():
    r = normalize_from_youtube_title("Artiste - Chanson d'\u00e9t\u00e9")
    assert r.artist == "Artiste"
    assert "\u00e9t\u00e9" in r.title


def test_multiple_separators_first_wins():
    r = normalize_from_youtube_title("Artist - Title - Subtitle")
    assert r.artist == "Artist"
    assert "Title" in r.title
