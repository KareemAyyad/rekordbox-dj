"""Demucs stem separation service — dual-path architecture.

Cloud: Uses Replicate's hosted htdemucs GPU instances (~$0.02/track, ~30s).
Local: Uses PyTorch Demucs directly on Apple Silicon (if torch is installed).
"""

import asyncio
import logging
from pathlib import Path

import httpx

from dropcrate import config

logger = logging.getLogger(__name__)

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
    """Use Replicate's hosted htdemucs GPU for separation (cloud)."""
    import replicate

    logger.info(f"[Demucs Replicate] Uploading {input_path.name} for GPU separation...")

    # Run Demucs on Replicate's GPU
    def _run():
        with open(input_path, "rb") as f:
            output = replicate.run(
                "cjwbw/demucs:25a173108cff36ef9f80f854c162d01df9e6528be175794b81571f6c6c65f1b6",
                input={
                    "audio": f,
                    "model_name": "htdemucs",
                    "stem": "all",
                    "output_format": "wav",
                },
            )
        return output

    output = await asyncio.to_thread(_run)

    # Download the separated stems from Replicate's output URLs
    saved = {}
    async with httpx.AsyncClient(timeout=120) as client:
        for stem_name, url in output.items():
            if not isinstance(url, str) or not url.startswith("http"):
                continue
            stem_file = out_path / f"{stem_name}.wav"
            logger.info(f"[Demucs Replicate] Downloading {stem_name} stem...")
            resp = await client.get(url)
            resp.raise_for_status()
            stem_file.write_bytes(resp.content)
            saved[stem_name] = str(stem_file)

    logger.info(f"[Demucs Replicate] Completed: {len(saved)} stems.")
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
