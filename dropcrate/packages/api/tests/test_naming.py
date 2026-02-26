from dropcrate.services.naming import sanitize_file_component, make_rekordbox_filename


def test_sanitize_removes_special_chars():
    assert sanitize_file_component('Artist: "Title" <test>') == "Artist  Title  test"


def test_sanitize_empty():
    assert sanitize_file_component("") == "Untitled"


def test_make_filename():
    result = make_rekordbox_filename("Artist", "Title", ".aiff")
    assert result == "Artist - Title.aiff"


def test_make_filename_with_bpm():
    result = make_rekordbox_filename("Artist", "Title", ".aiff", bpm=128)
    assert result == "Artist - Title [128].aiff"
