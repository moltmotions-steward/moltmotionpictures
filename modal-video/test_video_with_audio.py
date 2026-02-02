#!/usr/bin/env python3
"""
Test script to generate video + audio and combine them.
Demonstrates the full production pipeline:
1. Generate video with Modal (Mochi)
2. Generate TTS audio with DigitalOcean Gradient (ElevenLabs via fal)
3. Combine with FFmpeg

Usage:
    python test_video_with_audio.py
"""

import os
import sys
import time
import json
import subprocess
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
DO_GRADIENT_API_KEY = os.environ.get('DO_GRADIENT_API_KEY')
DO_GRADIENT_ENDPOINT = os.environ.get('DO_GRADIENT_ENDPOINT', 'https://inference.do-ai.run')

# Test content
VIDEO_PROMPT = """A warm, cinematic scene of anthropomorphic lobsters gathered around an oak table in a cozy writers room, collaboratively writing movie scripts together. Soft golden lamplight, papers and fountain pens scattered across the table, one lobster gestures expressively while pitching an idea. Classic Americana aesthetic reminiscent of Norman Rockwell, film grain, 4K quality, shallow depth of field."""

# Narration text for TTS (what the lobsters might be discussing)
TTS_TEXT = """Welcome to Molt Studios, where autonomous lobsters collaborate to create the world's finest motion pictures. In our writers' room, ideas flow as freely as the ocean currents. Together, we craft stories that matter."""


def generate_video_with_modal():
    """Generate video using Modal and Mochi model."""
    print("\n🎬 Starting video generation with Modal...")
    start_time = time.time()
    
    # Import and run Modal
    try:
        import modal
        from video_gen import generate_video
        
        # Call the Modal function
        result = generate_video.remote(
            prompt=VIDEO_PROMPT,
            num_frames=48,  # ~2 seconds at 24fps
            width=848,
            height=480,
            num_inference_steps=50
        )
        
        elapsed = time.time() - start_time
        print(f"✅ Video generated in {elapsed:.1f}s")
        
        # Save locally
        video_path = "/root/MOLTSTUDIOS/modal-video/test_video.mp4"
        with open(video_path, 'wb') as f:
            f.write(result)
        print(f"   Saved to: {video_path}")
        
        return video_path, elapsed
        
    except Exception as e:
        print(f"❌ Video generation failed: {e}")
        raise


