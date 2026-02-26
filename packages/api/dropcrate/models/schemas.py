from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --- Enums ---


class ContentKind(str, Enum):
    TRACK = "track"
    SET = "set"
    PODCAST = "podcast"
    VIDEO = "video"
    UNKNOWN = "unknown"


class AudioFormat(str, Enum):
    AIFF = "aiff"
    WAV = "wav"
    FLAC = "flac"
    MP3 = "mp3"


class DownloadMode(str, Enum):
    DJ_SAFE = "dj-safe"
    FAST = "fast"


class DownloadStage(str, Enum):
    METADATA = "metadata"
    CLASSIFY = "classify"
    DOWNLOAD = "download"
    FINGERPRINT = "fingerprint"
    NORMALIZE = "normalize"
    TRANSCODE = "transcode"
    TAG = "tag"
    FINALIZE = "finalize"


# --- DJ Tags ---


class DJTags(BaseModel):
    genre: str = "Other"
    energy: str = ""
    time: str = ""
    vibe: str = ""


class AutoClassification(BaseModel):
    kind: ContentKind = ContentKind.UNKNOWN
    genre: Optional[str] = None
    energy: Optional[str] = None
    time: Optional[str] = None
    vibe: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    notes: str = ""


# --- Loudness ---


class LoudnessConfig(BaseModel):
    target_i: float = Field(default=-14.0, ge=-23.0, le=-8.0)
    target_tp: float = Field(default=-1.0, ge=-5.0, le=0.0)
    target_lra: float = Field(default=11.0, ge=5.0, le=20.0)


# --- Settings ---


class Settings(BaseModel):
    inbox_dir: str = "/data/inbox"
    mode: DownloadMode = DownloadMode.DJ_SAFE
    audio_format: AudioFormat = AudioFormat.AIFF
    normalize_enabled: bool = True
    loudness: LoudnessConfig = Field(default_factory=LoudnessConfig)


class SettingsUpdate(BaseModel):
    inbox_dir: Optional[str] = None
    mode: Optional[DownloadMode] = None
    audio_format: Optional[AudioFormat] = None
    normalize_enabled: Optional[bool] = None
    loudness: Optional[LoudnessConfig] = None


# --- Queue ---


class QueueItemInput(BaseModel):
    id: str = Field(min_length=1)
    url: str = Field(min_length=1)
    preset_snapshot: DJTags = Field(default_factory=DJTags)


class QueueStartRequest(BaseModel):
    inbox_dir: str = Field(min_length=1)
    mode: DownloadMode = DownloadMode.DJ_SAFE
    audio_format: AudioFormat = AudioFormat.AIFF
    normalize_enabled: bool = True
    loudness: LoudnessConfig = Field(default_factory=LoudnessConfig)
    items: list[QueueItemInput] = Field(min_length=1, max_length=10)


class QueueStartResponse(BaseModel):
    job_id: str


class QueueStopRequest(BaseModel):
    job_id: Optional[str] = None


# --- Classify ---


class ClassifyItemInput(BaseModel):
    id: str = Field(min_length=1)
    url: str = Field(min_length=1)


class ClassifyRequest(BaseModel):
    items: list[ClassifyItemInput]


class ClassifyResult(BaseModel):
    id: str
    kind: ContentKind = ContentKind.UNKNOWN
    genre: Optional[str] = None
    energy: Optional[str] = None
    time: Optional[str] = None
    vibe: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    notes: str = ""


class ClassifyResponse(BaseModel):
    ok: bool = True
    source: str = "heuristic"
    results: list[ClassifyResult] = []
    ms: int = 0


# --- Library ---


class LibraryItem(BaseModel):
    id: str
    file_path: str
    download_url: str = ""
    artist: str = ""
    title: str = ""
    genre: str = "Other"
    energy: Optional[str] = None
    time: Optional[str] = None
    vibe: Optional[str] = None
    duration_seconds: Optional[float] = None
    audio_format: Optional[str] = None
    downloaded_at: str = ""
