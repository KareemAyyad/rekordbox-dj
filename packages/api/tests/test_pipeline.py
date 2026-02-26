"""Tests for the pipeline orchestrator (all external services mocked)."""

import asyncio
import json
import pytest
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock, call

from dropcrate.services.job_manager import JobManager, Job
from dropcrate.models.schemas import (
    QueueStartRequest, QueueItemInput, DJTags,
    LoudnessConfig, AudioFormat, DownloadMode,
)


def make_request(items=None, mode="dj-safe", fmt="aiff", normalize=True, inbox="/tmp/test_inbox"):
    if items is None:
        items = [QueueItemInput(
            id="item-1",
            url="https://www.youtube.com/watch?v=abc123",
            preset_snapshot=DJTags(genre="Other", energy="", time="", vibe=""),
        )]
    return QueueStartRequest(
        inbox_dir=inbox,
        mode=DownloadMode(mode),
        audio_format=AudioFormat(fmt),
        normalize_enabled=normalize,
        loudness=LoudnessConfig(target_i=-14, target_tp=-1, target_lra=11),
        items=items,
    )


FAKE_VIDEO_INFO = {
    "id": "abc123",
    "title": "ARTBAT - Flame (Extended Mix)",
    "uploader": "ARTBAT",
    "duration": 420,
    "categories": ["Music"],
    "tags": ["melodic techno"],
    "webpage_url": "https://www.youtube.com/watch?v=abc123",
    "thumbnails": [{"url": "https://img.jpg", "width": 1280, "height": 720}],
}


@pytest.fixture
def manager():
    return JobManager()


def _pipeline_patches(tmp_path):
    """Return a dict of all the patches needed to fully mock the pipeline."""
    return {
        "fetch_video_info": patch("dropcrate.services.pipeline.fetch_video_info", new_callable=AsyncMock, return_value=FAKE_VIDEO_INFO),
        "download_audio": patch("dropcrate.services.pipeline.download.download_audio", new_callable=AsyncMock, return_value=tmp_path / "test.m4a"),
        "download_thumbnail": patch("dropcrate.services.pipeline.tagger.download_thumbnail", new_callable=AsyncMock, return_value=None),
        "fingerprint": patch("dropcrate.services.pipeline.fingerprint.try_match_music_metadata", new_callable=AsyncMock, return_value=None),
        "normalize": patch("dropcrate.services.pipeline.normalize.loudnorm_two_pass", new_callable=AsyncMock, return_value=tmp_path / "normalized.aiff"),
        "transcode": patch("dropcrate.services.pipeline.transcode.transcode", new_callable=AsyncMock, return_value=tmp_path / "transcoded.aiff"),
        "tag": patch("dropcrate.services.pipeline.tagger.apply_tags_and_artwork", new_callable=AsyncMock),
        "shutil_move": patch("dropcrate.services.pipeline.shutil.move"),
        "shutil_rmtree": patch("dropcrate.services.pipeline.shutil.rmtree"),
        "get_db": patch("dropcrate.services.pipeline.get_db", new_callable=AsyncMock),
    }


@pytest.mark.asyncio
async def test_pipeline_broadcasts_queue_start_and_done(manager, tmp_path):
    """Pipeline should broadcast queue-start and queue-done events."""
    job = manager.create_job()
    req = make_request(inbox=str(tmp_path))
    events = []

    original_broadcast = manager.broadcast
    def capture(j, event):
        events.append(event)
        original_broadcast(j, event)

    patches = _pipeline_patches(tmp_path)
    with patch.object(manager, "broadcast", side_effect=capture):
        with patch("dropcrate.services.pipeline.job_manager", manager):
            mocks = {k: p.__enter__() for k, p in patches.items()}
            try:
                from dropcrate.services.pipeline import run_pipeline
                await run_pipeline(job, req)
            finally:
                for p in patches.values():
                    p.__exit__(None, None, None)

    event_types = [e["type"] for e in events]
    assert "queue-start" in event_types
    assert "queue-done" in event_types
    assert "item-start" in event_types


@pytest.mark.asyncio
async def test_pipeline_broadcasts_all_stages(manager, tmp_path):
    """Pipeline should broadcast progress for all processing stages."""
    job = manager.create_job()
    req = make_request(inbox=str(tmp_path))
    events = []

    original_broadcast = manager.broadcast
    def capture(j, event):
        events.append(event)
        original_broadcast(j, event)

    patches = _pipeline_patches(tmp_path)
    with patch.object(manager, "broadcast", side_effect=capture):
        with patch("dropcrate.services.pipeline.job_manager", manager):
            mocks = {k: p.__enter__() for k, p in patches.items()}
            try:
                from dropcrate.services.pipeline import run_pipeline
                await run_pipeline(job, req)
            finally:
                for p in patches.values():
                    p.__exit__(None, None, None)

    stages = [e.get("stage") for e in events if e.get("type") == "item-progress"]
    assert "metadata" in stages
    assert "classify" in stages
    assert "download" in stages
    assert "fingerprint" in stages
    assert "normalize" in stages
    assert "tag" in stages
    assert "finalize" in stages


