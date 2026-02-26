from __future__ import annotations

import asyncio
import base64
import io
import logging
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Callable

import httpx
import soundfile as sf

from dropcrate import config

logger = logging.getLogger(__name__)

# DJ-relevant categories for auto-segmentation
DEFAULT_DJ_PROMPTS: list[tuple[str, str]] = [
    ("Vocals", "singing voice and vocal harmonies"),
    ("Drums & Percussion", "drums, hi-hats, cymbals, and percussion"),
    ("Bass", "bass line and sub bass"),
    ("Guitar", "guitar, both acoustic and electric"),
    ("Piano & Keys", "piano, keyboard, and synthesizer melodies"),
    ("Pads & Atmosphere", "ambient pads, atmospheric textures, and background layers"),
    ("Strings", "string instruments, violins, and orchestral strings"),
    ("Effects & FX", "sound effects, risers, sweeps, and transitions"),
]

TARGET_SAMPLE_RATE = 48000


def _use_runpod() -> bool:
    """Check if RunPod backend is configured."""
    return bool(config.RUNPOD_API_KEY and config.RUNPOD_ENDPOINT_ID)


# ---------------------------------------------------------------------------
# Audio utilities (no torch dependency when using RunPod)
# ---------------------------------------------------------------------------

def get_audio_info(file_path: Path) -> dict:
    """Get audio file metadata using soundfile (no torch needed)."""
    info = sf.info(str(file_path))
    return {
        "duration_seconds": round(info.duration, 2),
        "sample_rate": info.samplerate,
        "channels": info.channels,
    }


def _audio_file_to_base64(file_path: Path) -> str:
    """Read audio file and return base64-encoded bytes."""
    return base64.b64encode(file_path.read_bytes()).decode("ascii")


def _base64_to_wav(b64: str, output_path: Path) -> None:
    """Decode base64 audio data and write as WAV file."""
    raw = base64.b64decode(b64)
    output_path.write_bytes(raw)


# ---------------------------------------------------------------------------
# RunPod backend — calls remote GPU serverless endpoint
# ---------------------------------------------------------------------------

class RunPodBackend:
    """Calls RunPod serverless endpoint for SAM-Audio inference."""

    def __init__(self) -> None:
        self._base_url = f"https://api.runpod.ai/v2/{config.RUNPOD_ENDPOINT_ID}"
        self._headers = {"Authorization": f"Bearer {config.RUNPOD_API_KEY}"}

    async def _submit_job(self, payload: dict) -> str:
        """Submit an async job to RunPod. Returns job ID."""
        logger.info("RunPod: submitting job to %s/run ...", self._base_url)
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self._base_url}/run",
                json={"input": payload},
                headers=self._headers,
            )
            if resp.status_code != 200:
                body = resp.text[:500]
                logger.error("RunPod submit failed (%s): %s", resp.status_code, body)
                raise RuntimeError(f"RunPod submit failed ({resp.status_code}): {body}")
            data = resp.json()
            job_id = data["id"]
            logger.info("RunPod: job submitted — id=%s", job_id)
            return job_id

    async def _poll_job(self, job_id: str, timeout: float = 600) -> dict:
        """Poll RunPod job until complete. Returns output dict."""
        start = time.monotonic()
        poll_count = 0
        async with httpx.AsyncClient(timeout=30) as client:
            while time.monotonic() - start < timeout:
                resp = await client.get(
                    f"{self._base_url}/status/{job_id}",
                    headers=self._headers,
                )
                resp.raise_for_status()
                data = resp.json()

                status = data.get("status")
                poll_count += 1
                elapsed = round(time.monotonic() - start, 1)

                if status == "COMPLETED":
                    logger.info("RunPod: job %s COMPLETED after %.1fs (%d polls)", job_id, elapsed, poll_count)
                    return data["output"]
                if status == "FAILED":
                    error = data.get("error", "unknown")
                    logger.error("RunPod: job %s FAILED after %.1fs: %s", job_id, elapsed, error)
                    raise RuntimeError(f"RunPod job failed: {error}")

                # Log status periodically (every 5th poll = ~10 seconds)
                if poll_count % 5 == 1:
                    logger.info("RunPod: job %s status=%s (%.1fs, poll #%d)", job_id, status, elapsed, poll_count)

                await asyncio.sleep(2)

        logger.error("RunPod: job %s timed out after %.0fs", job_id, timeout)
        raise TimeoutError("RunPod job timed out")

    async def separate(
        self,
        session_dir: Path,
        audio_path: Path,
        prompt: str,
        label: str,
        guidance_scale: float = 3.0,
        num_steps: int = 16,
        reranking_candidates: int = 1,
    ) -> dict:
        """Send audio to RunPod for separation, save results locally."""
        logger.info("RunPod: separating '%s' (prompt='%s')", label, prompt)
        audio_b64 = _audio_file_to_base64(audio_path)

        payload = {
            "audio_b64": audio_b64,
            "prompt": prompt,
            "guidance_scale": guidance_scale,
            "num_steps": num_steps,
            "reranking_candidates": reranking_candidates,
        }

        job_id = await self._submit_job(payload)
        result = await self._poll_job(job_id)

        segment_id = str(uuid.uuid4())[:8]
        slug = label.lower().replace(" ", "_").replace("&", "and")

        target_path = session_dir / f"{slug}_target.wav"
        residual_path = session_dir / f"{slug}_residual.wav"

        _base64_to_wav(result["target_b64"], target_path)
        _base64_to_wav(result["residual_b64"], residual_path)

        return {
            "id": segment_id,
            "prompt": prompt,
            "label": label,
            "target_filename": target_path.name,
            "residual_filename": residual_path.name,
            "duration_seconds": result.get("duration_seconds", 0),
        }