def generate_tts_with_gradient():
    """Generate TTS audio using DigitalOcean Gradient (ElevenLabs via fal)."""
    print("\n🎙️ Starting TTS generation with DigitalOcean Gradient...")
    start_time = time.time()
    
    if not DO_GRADIENT_API_KEY:
        raise ValueError("DO_GRADIENT_API_KEY environment variable required")
    
    headers = {
        'Authorization': f'Bearer {DO_GRADIENT_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    # Start async TTS job
    payload = {
        "model_id": "fal-ai/elevenlabs/tts/multilingual-v2",
        "input": {
            "text": TTS_TEXT
        },
        "tags": [{"key": "type", "value": "test"}]
    }
    
    print(f"   Sending TTS request to {DO_GRADIENT_ENDPOINT}/v1/async-invoke...")
    response = requests.post(
        f"{DO_GRADIENT_ENDPOINT}/v1/async-invoke",
        headers=headers,
        json=payload,
        timeout=30
    )
    
    if not response.ok:
        print(f"❌ TTS request failed: {response.status_code} - {response.text}")
        raise Exception(f"TTS request failed: {response.status_code}")
    
    job = response.json()
    request_id = job.get('request_id')
    print(f"   Job started: {request_id}")
    
    # Poll for completion
    max_wait = 120  # 2 minutes
    poll_interval = 2
    elapsed = 0
    
    while elapsed < max_wait:
        status_response = requests.get(
            f"{DO_GRADIENT_ENDPOINT}/v1/async-invoke/{request_id}/status",
            headers=headers,
            timeout=10
        )
        
        if not status_response.ok:
            print(f"   Status check failed: {status_response.status_code}")
            time.sleep(poll_interval)
            elapsed += poll_interval
            continue
        
        status = status_response.json()
        print(f"   Status: {status.get('status', 'unknown')} ({elapsed}s elapsed)")
        
        if status.get('status') == 'COMPLETE':
            # Get the result
            result_response = requests.get(
                f"{DO_GRADIENT_ENDPOINT}/v1/async-invoke/{request_id}",
                headers=headers,
                timeout=30
            )
            
            if result_response.ok:
                result = result_response.json()
                audio_url = result.get('audio_url') or result.get('output', {}).get('audio_url')
                
                if audio_url:
                    # Download the audio file
                    audio_path = "/root/MOLTSTUDIOS/modal-video/test_audio.mp3"
                    print(f"   Downloading audio from: {audio_url[:80]}...")
                    
                    audio_download = requests.get(audio_url, timeout=60)
                    with open(audio_path, 'wb') as f:
                        f.write(audio_download.content)
                    
                    total_elapsed = time.time() - start_time
                    print(f"✅ TTS generated in {total_elapsed:.1f}s")
                    print(f"   Saved to: {audio_path}")
                    
                    return audio_path, total_elapsed
                else:
                    print(f"   Result structure: {json.dumps(result, indent=2)[:500]}")
                    raise Exception("No audio_url in response")
            else:
                raise Exception(f"Failed to get result: {result_response.status_code}")
        
        elif status.get('status') == 'FAILED':
            raise Exception(f"TTS job failed: {status}")
        
        time.sleep(poll_interval)
        elapsed += poll_interval
    
    raise Exception("TTS generation timed out")


def combine_video_audio(video_path: str, audio_path: str, output_path: str):
    """Combine video and audio using FFmpeg."""
    print("\n🔧 Combining video and audio with FFmpeg...")
    start_time = time.time()
    
    # First, get video duration
    probe_cmd = [
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', video_path
    ]
    video_duration = float(subprocess.check_output(probe_cmd).decode().strip())
    print(f"   Video duration: {video_duration:.2f}s")
    
    # Get audio duration
    probe_cmd[5] = audio_path
    audio_duration = float(subprocess.check_output(probe_cmd).decode().strip())
    print(f"   Audio duration: {audio_duration:.2f}s")
    
    # Combine - trim audio to video length if needed
    cmd = [
        'ffmpeg', '-y',
        '-i', video_path,
        '-i', audio_path,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',  # Use the shorter of the two
        '-map', '0:v:0',
        '-map', '1:a:0',
        output_path
    ]
    
    print(f"   Running: ffmpeg -i {video_path} -i {audio_path} -shortest {output_path}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"❌ FFmpeg failed: {result.stderr}")
        raise Exception(f"FFmpeg failed: {result.returncode}")
    
    elapsed = time.time() - start_time
    print(f"✅ Combined in {elapsed:.1f}s")
    print(f"   Output: {output_path}")
    
    return output_path, elapsed


def run_parallel_generation():
    """
    Run video and audio generation in parallel to minimize total time.
    This tests for race conditions and demonstrates the production pattern.
    """
    print("=" * 60)
    print("🦞 MOLT STUDIOS - Video + Audio Generation Test")
    print("=" * 60)
    print(f"\nVideo prompt: {VIDEO_PROMPT[:100]}...")
    print(f"TTS text: {TTS_TEXT[:100]}...")
    
    overall_start = time.time()
    video_path = None
    audio_path = None
    video_time = 0
    audio_time = 0
    
    # Run both generations in parallel
    print("\n" + "=" * 60)
    print("PHASE 1: Parallel Generation (Video + Audio)")
    print("=" * 60)
    
    with ThreadPoolExecutor(max_workers=2) as executor:
        # Submit both tasks
        video_future = executor.submit(generate_video_with_modal)
        audio_future = executor.submit(generate_tts_with_gradient)
        
        # Track completion
        for future in as_completed([video_future, audio_future]):
            try:
                result = future.result()
                if future == video_future:
                    video_path, video_time = result
                else:
                    audio_path, audio_time = result
            except Exception as e:
                print(f"❌ Generation failed: {e}")
                # Continue with the other if one fails
    
    if not video_path:
        print("❌ Video generation failed - cannot proceed")
        return
    
    if not audio_path:
        print("⚠️ Audio generation failed - outputting video only")
        output_path = "/root/MOLTSTUDIOS/modal-video/test_final_video_only.mp4"
        subprocess.run(['cp', video_path, output_path])
        return
    
    # Combine video and audio
    print("\n" + "=" * 60)
    print("PHASE 2: Muxing Video + Audio")
    print("=" * 60)
    
    output_path = "/root/MOLTSTUDIOS/modal-video/test_final_with_audio.mp4"
    combine_time = 0
    
    try:
        _, combine_time = combine_video_audio(video_path, audio_path, output_path)
    except Exception as e:
        print(f"❌ Combine failed: {e}")
        return
    
    # Summary
    overall_time = time.time() - overall_start
    
    print("\n" + "=" * 60)
    print("📊 GENERATION SUMMARY")
    print("=" * 60)
    print(f"Video generation time: {video_time:.1f}s")
    print(f"Audio generation time: {audio_time:.1f}s")
    print(f"Muxing time:          {combine_time:.1f}s")
    print(f"Total wall time:      {overall_time:.1f}s")
    print(f"")
    print(f"Time saved by parallel: ~{max(video_time, audio_time) - min(video_time, audio_time):.1f}s")
    print(f"")
    print(f"🎬 Final output: {output_path}")
    print("=" * 60)


def run_sequential_test():
    """
    Run video generation only (using existing local run).
    For testing without Modal imports.
    """
    print("=" * 60)
    print("🦞 MOLT STUDIOS - TTS Only Test")
    print("=" * 60)
    
    try:
        audio_path, audio_time = generate_tts_with_gradient()
        print(f"\n✅ TTS test complete in {audio_time:.1f}s")
        print(f"   Audio file: {audio_path}")
    except Exception as e:
        print(f"\n❌ TTS test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == '--tts-only':
        run_sequential_test()
    else:
        run_parallel_generation()
