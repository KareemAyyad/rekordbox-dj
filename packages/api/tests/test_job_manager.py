"""Tests for the SSE job manager (subscribe, broadcast, cancel, history replay)."""

import asyncio
import pytest
from dropcrate.services.job_manager import JobManager


@pytest.fixture
def manager():
    return JobManager()


def test_create_job(manager):
    job = manager.create_job()
    assert job.id
    assert len(job.id) == 8
    assert job.cancel_requested is False
    assert job.history == []
    assert job.subscribers == {}


def test_get_job(manager):
    job = manager.create_job()
    found = manager.get_job(job.id)
    assert found is job


def test_get_nonexistent_job(manager):
    assert manager.get_job("nonexistent") is None


def test_broadcast_adds_to_history(manager):
    job = manager.create_job()
    event = {"type": "test", "data": 123}
    manager.broadcast(job, event)
    assert len(job.history) == 1
    assert job.history[0] == event


@pytest.mark.asyncio
async def test_broadcast_delivers_to_subscriber(manager):
    job = manager.create_job()
    client_id, queue = manager.subscribe(job)
    event = {"type": "test", "data": "hello"}
    manager.broadcast(job, event)
    received = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert received == event


@pytest.mark.asyncio
async def test_subscribe_replays_history(manager):
    job = manager.create_job()
    # Broadcast before subscribing
    manager.broadcast(job, {"type": "event1"})
    manager.broadcast(job, {"type": "event2"})

    client_id, queue = manager.subscribe(job)
    # Should get history events
    e1 = await asyncio.wait_for(queue.get(), timeout=1.0)
    e2 = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert e1["type"] == "event1"
    assert e2["type"] == "event2"


def test_unsubscribe(manager):
    job = manager.create_job()
    client_id, queue = manager.subscribe(job)
    assert client_id in job.subscribers
    manager.unsubscribe(job, client_id)
    assert client_id not in job.subscribers


def test_cancel_job(manager):
    job = manager.create_job()
    assert not job.cancel_requested
    result = manager.cancel_job(job.id)
    assert result is True
    assert job.cancel_requested is True


def test_cancel_nonexistent_job(manager):
    result = manager.cancel_job("nonexistent")
    assert result is False


def test_cleanup_job(manager):
    job = manager.create_job()
    job_id = job.id
    manager.cleanup_job(job_id)
    assert manager.get_job(job_id) is None


def test_history_capped_at_500(manager):
    job = manager.create_job()
    for i in range(600):
        manager.broadcast(job, {"type": "event", "i": i})
    assert len(job.history) == 500
    # Should keep the most recent 500
    assert job.history[0]["i"] == 100
    assert job.history[-1]["i"] == 599


@pytest.mark.asyncio
async def test_multiple_subscribers(manager):
    job = manager.create_job()
    _, q1 = manager.subscribe(job)
    _, q2 = manager.subscribe(job)
    manager.broadcast(job, {"type": "test"})
    r1 = await asyncio.wait_for(q1.get(), timeout=1.0)
    r2 = await asyncio.wait_for(q2.get(), timeout=1.0)
    assert r1["type"] == "test"
    assert r2["type"] == "test"


def test_unique_client_ids(manager):
    job = manager.create_job()
    c1, _ = manager.subscribe(job)
    c2, _ = manager.subscribe(job)
    assert c1 != c2


def test_unique_job_ids(manager):
    j1 = manager.create_job()
    j2 = manager.create_job()
    assert j1.id != j2.id
