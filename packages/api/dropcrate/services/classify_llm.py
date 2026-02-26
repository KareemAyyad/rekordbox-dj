"""OpenAI LLM-based DJ tag classification.

Port of the OpenAI tool-calling classify logic from apps/bridge/src/server.ts.
"""

from __future__ import annotations

import json

from openai import AsyncOpenAI

from dropcrate import config
from dropcrate.models.schemas import ClassifyResult, ContentKind

SYSTEM_PROMPT = """You are an expert touring DJ assistant. You classify YouTube items into Rekordbox-friendly DJ tags.

Rules:
- If you are not confident, set fields to null (do not guess).
- If it is not a music item (tutorial, vlog, interview, talking-head, podcast), set kind accordingly and set genre/energy/time/vibe to null.
- Tutorials about DJing are NOT sets (kind=video), even if they contain a short demo mix.
- Allowed genres: Afro House, House, Melodic House & Techno, Tech House, Deep House, Progressive House, Other.
- If the content is primarily Techno / Melodic Techno, map genre to "Melodic House & Techno".
- If fetchError is present, set kind=unknown, set genre/energy/time/vibe to null, confidence=0, and include fetchError in notes.
- Energy must be one of: 1/5, 2/5, 3/5, 4/5, 5/5.
- Time must be one of: Warmup, Peak, Closing.
- Vibe is a comma-separated string using only relevant terms when supported (Organic, Tribal, Latin, Minimal, Dark, Vocal, Instrumental, Driving, Hypnotic)."""

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "classify_dj_tags",
        "strict": True,
        "description": "Return DJ tag classification for each item id.",
        "parameters": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "results": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "id": {"type": "string"},
                            "kind": {
                                "type": "string",
                                "enum": ["track", "set", "podcast", "video", "unknown"],
                            },
                            "genre": {
                                "type": ["string", "null"],
                                "enum": [
                                    "Afro House", "House", "Melodic House & Techno",
                                    "Tech House", "Deep House", "Progressive House", "Other", None,
                                ],
                            },
                            "energy": {
                                "type": ["string", "null"],
                                "enum": ["1/5", "2/5", "3/5", "4/5", "5/5", None],
                            },
                            "time": {
                                "type": ["string", "null"],
                                "enum": ["Warmup", "Peak", "Closing", None],
                            },
                            "vibe": {"type": ["string", "null"]},
                            "confidence": {"type": "number"},
                            "notes": {"type": "string"},
                        },
                        "required": ["id", "kind", "genre", "energy", "time", "vibe", "confidence", "notes"],
                    },
                }
            },
            "required": ["results"],
        },
    },
}


def _truncate(text: str | None, max_len: int) -> str | None:
    if not text:
        return None
    return text[:max_len]


async def llm_classify(item_id: str, info: dict) -> ClassifyResult | None:
    """Classify a single item using OpenAI. Returns None if unavailable."""
    if not config.OPENAI_API_KEY:
        return None

    client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)

    input_data = [
        {
            "id": item_id,
            "url": info.get("webpage_url", ""),
            "title": _truncate(info.get("title"), 220),
            "uploader": _truncate(info.get("uploader") or info.get("channel"), 120),
            "description": _truncate(info.get("description"), 800),
            "duration": info.get("duration"),
            "tags": (info.get("tags") or [])[:25],
            "categories": (info.get("categories") or [])[:8],
        }
    ]

    response = await client.chat.completions.create(
        model=config.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Classify the following items:\n{json.dumps(input_data)}"},
        ],
        tools=[TOOL_SCHEMA],  # type: ignore
        tool_choice={"type": "function", "function": {"name": "classify_dj_tags"}},
        temperature=0.2,
        max_tokens=4000,
        timeout=90,
    )

    tool_call = response.choices[0].message.tool_calls
    if not tool_call:
        return None

    args_text = tool_call[0].function.arguments
    parsed = json.loads(args_text)
    results = parsed.get("results", [])

    for r in results:
        if r.get("id") == item_id:
            return ClassifyResult(
                id=item_id,
                kind=ContentKind(r.get("kind", "unknown")),
                genre=r.get("genre"),
                energy=r.get("energy"),
                time=r.get("time"),
                vibe=r.get("vibe"),
                confidence=r.get("confidence", 0),
                notes=r.get("notes", ""),
            )

    return None
