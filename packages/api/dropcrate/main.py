from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from dropcrate import config, database
from dropcrate.routers import classify, events, health, library, queue, settings
from dropcrate.services.job_manager import job_manager  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    config.INBOX_DIR.mkdir(parents=True, exist_ok=True)
    await database.get_db()
    yield
    # Shutdown
    await database.close_db()


app = FastAPI(title="DropCrate API", version="0.1.0", lifespan=lifespan)

# CORS (dev: allow Next.js dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(health.router)
app.include_router(settings.router)
app.include_router(classify.router)
app.include_router(queue.router)
app.include_router(events.router)
app.include_router(library.router)

# Serve Next.js static build in production
if config.STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(config.STATIC_DIR), html=True), name="static")
