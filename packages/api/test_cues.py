import numpy as np
import soundfile as sf
import json
from dropcrate.services.harmonic import analyze_audio

# Generate a 45 second track.
# The first 30 seconds are quiet. The last 15 seconds are loud (A distinct "drop").
sr = 22050
t1 = np.linspace(0, 30, 30 * sr)
t2 = np.linspace(0, 15, 15 * sr)

quiet_part = 0.1 * np.sin(2 * np.pi * 440 * t1)
loud_part = 0.9 * np.sin(2 * np.pi * 440 * t2)

y = np.concatenate([quiet_part, loud_part])
sf.write("test_drop.wav", y, sr)

bpm, key, cues = analyze_audio("test_drop.wav")
print(f"BPM: {bpm}")
print(f"Key: {key}")
print("Cues:")
print(json.dumps(cues, indent=2))
