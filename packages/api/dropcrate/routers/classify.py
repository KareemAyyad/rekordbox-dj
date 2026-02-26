from __future__ import annotations

import time

from fastapi import APIRouter

from dropcrate import config
from dropcrate.models.schemas import ClassifyRequest, ClassifyResponse, ClassifyResult
from dropcrate.services.classify_heuristic import heuristic_classify
from dropcrate.services.classify_llm import llm_classify
from dropcrate.services.metadata import fetch_video_info

router = APIRouter()


@router.post("/api/classify")
async def classify_urls(req: ClassifyRequest) -> ClassifyResponse:
    t0 = time.monotonic()
    results: list[ClassifyResult] = []
    source = "heuristic"

    for item in req.items:
        try:
            info = await fetch_video_info(item.url)
        except Exception:
            results.append(ClassifyResult(id=item.id, notes="Failed to fetch metadata"))
            continue

        # Try LLM first if available
        if config.OPENAI_API_KEY:
            try:
                llm_result = await llm_classify(item.id, info)
                if llm_result:
                    results.append(llm_result)
                    source = "openai"
                    continue
            except Exception:
                pass

        # Fallback to heuristics
        result = heuristic_classify(item.id, info)
        results.append(result)

    ms = int((time.monotonic() - t0) * 1000)
    return ClassifyResponse(ok=True, source=source, results=results, ms=ms)
