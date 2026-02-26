from __future__ import annotations

from pydantic import BaseModel, Field


class SeparateRequest(BaseModel):
    session_id: str
    prompt: str = Field(..., min_length=1, max_length=500)
    guidance_scale: float = Field(default=3.0, ge=0.0, le=20.0)
    num_steps: int = Field(default=16, ge=1, le=100)
    reranking_candidates: int = Field(default=1, ge=1, le=8)


class AutoSegmentRequest(BaseModel):
    session_id: str
    categories: list[str] | None = None  # None = use all defaults
    guidance_scale: float = Field(default=3.0, ge=0.0, le=20.0)
    num_steps: int = Field(default=16, ge=1, le=100)
    reranking_candidates: int = Field(default=1, ge=1, le=8)


class SegmentResult(BaseModel):
    id: str
    prompt: str
    label: str
    target_url: str
    residual_url: str
    duration_seconds: float


class UploadResponse(BaseModel):
    session_id: str
    filename: str
    duration_seconds: float
    sample_rate: int
    channels: int


class SeparateResponse(BaseModel):
    ok: bool
    segment: SegmentResult


class AutoSegmentResponse(BaseModel):
    ok: bool
    job_id: str
