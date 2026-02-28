"""Demucs local offline audio separation service.

This module is OPTIONAL — it requires torch, torchaudio, and demucs.
On cloud deployments without these packages, the segment router falls back
to the RunPod/SAM-Audio backend instead.
"""

import logging
import asyncio
from pathlib import Path

logger = logging.getLogger(__name__)

# Lazy-check for torch availability
_TORCH_AVAILABLE = False
try:
    import torch
    import torchaudio  # noqa: F401
    from demucs.api import Separator, save_audio
    _TORCH_AVAILABLE = True
except ImportError:
    logger.info("PyTorch/Demucs not installed — local stems disabled, using RunPod fallback.")


def is_available() -> bool:
    """Check if the local Demucs engine is available."""
    return _TORCH_AVAILABLE


def _get_device() -> str:
    """Detect the best available PyTorch device."""
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"


async def separate_audio(input_file: str, output_dir: str) -> dict[str, str]:
    """Separate an audio file into 4 stems using local Demucs.

    Returns a dict mapping stem name to its absolute file path.
    Raises RuntimeError if torch is not available.
    """
    if not _TORCH_AVAILABLE:
        raise RuntimeError("Local Demucs engine is not available. Install torch, torchaudio, and demucs.")

    input_path = Path(input_file)
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    device = _get_device()
    logger.info(f"Starting Demucs separation on device: {device}")

    def _run_demucs():
        separator = Separator(model="htdemucs", device=device)
        origin, res = separator.separate_audio_file(str(input_path))

        saved_paths = {}
        for stem_name, stem_tensor in res.items():
            stem_file = out_path / f"{stem_name}.wav"
            save_audio(stem_tensor, str(stem_file), samplerate=separator.samplerate)
            saved_paths[stem_name] = str(stem_file)

        return saved_paths

    try:
        paths = await asyncio.to_thread(_run_demucs)
        logger.info(f"Successfully separated {input_path.name} into {len(paths)} stems.")
        return paths
    except Exception as e:
        logger.error(f"Demucs separation failed for {input_path.name}: {e}")
        raise RuntimeError(f"Demucs separation failed: {e}")
