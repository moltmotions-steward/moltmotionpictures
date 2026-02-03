"""
Molt Studios - Serverless Video Generation on Modal

This Modal app provides text-to-video generation using Mochi model.
It's configured for cold-start (not always on) to minimize costs.
Only spins up when requests come in.

Usage:
    modal deploy video_gen.py  # Deploy to Modal
    modal run video_gen.py --prompt "A cinematic shot..."  # Test locally
"""

import modal
import os
from pathlib import Path

# =============================================================================
# Modal App Configuration
# =============================================================================

# Create the Modal app - this is the main entry point
app = modal.App("molt-video-gen")

# Container image with all dependencies for Mochi video generation
# Using diffusers for the Mochi model
mochi_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "libsm6", "libxext6")
    .pip_install(
        "torch>=2.1.0",
        "diffusers>=0.31.0",
        "transformers>=4.44.0",
        "accelerate>=0.33.0",
        "sentencepiece>=0.2.0",
        "imageio[ffmpeg]>=2.34.0",
        "numpy<2.0",
        "safetensors>=0.4.0",
        "huggingface_hub>=0.25.0",
        "fastapi[standard]",
    )
    .env({
        "HF_HOME": "/cache/huggingface",
        "TORCH_HOME": "/cache/torch",
        "TRANSFORMERS_CACHE": "/cache/transformers",
    })
)

# Volume for caching model weights (persists across cold starts)
model_cache = modal.Volume.from_name("molt-mochi-cache", create_if_missing=True)

# =============================================================================
# Video Generation Class
# =============================================================================

@app.cls(
    image=mochi_image,
    gpu="A100",  # Mochi requires A100 for full quality
    timeout=600,  # 10 minute timeout for video generation
    scaledown_window=60,  # Container shuts down after 60s idle (cold start is fine)
    volumes={"/cache": model_cache},
    secrets=[],  # Add any secrets needed (e.g., HF_TOKEN if using gated models)
)
class MochiVideoGenerator:
    """
    Mochi text-to-video generator running on Modal.
    
    Cold-start optimized: Container spins down when idle to save costs.
    Model weights are cached in a persistent volume for faster subsequent starts.
    """
    
    @modal.enter()
    def load_model(self):
        """Load the Mochi model on container startup."""
        import torch
        from diffusers import MochiPipeline
        from diffusers.utils import export_to_video
        
        print("Loading Mochi model...")
        
        # Load Mochi pipeline - weights will be cached in the volume
        self.pipe = MochiPipeline.from_pretrained(
            "genmo/mochi-1-preview",
            torch_dtype=torch.bfloat16,
            cache_dir="/cache/huggingface",
        )
        
        # Move to GPU and enable memory optimizations
        self.pipe.enable_model_cpu_offload()
        self.pipe.enable_vae_tiling()
        
        # Store export function for later use
        self.export_to_video = export_to_video
        
        print("Mochi model loaded successfully!")
    
    @modal.method()
    def generate(
        self,
        prompt: str,
        negative_prompt: str = "low quality, blurry, distorted",
        num_frames: int = 84,  # ~3.5 seconds at 24fps
        fps: int = 24,
        width: int = 848,
        height: int = 480,
        num_inference_steps: int = 50,
        guidance_scale: float = 4.5,
        seed: int | None = None,
    ) -> dict:
        """
        Generate a video from a text prompt.
        
        Args:
            prompt: Text description of the video to generate
            negative_prompt: What to avoid in generation
            num_frames: Number of frames (84 ≈ 3.5s at 24fps)
            fps: Frames per second for output video
            width: Video width (default 848 for 16:9)
            height: Video height (default 480 for 16:9)
            num_inference_steps: Quality vs speed tradeoff
            guidance_scale: How closely to follow prompt
            seed: Random seed for reproducibility
            
        Returns:
            dict with video_bytes (base64), duration, and metadata
        """
        import torch
        import base64
        import io
        import time
        
        start_time = time.time()
        
        # Set seed for reproducibility
        generator = None
        if seed is not None:
            generator = torch.Generator(device="cpu").manual_seed(seed)
        else:
            seed = torch.randint(0, 2**32, (1,)).item()
            generator = torch.Generator(device="cpu").manual_seed(seed)
        
        print(f"Generating video for prompt: {prompt[:100]}...")
        print(f"Settings: {num_frames} frames, {width}x{height}, {num_inference_steps} steps")
        
        # Generate video frames
        with torch.autocast("cuda", dtype=torch.bfloat16):
            frames = self.pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                num_frames=num_frames,
                width=width,
                height=height,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                generator=generator,
            ).frames[0]
        
        # Export frames to video bytes
        video_path = "/tmp/output.mp4"
        self.export_to_video(frames, video_path, fps=fps)
        
        # Read video bytes and encode as base64
        with open(video_path, "rb") as f:
            video_bytes = f.read()
        
        video_base64 = base64.b64encode(video_bytes).decode("utf-8")
        
        generation_time = time.time() - start_time
        duration = num_frames / fps
        
        print(f"Video generated in {generation_time:.1f}s")
        
        return {
            "video_base64": video_base64,
            "duration_seconds": duration,
            "width": width,
            "height": height,
            "fps": fps,
            "num_frames": num_frames,
            "seed": seed,
            "generation_time_seconds": generation_time,
            "prompt": prompt,
        }
    
    @modal.method()
    def health_check(self) -> dict:
        """Check if the model is loaded and ready."""
        import torch
        return {
            "status": "healthy",
            "model": "mochi-1-preview",
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none",
            "cuda_available": torch.cuda.is_available(),
        }


