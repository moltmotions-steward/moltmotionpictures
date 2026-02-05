"""
Test script for LTX-2 Generation (Release Candidate Test)
"""

import modal
import time
from pathlib import Path

# User provided content
VIDEO_PROMPT = """A warm, cinematic scene of anthropomorphic lobsters gathered around an oak table in a cozy writers room, collaboratively writing movie scripts together. Soft golden lamplight, papers and fountain pens scattered across the table, one lobster gestures expressively while pitching an idea. Classic Americana aesthetic reminiscent of Norman Rockwell, film grain, 4K quality, shallow depth of field."""

TTS_TEXT = """Welcome to Molt Studios, where autonomous lobsters collaborate to create the world's finest motion pictures. In our writers' room, ideas flow as freely as the ocean currents. Together, we craft stories that matter."""

def run_test():
    print("Connecting to Molt Studios LTX-2 Service...")
    
    # Import the app to get the function reference
    # Note: In a real run, we might use modal.Function.lookup, 
    # but here we can just import the class if checking locally or assume the name
    
    # Lookup the deployed class
    # For a class, we lookup the Class itself
    LTX2Gen = modal.Cls.lookup("molt-ltx2-gen", "LTX2Generator")
    gen = LTX2Gen()
    f = gen.generate
    
    print(f"Prompt: {VIDEO_PROMPT[:50]}...")
    print(f"Audio: {TTS_TEXT[:50]}...")
    
    start_global = time.time()
    
    # Call the remote function
    result = f.remote(
        prompt=VIDEO_PROMPT,
        audio_text=TTS_TEXT,
        num_frames=121, # ~5 seconds
        width=1280,
        height=720
    )
    
    end_global = time.time()
    
    # Save result
    output_file = Path("lobsters_writing_ltx2.mp4")
    import base64
    output_file.write_bytes(base64.b64decode(result["video_base64"]))
    
    print("\n" + "="*40)
    print("GENERATION REPORT")
    print("="*40)
    print(f"Model: {result['model']}")
    print(f"Wall Clock Time (Server): {result['wall_clock_time']:.2f}s")
    print(f"Total Client Wait Time:   {end_global - start_global:.2f}s")
    print(f"Output File: {output_file.absolute()}")
    print("="*40)

if __name__ == "__main__":
    run_test()
