"""Comprehensive tests for Rekordbox-safe filename generation."""

from dropcrate.services.naming import sanitize_file_component, make_rekordbox_filename


# --- sanitize_file_component ---

def test_sanitize_removes_special_chars():
    assert sanitize_file_component('Artist: "Title" <test>') == "Artist Title test"


def test_sanitize_empty():
    assert sanitize_file_component("") == "Untitled"


def test_sanitize_whitespace_only():
    assert sanitize_file_component("   ") == "Untitled"


def test_sanitize_removes_backslash():
    assert "\\" not in sanitize_file_component("Artist\\Title")


def test_sanitize_removes_forward_slash():
    assert "/" not in sanitize_file_component("Artist/Title")


def test_sanitize_removes_colon():
    assert ":" not in sanitize_file_component("Artist: Title")


def test_sanitize_removes_asterisk():
    assert "*" not in sanitize_file_component("Artist * Title")


def test_sanitize_removes_question_mark():
    assert "?" not in sanitize_file_component("Artist? Title")


def test_sanitize_removes_pipe():
    assert "|" not in sanitize_file_component("Artist | Title")


def test_sanitize_removes_angle_brackets():
    result = sanitize_file_component("Artist <Title>")
    assert "<" not in result
    assert ">" not in result


def test_sanitize_removes_double_quotes():
    assert '"' not in sanitize_file_component('Artist "Title"')


def test_sanitize_collapses_spaces():
    assert "  " not in sanitize_file_component("Artist    Title")


def test_sanitize_strips_trailing_dots():
    assert not sanitize_file_component("Artist.").endswith(".")


def test_sanitize_strips_trailing_spaces():
    assert not sanitize_file_component("Artist   ").endswith(" ")


def test_sanitize_preserves_normal_chars():
    assert sanitize_file_component("Normal Title") == "Normal Title"


def test_sanitize_preserves_hyphens():
    assert sanitize_file_component("A-B") == "A-B"


def test_sanitize_preserves_parentheses():
    assert sanitize_file_component("A (B)") == "A (B)"


def test_sanitize_preserves_brackets():
    assert sanitize_file_component("A [B]") == "A [B]"


def test_sanitize_preserves_unicode():
    assert "\u00e9" in sanitize_file_component("Caf\u00e9")


# --- make_rekordbox_filename ---

def test_make_filename():
    result = make_rekordbox_filename("Artist", "Title", ".aiff")
    assert result == "Artist - Title.aiff"


def test_make_filename_with_bpm():
    result = make_rekordbox_filename("Artist", "Title", ".aiff", bpm=128)
    assert result == "Artist - Title [128].aiff"


def test_make_filename_with_key():
    result = make_rekordbox_filename("Artist", "Title", ".aiff", key="Am")
    assert result == "Artist - Title [Am].aiff"


def test_make_filename_with_bpm_and_key():
    result = make_rekordbox_filename("Artist", "Title", ".aiff", bpm=128, key="Am")
    assert result == "Artist - Title [128 Am].aiff"


def test_make_filename_wav():
    result = make_rekordbox_filename("Artist", "Title", ".wav")
    assert result.endswith(".wav")


def test_make_filename_flac():
    result = make_rekordbox_filename("Artist", "Title", ".flac")
    assert result.endswith(".flac")


def test_make_filename_mp3():
    result = make_rekordbox_filename("Artist", "Title", ".mp3")
    assert result.endswith(".mp3")


def test_make_filename_sanitizes_special_chars():
    result = make_rekordbox_filename('Art:ist', 'Tit"le', ".aiff")
    assert ":" not in result
    assert '"' not in result


def test_make_filename_preserves_extension():
    """Extension should be appended after sanitization."""
    result = make_rekordbox_filename("A", "B", ".aiff")
    assert result == "A - B.aiff"