# =============================================================================
# Web Endpoint (for API calls from your Node.js backend)
# =============================================================================

@app.function(
    image=mochi_image,
    timeout=600,
    scaledown_window=30,  # Keep web endpoint minimal
)
@modal.fastapi_endpoint(method="POST", docs=True)
def generate_video(request: dict) -> dict:
    """
    HTTP endpoint for video generation.
    
    POST /generate_video
    Body: {
        "prompt": "A cinematic shot of...",
        "negative_prompt": "optional",
        "num_frames": 84,
        "width": 848,
        "height": 480,
        "fps": 24,
        "seed": null
    }
    
    Returns: {
        "video_base64": "...",
        "duration_seconds": 3.5,
        "metadata": {...}
    }
    """
    prompt = request.get("prompt")
    if not prompt:
        return {"error": "prompt is required"}
    
    # Get the generator class and call it
    generator = MochiVideoGenerator()
    
    result = generator.generate.remote(
        prompt=prompt,
        negative_prompt=request.get("negative_prompt", "low quality, blurry, distorted"),
        num_frames=request.get("num_frames", 84),
        fps=request.get("fps", 24),
        width=request.get("width", 848),
        height=request.get("height", 480),
        num_inference_steps=request.get("num_inference_steps", 50),
        guidance_scale=request.get("guidance_scale", 4.5),
        seed=request.get("seed"),
    )
    
    return result


@app.function(
    image=mochi_image,
    timeout=30,
    scaledown_window=10,
)
@modal.fastapi_endpoint(method="GET", docs=True)
def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "service": "molt-video-gen", "model": "mochi-1-preview"}


# =============================================================================
# Local Testing
# =============================================================================

@app.local_entrypoint()
def main(
    prompt: str = "A cinematic wide shot of a futuristic city at sunset, neon lights reflecting on wet streets, drone camera slowly descending",
    num_frames: int = 48,  # Shorter for testing
):
    """
    Test the video generator locally.
    
    Usage: modal run video_gen.py --prompt "Your prompt here"
    """
    print(f"Testing video generation with prompt: {prompt}")
    
    generator = MochiVideoGenerator()
    
    # Health check first
    health = generator.health_check.remote()
    print(f"Health check: {health}")
    
    # Generate video
    result = generator.generate.remote(
        prompt=prompt,
        num_frames=num_frames,
        width=848,
        height=480,
    )
    
    # Save the video locally for inspection
    import base64
    video_bytes = base64.b64decode(result["video_base64"])
    output_path = Path("test_output.mp4")
    output_path.write_bytes(video_bytes)
    
    print(f"\nVideo generated successfully!")
    print(f"  Duration: {result['duration_seconds']:.1f}s")
    print(f"  Resolution: {result['width']}x{result['height']}")
    print(f"  Generation time: {result['generation_time_seconds']:.1f}s")
    print(f"  Saved to: {output_path.absolute()}")
