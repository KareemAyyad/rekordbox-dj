"""
RunPod Serverless Handler for SAM-Audio inference.

Deploy this to RunPod as a serverless GPU endpoint.
It receives audio (base64) + prompt, runs SAM-Audio separation,
and returns target + residual audio as base64.
"""
from __future__ import annotations

import base64
import io
import os
import logging

import runpod
import soundfile as sf
import torch
import torchaudio

logger = logging.getLogger(__name__)

TARGET_SAMPLE_RATE = 48000

# Global model reference (loaded once, reused across requests)
_model = None
_device = None


def load_model():
    """Load SAM-Audio model (called once on cold start)."""
    global _model, _device
    if _model is not None:
        return

    from sam_audio import SAMAudio

    model_name = os.environ.get("SAM_AUDIO_MODEL", "facebook/sam-audio-base")
    hf_token = os.environ.get("HF_TOKEN") or None

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info("Loading %s on %s ...", model_name, _device)

    _model = SAMAudio.from_pretrained(model_name, token=hf_token)
    _model = _model.to(_device)
    logger.info("Model loaded")


def preprocess(audio_bytes: bytes) -> torch.Tensor:
    """Load audio from bytes, resample to 48kHz mono."""
    buf = io.BytesIO(audio_bytes)
    waveform, sr = torchaudio.load(buf)

    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)

    if sr != TARGET_SAMPLE_RATE:
        waveform = torchaudio.transforms.Resample(sr, TARGET_SAMPLE_RATE)(waveform)

    return waveform


def tensor_to_wav_b64(tensor: torch.Tensor) -> str:
    """Convert audio tensor to base64-encoded WAV bytes."""
    buf = io.BytesIO()
    sf.write(buf, tensor.squeeze().numpy(), TARGET_SAMPLE_RATE, format="WAV")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("ascii")


def handler(job):
    """RunPod handler function. Receives job input, returns output."""
    load_model()

    inp = job["input"]
    audio_b64 = inp["audio_b64"]
    prompt = inp["prompt"]
    guidance_scale = inp.get("guidance_scale", 3.0)
    num_steps = inp.get("num_steps", 16)
    reranking_candidates = inp.get("reranking_candidates", 1)

    # Decode and preprocess audio
    audio_bytes = base64.b64decode(audio_b64)
    waveform = preprocess(audio_bytes)
    audio = waveform.to(_device)

    # Run separation
    with torch.no_grad():
        result = _model.separate(
            audio,
            text_prompt=prompt,
            num_steps=num_steps,
            guidance_scale=guidance_scale,
            reranking_candidates=reranking_candidates,
        )

    if isinstance(result, tuple):
        target, residual = result[0], result[1]
    else:
        target, residual = result["target"], result["residual"]

    target = target.cpu()
    residual = residual.cpu()

    duration = target.shape[-1] / TARGET_SAMPLE_RATE

    return {
        "target_b64": tensor_to_wav_b64(target),
        "residual_b64": tensor_to_wav_b64(residual),
        "duration_seconds": round(duration, 2),
    }


runpod.serverless.start({"handler": handler})
