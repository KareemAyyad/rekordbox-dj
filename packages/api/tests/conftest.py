import asyncio
import os
import tempfile

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def _isolated_db(tmp_path):
    """Use a temporary database for each test to avoid cross-test pollution."""
    import dropcrate.config as config
    import dropcrate.database as database

    # Point to a temp database
    original_db_path = config.DATABASE_PATH
    config.DATABASE_PATH = tmp_path / "test.db"

    # Reset the global db connection
    database._db = None

    yield

    # Cleanup
    await database.close_db()
    config.DATABASE_PATH = original_db_path


@pytest.fixture
async def client():
    from dropcrate.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
