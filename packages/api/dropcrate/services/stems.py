"""Demucs local offline audio separation service."""

import logging
import asyncio
from pathlib import Path
import torch
import torchaudio
from demucs.api import Separator, save_audio

logger = logging.getLogger(__name__)

def _get_device() -> str:
    """Detect the best available PyTorch device."""
    if torch.backends.mps.is_available():
        return "mps" # Apple Silicon Hardware Acceleration
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"

async def separate_audio(input_file: str, output_dir: str) -> dict[str, str]:
    """Separate an audio file into 4 stems using local Demucs v5.
    
    Args:
        input_file: Absolute path to the source audio file.
        output_dir: Absolute path to the directory where stems should be saved.
        
    Returns:
        A dictionary mapping the stem name ('vocals', 'drums', 'bass', 'other') 
        to its absolute file path.
    """
    input_path = Path(input_file)
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    device = _get_device()
    logger.info(f"Starting Demucs separation on device: {device}")
    
    # We use asyncio.to_thread because the model loading and inference is heavily synchronous and CPU/GPU bound.
    def _run_demucs():
        # Initialize Separator with the standard 4-stem model. 
        # HTDemucs is the v4/v5 architecture optimized for speed and quality.
        separator = Separator(model="htdemucs", device=device)
        
        # Load audio (Separator handles resampling to model's expected SR)
        origin, res = separator.separate_audio_file(str(input_path))
        
        saved_paths = {}
        for stem_name, stem_tensor in res.items():
            stem_file = out_path / f"{stem_name}.wav"
            # save_audio handles converting the tensor back to a wav file
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
