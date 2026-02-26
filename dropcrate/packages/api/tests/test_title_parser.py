from dropcrate.services.title_parser import normalize_from_youtube_title


def test_basic_split():
    r = normalize_from_youtube_title("Artist - Title")
    assert r.artist == "Artist"
    assert r.title == "Title"
    assert r.version is None


def test_version_extraction():
    r = normalize_from_youtube_title("Artist - Title (Extended Mix)")
    assert r.artist == "Artist"
    assert r.title == "Title (Extended Mix)"
    assert r.version == "Extended Mix"


def test_junk_removal():
    r = normalize_from_youtube_title("Artist - Title [Official Video] (Lyrics) HD")
    assert "Official" not in r.title
    assert "HD" not in r.title


def test_uploader_as_artist():
    r = normalize_from_youtube_title("Some Cool Track", uploader="DJ Cool")
    assert r.artist == "DJ Cool"
    assert r.title == "Some Cool Track"


def test_title_case_artist():
    r = normalize_from_youtube_title("dj snake - Turn Down For What")
    assert r.artist == "DJ Snake"


def test_em_dash_separator():
    r = normalize_from_youtube_title("Artist \u2013 Title")
    assert r.artist == "Artist"
    assert r.title == "Title"
