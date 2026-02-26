"""Tests for Chromaprint + AcoustID + MusicBrainz fingerprint matching (mocked)."""

import pytest
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock

from dropcrate.services.fingerprint import (
    try_match_music_metadata,
    _pick_best_acoustid,
    _join_artist_credit,
    _pick_best_release,
    _apply_fallback_version,
)


# --- Unit tests ---

def test_pick_best_acoustid_single_result():
    resp = {
        "results": [{
            "id": "result-1",
            "score": 0.95,
            "recordings": [{"id": "mbid-1"}],
        }]
    }
    best = _pick_best_acoustid(resp)
    assert best is not None
    assert best["score"] == 0.95
    assert best["mbid"] == "mbid-1"


def test_pick_best_acoustid_picks_highest_score():
    resp = {
        "results": [
            {"id": "r1", "score": 0.80, "recordings": [{"id": "mbid-1"}]},
            {"id": "r2", "score": 0.95, "recordings": [{"id": "mbid-2"}]},
        ]
    }
    best = _pick_best_acoustid(resp)
    assert best["mbid"] == "mbid-2"


def test_pick_best_acoustid_no_recordings():
    resp = {"results": [{"id": "r1", "score": 0.95, "recordings": []}]}
    assert _pick_best_acoustid(resp) is None


def test_pick_best_acoustid_empty_results():
    assert _pick_best_acoustid({"results": []}) is None


def test_pick_best_acoustid_no_results_key():
    assert _pick_best_acoustid({}) is None


def test_join_artist_credit_single():
    ac = [{"artist": {"name": "Black Coffee"}}]
    assert _join_artist_credit(ac) == "Black Coffee"


def test_join_artist_credit_multiple():
    ac = [
        {"artist": {"name": "ARTBAT"}},
        {"artist": {"name": "CamelPhat"}},
    ]
    assert _join_artist_credit(ac) == "ARTBAT & CamelPhat"


def test_join_artist_credit_empty():
    assert _join_artist_credit([]) == ""


def test_join_artist_credit_fallback_name():
    ac = [{"name": "FallbackName"}]
    assert _join_artist_credit(ac) == "FallbackName"


def test_pick_best_release_official():
    releases = [
        {"title": "Single", "status": "Promotional", "date": "2024-01-01", "label-info": []},
        {"title": "Album", "status": "Official", "date": "2024-03-15", "label-info": [{"label": {"name": "Defected"}}]},
    ]
    album, year, label = _pick_best_release(releases)
    assert album == "Album"
    assert year == "2024"
    assert label == "Defected"


def test_pick_best_release_no_official_uses_first():
    releases = [
        {"title": "Promo", "status": "Promotional", "date": "2023-06"},
    ]
    album, year, label = _pick_best_release(releases)
    assert album == "Promo"
    assert year == "2023"


def test_pick_best_release_none():
    assert _pick_best_release(None) == (None, None, None)


def test_pick_best_release_empty():
    assert _pick_best_release([]) == (None, None, None)


def test_pick_best_release_no_date():
    releases = [{"title": "Album", "date": "", "label-info": []}]
    _, year, _ = _pick_best_release(releases)
    assert year is None


def test_apply_fallback_version_from_mb_title():
    title, version = _apply_fallback_version("Track (Extended Mix)", None)
    assert title == "Track (Extended Mix)"
    assert version == "Extended Mix"


def test_apply_fallback_version_no_paren():
    title, version = _apply_fallback_version("Track", "Extended Mix")
    assert title == "Track (Extended Mix)"
    assert version == "Extended Mix"


def test_apply_fallback_version_no_fallback():
    title, version = _apply_fallback_version("Track", None)
    assert title == "Track"
    assert version is None


def test_apply_fallback_version_empty_fallback():
    title, version = _apply_fallback_version("Track", "")
    assert title == "Track"
    assert version is None


# --- Integration tests with mocked externals ---

@pytest.mark.asyncio
async def test_no_acoustid_key_returns_none():
    """Without an AcoustID key, should return None immediately."""
    with patch("dropcrate.services.fingerprint.config") as mock_config:
        mock_config.ACOUSTID_KEY = ""
        result = await try_match_music_metadata(
            audio_path=Path("/tmp/test.aiff"),
            fallback_artist="Test",
            fallback_title="Track",
            fallback_version=None,
            title_had_separator=True,
        )
    assert result is None


@pytest.mark.asyncio
async def test_chromaprint_failure_returns_none():
    """If fpcalc fails, should return None."""
    with patch("dropcrate.services.fingerprint.config") as mock_config:
        mock_config.ACOUSTID_KEY = "test-key"
        mock_config.FPCALC_PATH = "fpcalc"

        mock_proc = AsyncMock()
        mock_proc.returncode = 1
        mock_proc.communicate = AsyncMock(return_value=(b"", b"error"))

        with patch("dropcrate.services.fingerprint.asyncio.create_subprocess_exec", return_value=mock_proc):
            with patch("dropcrate.services.fingerprint.asyncio.wait_for", return_value=(b"", b"error")):
                result = await try_match_music_metadata(
                    audio_path=Path("/tmp/test.aiff"),
                    fallback_artist="Test",
                    fallback_title="Track",
                    fallback_version=None,
                    title_had_separator=True,
                )
    assert result is None


