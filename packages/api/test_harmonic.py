import numpy as np
import soundfile as sf
from dropcrate.services.harmonic import analyze_audio

sr = 22050
t = np.linspace(0, 5, 5*sr)
y = np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 554.37 * t) + np.sin(2 * np.pi * 659.25 * t)
sf.write("test_chord.wav", y, sr)

bpm, key = analyze_audio("test_chord.wav")
print(f"Detected BPM: {bpm} - Detected Key: {key}")