@pytest.mark.asyncio
async def test_pipeline_handles_error(manager, tmp_path):
    """If a stage fails, pipeline should broadcast item-error."""
    job = manager.create_job()
    req = make_request(inbox=str(tmp_path))
    events = []

    original_broadcast = manager.broadcast
    def capture(j, event):
        events.append(event)
        original_broadcast(j, event)

    with patch.object(manager, "broadcast", side_effect=capture):
        with patch("dropcrate.services.pipeline.job_manager", manager):
            with patch("dropcrate.services.pipeline.fetch_video_info", new_callable=AsyncMock, side_effect=RuntimeError("Network error")):
                from dropcrate.services.pipeline import run_pipeline
                await run_pipeline(job, req)

    event_types = [e["type"] for e in events]
    assert "item-error" in event_types
    error_event = next(e for e in events if e["type"] == "item-error")
    assert "Network error" in error_event["error"]


@pytest.mark.asyncio
async def test_pipeline_cancel(manager, tmp_path):
    """Cancelling a job should stop processing."""
    job = manager.create_job()
    job.cancel_requested = True
    req = make_request(inbox=str(tmp_path))
    events = []

    original_broadcast = manager.broadcast
    def capture(j, event):
        events.append(event)
        original_broadcast(j, event)

    with patch.object(manager, "broadcast", side_effect=capture):
        with patch("dropcrate.services.pipeline.job_manager", manager):
            from dropcrate.services.pipeline import run_pipeline
            await run_pipeline(job, req)

    event_types = [e["type"] for e in events]
    assert "queue-done" in event_types
    error_events = [e for e in events if e["type"] == "item-error"]
    if error_events:
        assert "Cancelled" in error_events[0].get("error", "")


@pytest.mark.asyncio
async def test_pipeline_fast_mode_skips_normalize(manager, tmp_path):
    """In fast mode, pipeline should transcode instead of normalize."""
    job = manager.create_job()
    req = make_request(inbox=str(tmp_path), mode="fast", normalize=False)
    events = []

    original_broadcast = manager.broadcast
    def capture(j, event):
        events.append(event)
        original_broadcast(j, event)

    patches = _pipeline_patches(tmp_path)
    with patch.object(manager, "broadcast", side_effect=capture):
        with patch("dropcrate.services.pipeline.job_manager", manager):
            mocks = {k: p.__enter__() for k, p in patches.items()}
            try:
                from dropcrate.services.pipeline import run_pipeline
                await run_pipeline(job, req)
            finally:
                for p in patches.values():
                    p.__exit__(None, None, None)

    stages = [e.get("stage") for e in events if e.get("type") == "item-progress"]
    assert "transcode" in stages
    assert "normalize" not in stages


@pytest.mark.asyncio
async def test_pipeline_calls_normalize_in_dj_safe(manager, tmp_path):
    """In dj-safe mode, pipeline should call loudnorm_two_pass."""
    job = manager.create_job()
    req = make_request(inbox=str(tmp_path), mode="dj-safe", normalize=True)

    patches = _pipeline_patches(tmp_path)
    with patch("dropcrate.services.pipeline.job_manager", manager):
        mocks = {k: p.__enter__() for k, p in patches.items()}
        try:
            from dropcrate.services.pipeline import run_pipeline
            await run_pipeline(job, req)
        finally:
            for p in patches.values():
                p.__exit__(None, None, None)

    mocks["normalize"].assert_called_once()


@pytest.mark.asyncio
async def test_pipeline_calls_tagger(manager, tmp_path):
    """Pipeline should call apply_tags_and_artwork."""
    job = manager.create_job()
    req = make_request(inbox=str(tmp_path))

    patches = _pipeline_patches(tmp_path)
    with patch("dropcrate.services.pipeline.job_manager", manager):
        mocks = {k: p.__enter__() for k, p in patches.items()}
        try:
            from dropcrate.services.pipeline import run_pipeline
            await run_pipeline(job, req)
        finally:
            for p in patches.values():
                p.__exit__(None, None, None)

    mocks["tag"].assert_called_once()
    call_kwargs = mocks["tag"].call_args
    # Should have tags dict with artist, title, genre, comment
    tags = call_kwargs.kwargs.get("tags") or call_kwargs[1].get("tags") or call_kwargs[0][2]
    assert "artist" in tags
    assert "title" in tags
    assert "genre" in tags
    assert "comment" in tags


@pytest.mark.asyncio
async def test_pipeline_inserts_into_db(manager, tmp_path):
    """Pipeline should insert the processed track into the library database."""
    job = manager.create_job()
    req = make_request(inbox=str(tmp_path))

    patches = _pipeline_patches(tmp_path)
    with patch("dropcrate.services.pipeline.job_manager", manager):
        mocks = {k: p.__enter__() for k, p in patches.items()}
        try:
            from dropcrate.services.pipeline import run_pipeline
            await run_pipeline(job, req)
        finally:
            for p in patches.values():
                p.__exit__(None, None, None)

    mock_db = mocks["get_db"]
    mock_db.assert_called()
    mock_conn = mock_db.return_value
    mock_conn.execute.assert_called()
    # Verify the INSERT call was made
    insert_calls = [c for c in mock_conn.execute.call_args_list if "INSERT" in str(c)]
    assert len(insert_calls) >= 1
    mock_conn.commit.assert_called()
