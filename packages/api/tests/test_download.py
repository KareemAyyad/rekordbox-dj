"""Tests for the yt-dlp download service (mocked)."""

import asyncio
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock


@pytest.mark.asyncio
async def test_download_audio_returns_path():
    """Test that download_audio calls yt-dlp and returns the downloaded file path."""
    from dropcrate.services.download import download_audio

    fake_filepath = "/tmp/test_work/Artist - Title.m4a"
    fake_info = {
        "id": "abc123",
        "title": "Artist - Title",
        "requested_downloads": [{"filepath": fake_filepath}],
    }

    mock_ydl = MagicMock()
    mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
    mock_ydl.__exit__ = MagicMock(return_value=False)
    mock_ydl.extract_info = MagicMock(return_value=fake_info)

    with patch("dropcrate.services.download.yt_dlp.YoutubeDL", return_value=mock_ydl):
        result = await download_audio("https://www.youtube.com/watch?v=abc123", Path("/tmp/test_work"))

    assert result == Path(fake_filepath)
    mock_ydl.extract_info.assert_called_once_with("https://www.youtube.com/watch?v=abc123", download=True)


@pytest.mark.asyncio
async def test_download_audio_no_info_raises():
    """Test that download_audio raises when yt-dlp returns None."""
    from dropcrate.services.download import download_audio

    mock_ydl = MagicMock()
    mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
    mock_ydl.__exit__ = MagicMock(return_value=False)
    mock_ydl.extract_info = MagicMock(return_value=None)

    with patch("dropcrate.services.download.yt_dlp.YoutubeDL", return_value=mock_ydl):
        with pytest.raises(RuntimeError, match="no info"):
            await download_audio("https://www.youtube.com/watch?v=bad", Path("/tmp"))


@pytest.mark.asyncio
async def test_download_audio_no_downloads_raises():
    """Test that download_audio raises when no output files are produced."""
    from dropcrate.services.download import download_audio

    fake_info = {"id": "abc", "title": "Test", "requested_downloads": []}
    mock_ydl = MagicMock()
    mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
    mock_ydl.__exit__ = MagicMock(return_value=False)
    mock_ydl.extract_info = MagicMock(return_value=fake_info)

    with patch("dropcrate.services.download.yt_dlp.YoutubeDL", return_value=mock_ydl):
        with pytest.raises(RuntimeError, match="no output"):
            await download_audio("https://www.youtube.com/watch?v=x", Path("/tmp"))


@pytest.mark.asyncio
async def test_download_uses_cookies_config():
    """Test that download passes cookie config to yt-dlp."""
    from dropcrate.services.download import _sync_download

    with patch("dropcrate.services.download.config") as mock_config:
        mock_config.COOKIES_FROM_BROWSER = "chrome"
        mock_config.COOKIES_FILE = ""

        fake_info = {
            "id": "test",
            "title": "Test",
            "requested_downloads": [{"filepath": "/tmp/test.m4a"}],
        }
        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info = MagicMock(return_value=fake_info)

        with patch("dropcrate.services.download.yt_dlp.YoutubeDL", return_value=mock_ydl) as mock_cls:
            _sync_download("https://www.youtube.com/watch?v=test", Path("/tmp"))
            opts = mock_cls.call_args[0][0]
            assert opts["cookiesfrombrowser"] == ("chrome",)