# ---------------------------------------------------------------------------
# Local backend — loads model on Apple Silicon / CUDA / CPU
# ---------------------------------------------------------------------------

class LocalBackend:
    """Runs SAM-Audio model locally."""

    def __init__(self) -> None:
        self._model: Any = None
        self._device: str = ""
        self._lock = asyncio.Lock()

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    async def load_model(self) -> None:
        if self._model is not None:
            return

        async with self._lock:
            if self._model is not None:
                return

            import torch
            if torch.cuda.is_available():
                self._device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self._device = "mps"
            else:
                self._device = "cpu"

            logger.info("Loading SAM-Audio %s on %s ...", config.SAM_AUDIO_MODEL, self._device)
            loop = asyncio.get_event_loop()
            self._model = await loop.run_in_executor(None, self._load_sync)
            logger.info("SAM-Audio model loaded")

    def _load_sync(self) -> Any:
        from sam_audio import SAMAudio  # type: ignore[import-untyped]
        hf_token = config.HF_TOKEN or None
        model = SAMAudio.from_pretrained(config.SAM_AUDIO_MODEL, token=hf_token)
        model = model.to(self._device)
        return model

    def _preprocess(self, file_path: Path):
        import torch
        import torchaudio
        waveform, sr = torchaudio.load(str(file_path))
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        if sr != TARGET_SAMPLE_RATE:
            waveform = torchaudio.transforms.Resample(sr, TARGET_SAMPLE_RATE)(waveform)
        return waveform

    def _separate_sync(self, waveform, prompt, guidance_scale, num_steps, reranking_candidates):
        import torch
        audio = waveform.to(self._device)
        with torch.no_grad():
            result = self._model.separate(
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
        return target.cpu(), residual.cpu()

    async def separate(
        self,
        session_dir: Path,
        audio_path: Path,
        prompt: str,
        label: str,
        guidance_scale: float = 3.0,
        num_steps: int = 16,
        reranking_candidates: int = 1,
    ) -> dict:
        await self.load_model()

        waveform = self._preprocess(audio_path)

        loop = asyncio.get_event_loop()
        target, residual = await loop.run_in_executor(
            None, self._separate_sync, waveform, prompt, guidance_scale, num_steps, reranking_candidates
        )

        segment_id = str(uuid.uuid4())[:8]
        slug = label.lower().replace(" ", "_").replace("&", "and")

        target_path = session_dir / f"{slug}_target.wav"
        residual_path = session_dir / f"{slug}_residual.wav"

        sf.write(str(target_path), target.squeeze().numpy(), TARGET_SAMPLE_RATE)
        sf.write(str(residual_path), residual.squeeze().numpy(), TARGET_SAMPLE_RATE)

        duration = target.shape[-1] / TARGET_SAMPLE_RATE
        return {
            "id": segment_id,
            "prompt": prompt,
            "label": label,
            "target_filename": target_path.name,
            "residual_filename": residual_path.name,
            "duration_seconds": round(duration, 2),
        }


# ---------------------------------------------------------------------------
# Unified service — auto-selects backend based on config
# ---------------------------------------------------------------------------

class SAMAudioService:
    """Unified SAM-Audio service. Uses RunPod when configured, local otherwise."""

    def __init__(self) -> None:
        self._runpod: RunPodBackend | None = None
        self._local: LocalBackend | None = None

    @property
    def is_loaded(self) -> bool:
        if _use_runpod():
            return True  # RunPod is always "loaded"
        return self._local is not None and self._local.is_loaded

    @property
    def backend_name(self) -> str:
        return "runpod" if _use_runpod() else "local"

    def _get_backend(self) -> RunPodBackend | LocalBackend:
        if _use_runpod():
            if self._runpod is None:
                self._runpod = RunPodBackend()
            return self._runpod
        else:
            # Check if torch is available before trying local
            try:
                import torch  # noqa: F401
            except ImportError:
                raise RuntimeError(
                    "No GPU backend available. Set RUNPOD_API_KEY and "
                    "RUNPOD_ENDPOINT_ID environment variables for cloud inference, "
                    "or install PyTorch for local inference."
                )
            if self._local is None:
                self._local = LocalBackend()
            return self._local

    async def load_model(self) -> None:
        """Pre-load model (only relevant for local backend)."""
        backend = self._get_backend()
        if isinstance(backend, LocalBackend):
            await backend.load_model()

    async def separate(
        self,
        session_dir: Path,
        audio_path: Path,
        prompt: str,
        label: str,
        guidance_scale: float = 3.0,
        num_steps: int = 16,
        reranking_candidates: int = 1,
    ) -> dict:
        backend = self._get_backend()
        return await backend.separate(
            session_dir=session_dir,
            audio_path=audio_path,
            prompt=prompt,
            label=label,
            guidance_scale=guidance_scale,
            num_steps=num_steps,
            reranking_candidates=reranking_candidates,
        )

    async def auto_segment(
        self,
        session_dir: Path,
        audio_path: Path,
        categories: list[tuple[str, str]] | None = None,
        guidance_scale: float = 3.0,
        num_steps: int = 16,
        reranking_candidates: int = 1,
        progress_callback: Callable[[str, int, int], None] | None = None,
        error_callback: Callable[[str, str], None] | None = None,
    ) -> list[dict]:
        prompts = categories or DEFAULT_DJ_PROMPTS
        results: list[dict] = []

        for i, (label, prompt) in enumerate(prompts):
            if progress_callback:
                progress_callback(label, i, len(prompts))

            try:
                result = await self.separate(
                    session_dir=session_dir,
                    audio_path=audio_path,
                    prompt=prompt,
                    label=label,
                    guidance_scale=guidance_scale,
                    num_steps=num_steps,
                    reranking_candidates=reranking_candidates,
                )
                results.append(result)
            except Exception as e:
                logger.warning("Failed to separate '%s': %s", label, e)
                if error_callback:
                    error_callback(prompt, str(e))

        return results


def cleanup_old_sessions(max_age_seconds: int = 3600) -> int:
    """Delete segment sessions older than max_age_seconds."""
    segments_dir = config.SEGMENTS_DIR
    if not segments_dir.exists():
        return 0

    now = time.monotonic()
    deleted = 0
    for session_dir in segments_dir.iterdir():
        if not session_dir.is_dir():
            continue
        age = time.time() - session_dir.stat().st_mtime
        if age > max_age_seconds:
            shutil.rmtree(session_dir, ignore_errors=True)
            deleted += 1
    return deleted


# Singleton
sam_audio_service = SAMAudioService()
