"""Demucs stem separation service — dual-path architecture.

Cloud: Uses Replicate's hosted htdemucs_ft GPU (A100) via direct HTTP (~$0.04/track, ~2min).
Local: Uses PyTorch Demucs directly on Apple Silicon (if torch is installed).
"""

import asyncio
import logging
import time
from pathlib import Path

import httpx

from dropcrate import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Replicate API constants (ryan5453/demucs — A100 GPU, actively maintained)
# ---------------------------------------------------------------------------
_REPLICATE_API = "https://api.replicate.com/v1"
_REPLICATE_MODEL_VERSION = "5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77"
_REPLICATE_MAX_POLL_SECONDS = 300  # 5 minute max for htdemucs_ft on long tracks

# ---------------------------------------------------------------------------
# Check for local PyTorch availability (dev machines with torch installed)
# ---------------------------------------------------------------------------
_TORCH_AVAILABLE = False
try:
    import torch
    import torchaudio  # noqa: F401
    from demucs.api import Separator, save_audio
    _TORCH_AVAILABLE = True
except ImportError:
    pass


def is_available() -> bool:
    """Check if ANY stem separation backend is available."""
    return _TORCH_AVAILABLE or bool(getattr(config, "REPLICATE_API_TOKEN", ""))


def _get_device() -> str:
    """Detect the best available PyTorch device (local only)."""
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"


async def _separate_local(input_path: Path, out_path: Path) -> dict[str, str]:
    """Use local PyTorch Demucs for separation (dev/Apple Silicon)."""
    device = _get_device()
    logger.info(f"[Demucs Local] Separating on device: {device}")

    def _run():
        separator = Separator(model="htdemucs", device=device)
        _, res = separator.separate_audio_file(str(input_path))
        saved = {}
        for stem_name, tensor in res.items():
            stem_file = out_path / f"{stem_name}.wav"
            save_audio(tensor, str(stem_file), samplerate=separator.samplerate)
            saved[stem_name] = str(stem_file)
        return saved

    return await asyncio.to_thread(_run)


