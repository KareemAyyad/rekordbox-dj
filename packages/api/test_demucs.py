import asyncio
from dropcrate.services.stems import separate_audio
import soundfile as sf
import numpy as np

async def main():
    sr = 44100
    t = np.linspace(0, 5, 5 * sr)
    y = np.sin(2 * np.pi * 440 * t)
    
    # Write a dummy input
    input_file = "test_demucs_input.wav"
    sf.write(input_file, y, sr)
    
    # Run the offline separator
    print("Testing Demucs local separation...")
    paths = await separate_audio(input_file, "demo_stems_output")
    for name, path in paths.items():
        print(f"Generated {name}: {path}")

if __name__ == "__main__":
    asyncio.run(main())
