"""Tests for OpenAI LLM-based classification (mocked API calls)."""

import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from dropcrate.services.classify_llm import llm_classify, SYSTEM_PROMPT, TOOL_SCHEMA


# --- No API key ---

@pytest.mark.asyncio
async def test_no_api_key_returns_none():
    with patch("dropcrate.services.classify_llm.config") as mock_config:
        mock_config.OPENAI_API_KEY = ""
        result = await llm_classify("item-1", {"title": "Test Track"})
    assert result is None


# --- Successful classification ---

@pytest.mark.asyncio
async def test_successful_classification():
    fake_result = {
        "results": [{
            "id": "item-1",
            "kind": "track",
            "genre": "Afro House",
            "energy": "3/5",
            "time": "Peak",
            "vibe": "Tribal, Organic",
            "confidence": 0.85,
            "notes": "Strong Afro House signals from title and tags",
        }]
    }

    mock_tool_call = MagicMock()
    mock_tool_call.function.arguments = json.dumps(fake_result)

    mock_message = MagicMock()
    mock_message.tool_calls = [mock_tool_call]

    mock_choice = MagicMock()
    mock_choice.message = mock_message

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("dropcrate.services.classify_llm.config") as mock_config:
        mock_config.OPENAI_API_KEY = "sk-test-key"
        mock_config.OPENAI_MODEL = "gpt-4o-mini"
        with patch("dropcrate.services.classify_llm.AsyncOpenAI", return_value=mock_client):
            result = await llm_classify("item-1", {
                "title": "Black Coffee - Afro House Track",
                "uploader": "Black Coffee",
                "tags": ["afro house"],
                "categories": ["Music"],
                "duration": 420,
            })

    assert result is not None
    assert result.id == "item-1"
    assert result.kind == "track"
    assert result.genre == "Afro House"
    assert result.energy == "3/5"
    assert result.time == "Peak"
    assert result.vibe == "Tribal, Organic"
    assert result.confidence == 0.85


# --- No tool calls in response ---

@pytest.mark.asyncio
async def test_no_tool_calls_returns_none():
    mock_message = MagicMock()
    mock_message.tool_calls = None

    mock_choice = MagicMock()
    mock_choice.message = mock_message

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("dropcrate.services.classify_llm.config") as mock_config:
        mock_config.OPENAI_API_KEY = "sk-test-key"
        mock_config.OPENAI_MODEL = "gpt-4o-mini"
        with patch("dropcrate.services.classify_llm.AsyncOpenAI", return_value=mock_client):
            result = await llm_classify("item-1", {"title": "Test"})

    assert result is None


# --- Item ID mismatch returns None ---

@pytest.mark.asyncio
async def test_id_mismatch_returns_none():
    fake_result = {
        "results": [{
            "id": "different-id",
            "kind": "track",
            "genre": "House",
            "energy": None,
            "time": None,
            "vibe": None,
            "confidence": 0.5,
            "notes": "",
        }]
    }

    mock_tool_call = MagicMock()
    mock_tool_call.function.arguments = json.dumps(fake_result)

    mock_message = MagicMock()
    mock_message.tool_calls = [mock_tool_call]

    mock_choice = MagicMock()
    mock_choice.message = mock_message

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("dropcrate.services.classify_llm.config") as mock_config:
        mock_config.OPENAI_API_KEY = "sk-test-key"
        mock_config.OPENAI_MODEL = "gpt-4o-mini"
        with patch("dropcrate.services.classify_llm.AsyncOpenAI", return_value=mock_client):
            result = await llm_classify("my-item", {"title": "Test"})

    assert result is None


# --- Tool schema validation ---

def test_tool_schema_has_required_fields():
    """Verify the tool schema defines all Rekordbox-relevant fields."""
    params = TOOL_SCHEMA["function"]["parameters"]
    item_props = params["properties"]["results"]["items"]["properties"]
    assert "id" in item_props
    assert "kind" in item_props
    assert "genre" in item_props
    assert "energy" in item_props
    assert "time" in item_props
    assert "vibe" in item_props
    assert "confidence" in item_props
    assert "notes" in item_props


def test_tool_schema_kind_enum():
    item_props = TOOL_SCHEMA["function"]["parameters"]["properties"]["results"]["items"]["properties"]
    assert set(item_props["kind"]["enum"]) == {"track", "set", "podcast", "video", "unknown"}


def test_tool_schema_energy_enum():
    item_props = TOOL_SCHEMA["function"]["parameters"]["properties"]["results"]["items"]["properties"]
    assert "1/5" in item_props["energy"]["enum"]
    assert "5/5" in item_props["energy"]["enum"]
    assert None in item_props["energy"]["enum"]


def test_tool_schema_time_enum():
    item_props = TOOL_SCHEMA["function"]["parameters"]["properties"]["results"]["items"]["properties"]
    assert "Warmup" in item_props["time"]["enum"]
    assert "Peak" in item_props["time"]["enum"]
    assert "Closing" in item_props["time"]["enum"]


def test_system_prompt_contains_dj_context():
    """Verify the system prompt gives DJ-specific context."""
    assert "DJ" in SYSTEM_PROMPT
    assert "Rekordbox" in SYSTEM_PROMPT
    assert "genre" in SYSTEM_PROMPT.lower()