@pytest.mark.asyncio
async def test_full_match_returns_metadata():
    """Full successful path: fpcalc → AcoustID → MusicBrainz → MatchedMetadata."""
    fpcalc_output = b'{"duration": 300.5, "fingerprint": "AQADtNISJYmS"}'
    acoustid_response = {
        "results": [{
            "id": "aid-1",
            "score": 0.97,
            "recordings": [{"id": "mbid-abc"}],
        }]
    }
    mb_response = {
        "title": "Flame",
        "artist-credit": [{"artist": {"name": "ARTBAT"}}],
        "releases": [
            {
                "title": "Flame EP",
                "status": "Official",
                "date": "2024-03-01",
                "label-info": [{"label": {"name": "AFTR:HRS"}}],
            }
        ],
    }

    # Clear cache to avoid interference
    from dropcrate.services.fingerprint import _ACOUSTID_CACHE
    _ACOUSTID_CACHE.clear()

    with patch("dropcrate.services.fingerprint.config") as mock_config:
        mock_config.ACOUSTID_KEY = "test-key"
        mock_config.FPCALC_PATH = "fpcalc"

        with patch("dropcrate.services.fingerprint._get_chromaprint", new_callable=AsyncMock, return_value=(300.5, "AQADtNISJYmS")):
            with patch("dropcrate.services.fingerprint._acoustid_lookup", new_callable=AsyncMock, return_value=acoustid_response):
                with patch("dropcrate.services.fingerprint._musicbrainz_recording", new_callable=AsyncMock, return_value=mb_response):
                    result = await try_match_music_metadata(
                        audio_path=Path("/tmp/test.aiff"),
                        fallback_artist="artbat",
                        fallback_title="flame",
                        fallback_version="Extended Mix",
                        title_had_separator=True,
                    )

    assert result is not None
    assert result.artist == "ARTBAT"
    assert result.title == "Flame (Extended Mix)"  # fallback version applied
    assert result.album == "Flame EP"
    assert result.year == "2024"
    assert result.label == "AFTR:HRS"
    assert result.match.acoustid_score == 0.97
    assert result.match.provider == "acoustid+musicbrainz"


@pytest.mark.asyncio
async def test_low_score_without_separator_returns_none():
    """With title_had_separator=False, threshold is 0.85. Score 0.80 should return None."""
    from dropcrate.services.fingerprint import _ACOUSTID_CACHE
    _ACOUSTID_CACHE.clear()

    acoustid_response = {
        "results": [{
            "id": "r1",
            "score": 0.80,
            "recordings": [{"id": "mbid-1"}],
        }]
    }

    with patch("dropcrate.services.fingerprint.config") as mock_config:
        mock_config.ACOUSTID_KEY = "test-key"
        mock_config.FPCALC_PATH = "fpcalc"

        with patch("dropcrate.services.fingerprint._get_chromaprint", new_callable=AsyncMock, return_value=(300, "fp")):
            with patch("dropcrate.services.fingerprint._acoustid_lookup", new_callable=AsyncMock, return_value=acoustid_response):
                result = await try_match_music_metadata(
                    audio_path=Path("/tmp/test.aiff"),
                    fallback_artist="A",
                    fallback_title="T",
                    fallback_version=None,
                    title_had_separator=False,
                )

    assert result is None


@pytest.mark.asyncio
async def test_low_score_with_separator_returns_none():
    """With title_had_separator=True, threshold is 0.95. Score 0.90 should return None."""
    from dropcrate.services.fingerprint import _ACOUSTID_CACHE
    _ACOUSTID_CACHE.clear()

    acoustid_response = {
        "results": [{
            "id": "r1",
            "score": 0.90,
            "recordings": [{"id": "mbid-1"}],
        }]
    }

    with patch("dropcrate.services.fingerprint.config") as mock_config:
        mock_config.ACOUSTID_KEY = "test-key"
        mock_config.FPCALC_PATH = "fpcalc"

        with patch("dropcrate.services.fingerprint._get_chromaprint", new_callable=AsyncMock, return_value=(300, "fp")):
            with patch("dropcrate.services.fingerprint._acoustid_lookup", new_callable=AsyncMock, return_value=acoustid_response):
                result = await try_match_music_metadata(
                    audio_path=Path("/tmp/test.aiff"),
                    fallback_artist="A",
                    fallback_title="T",
                    fallback_version=None,
                    title_had_separator=True,
                )

    assert result is None
