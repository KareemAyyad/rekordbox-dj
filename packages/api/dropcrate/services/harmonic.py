"""Harmonic analysis service — detects BPM and Camelot Key using librosa."""

import logging
import numpy as np
import librosa

logger = logging.getLogger(__name__)

# Krumhansl-Schmuckler profiles for major and minor keys
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

# Normalize profiles
MAJOR_PROFILE = MAJOR_PROFILE / np.linalg.norm(MAJOR_PROFILE)
MINOR_PROFILE = MINOR_PROFILE / np.linalg.norm(MINOR_PROFILE)

# Camelot minor/major wheel mappings (Index 0 = C)
CAMELOT_MAJOR = ["8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B"]
CAMELOT_MINOR = ["5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A"]

def find_hot_cues(y: np.ndarray, sr: int, bpm: int, beats_in_seconds: np.ndarray) -> list[dict]:
    """Find high-energy drops and changes in the track, mapping them to the beat grid."""
    if len(beats_in_seconds) == 0:
        return []

    cues = []
    
    # Grid Cue (Position 1)
    cues.append({
        "name": "Intro",
        "time": round(float(beats_in_seconds[0]), 3),
        "color": "white"
    })

    # Energy analysis
    rms = librosa.feature.rms(y=y)[0]
    times = librosa.times_like(rms, sr=sr)
    
    # Calculate energy gradients
    diffs = np.diff(rms, prepend=0)
    
    # Find top 3 biggest energy spikes (at least 30 seconds apart, past the intro)
    from scipy.signal import find_peaks
    peaks, _ = find_peaks(diffs, height=np.mean(diffs) + 2 * np.std(diffs), distance=sr * 30 // 512)
    
    for i, peak_idx in enumerate(peaks[:3]):
        peak_time = times[peak_idx]
        if peak_time < 15.0: # Ignore spikes in the first 15 seconds
            continue
            
        # Quantize to nearest beat
        closest_beat_idx = np.argmin(np.abs(beats_in_seconds - peak_time))
        quantized_time = beats_in_seconds[closest_beat_idx]
        
        cues.append({
            "name": f"Drop {i+1}",
            "time": round(float(quantized_time), 3),
            "color": "red"
        })

    return cues

def analyze_audio(file_path: str) -> tuple[int, str, list[dict]]:
    """Analyze an audio file to determine its BPM, Camelot Key, and Hot Cues.
    
    Args:
        file_path: Absolute path to the audio file.
        
    Returns:
        A tuple of (bpm, camelot_key, hot_cues).
    """
    try:
        y, sr = librosa.load(file_path, sr=22050, mono=True)
        
        # 1. BPM Extraction
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        bpm = int(round(tempo[0])) if isinstance(tempo, np.ndarray) else int(round(tempo))
        beats_in_seconds = librosa.frames_to_time(beat_frames, sr=sr)
        
        # 2. Key Extraction
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_sum = np.sum(chroma, axis=1)
        
        major_corrs = []
        minor_corrs = []
        for i in range(12):
            maj_shifted = np.roll(MAJOR_PROFILE, i)
            min_shifted = np.roll(MINOR_PROFILE, i)
            major_corrs.append(np.corrcoef(chroma_sum, maj_shifted)[0, 1])
            minor_corrs.append(np.corrcoef(chroma_sum, min_shifted)[0, 1])
            
        best_major = int(np.argmax(major_corrs))
        best_minor = int(np.argmax(minor_corrs))
        
        if major_corrs[best_major] > minor_corrs[best_minor]:
            key = CAMELOT_MAJOR[best_major]
        else:
            key = CAMELOT_MINOR[best_minor]
            
        # 3. AI Hot Cues
        hot_cues = find_hot_cues(y, sr, bpm, beats_in_seconds)
            
        return bpm, key, hot_cues
    except Exception as e:
        logger.error(f"Failed harmonic analysis on {file_path}: {e}")
        return 0, "", []
