from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from dropcrate.database import get_db
from dropcrate.models.schemas import LibraryItem

router = APIRouter()


@router.get("/api/library")
async def list_library(
    search: str = Query("", description="Search by artist, title, or genre"),
    sort: str = Query("date", description="Sort by: date, artist, title"),
) -> list[LibraryItem]:
    db = await get_db()

    order_clause = {
        "date": "downloaded_at DESC",
        "artist": "artist ASC, title ASC",
        "title": "title ASC, artist ASC",
    }.get(sort, "downloaded_at DESC")

    if search:
        query = f"""
            SELECT * FROM library_tracks
            WHERE artist LIKE ? OR title LIKE ? OR genre LIKE ?
            ORDER BY {order_clause}
            LIMIT 200
        """
        like = f"%{search}%"
        rows = await db.execute_fetchall(query, (like, like, like))
    else:
        query = f"SELECT * FROM library_tracks ORDER BY {order_clause} LIMIT 200"
        rows = await db.execute_fetchall(query)

    return [
        LibraryItem(
            id=row["id"],
            file_path=row["file_path"],
            download_url=f"/api/library/{row['id']}/download",
            artist=row["artist"],
            title=row["title"],
            genre=row["genre"],
            energy=row["energy"],
            time=row["time_slot"],
            vibe=row["vibe"],
            duration_seconds=row["duration_seconds"],
            audio_format=row["audio_format"],
            downloaded_at=row["downloaded_at"] or "",
        )
        for row in rows
    ]


@router.get("/api/library/{track_id}/download")
async def download_track(track_id: str):
    db = await get_db()
    rows = await db.execute_fetchall("SELECT * FROM library_tracks WHERE id = ?", (track_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Track not found")

    file_path = Path(rows[0]["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    artist = rows[0]["artist"] or "Unknown"
    title = rows[0]["title"] or "Unknown"
    ext = file_path.suffix
    filename = f"{artist} - {title}{ext}"

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream",
    )