async def _separate_replicate(input_path: Path, out_path: Path) -> dict[str, str]:
    """Use Replicate's hosted htdemucs_ft GPU for separation via direct HTTP.

    This bypasses the official `replicate` Python SDK entirely to avoid
    its Pydantic V1/V2 conflict that crashes our FastAPI (Pydantic V2) app.

    Pipeline:
        1. Upload audio file to Replicate's file hosting
        2. Create a prediction with ryan5453/demucs (htdemucs_ft, A100 GPU)
        3. Poll until succeeded/failed (with exponential backoff)
        4. Download the 4 separated WAV stems
    """
    token = getattr(config, "REPLICATE_API_TOKEN", "")
    if not token:
        raise RuntimeError("REPLICATE_API_TOKEN is not set — cannot run cloud stem separation.")

    headers = {"Authorization": f"Token {token}"}
    file_size_mb = input_path.stat().st_size / (1024 * 1024)
    logger.info(f"[Demucs Replicate] Starting separation for {input_path.name} ({file_size_mb:.1f} MB)")

    async with httpx.AsyncClient(timeout=httpx.Timeout(300, connect=30)) as client:
        # ── Step 1: Upload the audio file ──────────────────────────────
        logger.info("[Demucs Replicate] Step 1/4: Uploading audio file...")
        upload_resp = await client.post(
            f"{_REPLICATE_API}/files",
            headers=headers,
            files={"content": (input_path.name, input_path.read_bytes(), "audio/wav")},
        )
        upload_resp.raise_for_status()
        file_url = upload_resp.json()["urls"]["get"]
        logger.info(f"[Demucs Replicate] Upload complete → {file_url[:80]}...")

        # ── Step 2: Create prediction ──────────────────────────────────
        logger.info("[Demucs Replicate] Step 2/4: Creating prediction (htdemucs_ft on A100)...")
        pred_resp = await client.post(
            f"{_REPLICATE_API}/predictions",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "version": _REPLICATE_MODEL_VERSION,
                "input": {
                    "audio": file_url,
                    "model": "htdemucs_ft",
                    "stem": "none",
                    "output_format": "wav",
                    "clip_mode": "rescale",
                    "shifts": 1,
                },
            },
        )
        pred_resp.raise_for_status()
        pred = pred_resp.json()
        pred_id = pred["id"]
        poll_url = pred["urls"]["get"]
        logger.info(f"[Demucs Replicate] Prediction created: {pred_id}")

        # ── Step 3: Poll for completion ────────────────────────────────
        logger.info("[Demucs Replicate] Step 3/4: Polling for completion...")
        start = time.monotonic()
        poll_interval = 3  # seconds
        output = None

        while (time.monotonic() - start) < _REPLICATE_MAX_POLL_SECONDS:
            await asyncio.sleep(poll_interval)
            elapsed = time.monotonic() - start

            status_resp = await client.get(poll_url, headers=headers)
            status_resp.raise_for_status()
            status_data = status_resp.json()
            status = status_data["status"]

            if status == "succeeded":
                output = status_data["output"]
                logger.info(f"[Demucs Replicate] ✅ Prediction {pred_id} succeeded in {elapsed:.0f}s")
                break
            elif status == "failed":
                error = status_data.get("error", "unknown error")
                logger.error(f"[Demucs Replicate] ❌ Prediction {pred_id} failed after {elapsed:.0f}s: {error}")
                raise RuntimeError(f"Replicate prediction failed: {error}")
            elif status == "canceled":
                raise RuntimeError("Replicate prediction was canceled.")

            # Log every 5th poll (~15 seconds)
            if int(elapsed) % 15 < poll_interval:
                logger.info(f"[Demucs Replicate] Polling... status={status}, elapsed={elapsed:.0f}s")

            # Gentle exponential backoff up to 5s
            poll_interval = min(poll_interval * 1.2, 5)

        if output is None:
            raise TimeoutError(f"Replicate prediction {pred_id} timed out after {_REPLICATE_MAX_POLL_SECONDS}s")

        # ── Step 4: Download separated stems ───────────────────────────
        logger.info(f"[Demucs Replicate] Step 4/4: Downloading {len(output) if isinstance(output, dict) else '?'} stems...")
        saved = {}

        if isinstance(output, dict):
            # ryan5453/demucs returns {stem_name: url, ...}
            for stem_name, url in output.items():
                if not isinstance(url, str) or not url.startswith("http"):
                    continue
                stem_file = out_path / f"{stem_name}.wav"
                logger.info(f"[Demucs Replicate] Downloading {stem_name}...")
                dl_resp = await client.get(url)
                dl_resp.raise_for_status()
                stem_file.write_bytes(dl_resp.content)
                saved[stem_name] = str(stem_file)
                logger.info(f"[Demucs Replicate] Saved {stem_name} ({len(dl_resp.content) / 1024:.0f} KB)")
        else:
            logger.error(f"[Demucs Replicate] Unexpected output format: {type(output)}")
            raise RuntimeError(f"Unexpected Replicate output format: {type(output)}")

    total_time = time.monotonic() - start
    logger.info(f"[Demucs Replicate] ✅ Complete: {len(saved)} stems in {total_time:.0f}s")
    return saved


async def separate_audio(input_file: str, output_dir: str) -> dict[str, str]:
    """Separate an audio file into 4 stems. Auto-selects backend.

    Returns a dict mapping stem name -> absolute file path.
    """
    input_path = Path(input_file)
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    if _TORCH_AVAILABLE:
        return await _separate_local(input_path, out_path)
    elif getattr(config, "REPLICATE_API_TOKEN", ""):
        return await _separate_replicate(input_path, out_path)
    else:
        raise RuntimeError(
            "No stem separation backend available. "
            "Set REPLICATE_API_TOKEN for cloud GPU inference, "
            "or install torch/demucs for local inference."
        )
