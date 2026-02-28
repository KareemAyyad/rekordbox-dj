#!/usr/bin/env python3
"""End-to-end smoke test for Replicate Demucs stem separation.

Usage:
    REPLICATE_API_TOKEN=r8_xxx python test_replicate_e2e.py

This script bypasses the web app entirely and tests the raw Replicate HTTP
integration. It generates a short test audio file, uploads it, runs htdemucs_ft,
and verifies all 4 stems are returned.
"""

import asyncio
import os
import sys
import time
from pathlib import Path

# Ensure dropcrate package is importable
sys.path.insert(0, str(Path(__file__).parent))

# Pre-set the token before importing config
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "")
if not TOKEN:
    print("ERROR: Set REPLICATE_API_TOKEN environment variable")
    sys.exit(1)


async def main():
    from dropcrate.services.stems import _separate_replicate

    test_wav = Path("/tmp/dropcrate_test_input.wav")
    out_dir = Path("/tmp/dropcrate_test_stems")
    out_dir.mkdir(parents=True, exist_ok=True)

    # Clean previous runs
    for f in out_dir.glob("*.wav"):
        f.unlink()

    # Generate a 5-second stereo tone (440 Hz sine wave)
    print("=" * 60)
    print("🧪 DropCrate Replicate E2E Test")
    print("=" * 60)
    print()
    print("1. Generating 5s test audio (440Hz sine)...")
    os.system(
        f'ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -ac 2 -ar 44100 -y {test_wav} 2>/dev/null'
    )
    if not test_wav.exists():
        print("   ❌ Failed to generate test audio (is ffmpeg installed?)")
        sys.exit(1)
    print(f"   ✅ Created {test_wav} ({test_wav.stat().st_size / 1024:.0f} KB)")

    # Run separation
    print()
    print("2. Running Replicate separation (htdemucs_ft on A100 GPU)...")
    print("   This typically takes 60-120 seconds for htdemucs_ft...")
    print()

    start = time.time()
    try:
        results = await _separate_replicate(test_wav, out_dir)
    except Exception as e:
        print(f"   ❌ FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    elapsed = time.time() - start

    # Verify results
    print()
    print("3. Verifying results...")
    expected_stems = {"vocals", "drums", "bass", "other"}
    found_stems = set(results.keys())

    all_good = True
    for stem in expected_stems:
        if stem in found_stems:
            path = Path(results[stem])
            size_kb = path.stat().st_size / 1024
            if size_kb > 0:
                print(f"   ✅ {stem}: {size_kb:.0f} KB")
            else:
                print(f"   ❌ {stem}: file is empty!")
                all_good = False
        else:
            print(f"   ❌ {stem}: MISSING")
            all_good = False

    extra = found_stems - expected_stems
    if extra:
        print(f"   ℹ️  Extra stems: {extra}")

    print()
    print("=" * 60)
    if all_good:
        print(f"✅ ALL TESTS PASSED — {len(results)} stems in {elapsed:.0f}s")
    else:
        print(f"❌ SOME TESTS FAILED — check output above")
    print("=" * 60)

    sys.exit(0 if all_good else 1)


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO, format="   %(message)s")
    asyncio.run(main())
