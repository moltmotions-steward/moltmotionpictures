"""
Molt Studios - High Quality Video Generation (H100)

This service unifies previous video generation services into a single, high-performance
pipeline running on NVIDIA H100 hardware.

Model: HunyuanVideo (State-of-the-art Open Source)
Note: Replaces Mochi and LTX. "Kling" is API-only, so Hunyuan is the best local alternative.
"""

import modal
import os
import time
from pathlib import Path

# =============================================================================
# Configuration
# =============================================================================

app = modal.App("molt-video-gen-v2")

# Volume for caching large model weights
model_cache = modal.Volume.from_name("molt-hunyuan-cache", create_if_missing=True)

# Image definition with required dependencies
hunyuan_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "libsm6", "libxext6")
    .pip_install(
        "torch>=2.4.0",
        "diffusers>=0.32.1",  # Recent diffusers needed for Hunyuan
        "transformers>=4.44.0",
        "accelerate>=0.33.0",
        "sentencepiece>=0.2.0",
        "imageio[ffmpeg]>=2.34.0",
        "numpy<2.0",
        "safetensors>=0.4.0",
        "huggingface_hub>=0.25.0",
        "peft",
        "bitsandbytes",
    )
    .env({
        "HF_HOME": "/cache/huggingface",
        "TORCH_HOME": "/cache/torch",
    })
)

# =============================================================================
# Generator Class
# =============================================================================

@app.cls(
    image=hunyuan_image,
    gpu="H100",  # Requested Hardware
    timeout=1200,  # 20 minutes (large model)
    scaledown_window=120,
    volumes={"/cache": model_cache},
)
class VideoGeneratorV2:
    """
    Unified Video Generator using HunyuanVideo on H100.
    """
    
    @modal.enter()
    def load_model(self):
        import torch
        from diffusers import HunyuanVideoPipeline, HunyuanVideoTransformer3DModel
        from diffusers.utils import export_to_video
        
        print("Loading HunyuanVideo model (this may take time on first run)...")
        
        # Load the transformer model (quantized if needed for memory, but H100 has 80GB)
        # We load in bfloat16 for H100 native performance
        self.pipe = HunyuanVideoPipeline.from_pretrained(
            "tencent/HunyuanVideo",
            torch_dtype=torch.bfloat16,
            cache_dir="/cache/huggingface",
        )
        
        # Enable Model Offloading to fit comfortably if VRAM is tight with long contexts
        self.pipe.enable_model_cpu_offload()
        self.pipe.enable_vae_tiling()
        
        self.export_to_video = export_to_video
        print("HunyuanVideo loaded successfully.")

    @modal.method()
    def generate(
        self,
        prompt: str,
        negative_prompt: str = "low quality, distorted, warping, shaky, text, watermark",
        num_frames: int = 85,  # ~3.5s at 24fps
        fps: int = 24,
        width: int = 1280,     # HD
        height: int = 720,
        num_inference_steps: int = 30,
        guidance_scale: float = 6.0,
        seed: int | None = None,
    ) -> dict:
        import torch
        import base64
        
        print(f"Generating video: {prompt[:100]}...")
        
        # Seed handling
        if seed is None:
            seed = torch.randint(0, 2**32, (1,)).item()
        generator = torch.Generator(device="cpu").manual_seed(seed)
        
        # Run inference
        output = self.pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_frames=num_frames,
            height=height,
            width=width,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            generator=generator,
        ).frames[0]
        
        # Export
        video_path = "/tmp/output.mp4"
        self.export_to_video(output, video_path, fps=fps)
        
        # Read and encode
        with open(video_path, "rb") as f:
            video_bytes = f.read()
            
        return {
            "video_base64": base64.b64encode(video_bytes).decode("utf-8"),
            "duration_seconds": num_frames / fps,
            "width": width,
            "height": height,
            "fps": fps,
            "seed": seed,
            "model": "HunyuanVideo",
        }

# =============================================================================
# API Endpoint
# =============================================================================

@app.function(
    image=hunyuan_image,
    timeout=1200,
    scaledown_window=60,
)
@modal.fastapi_endpoint(method="POST", docs=True)
def generate_video(request: dict) -> dict:
    """
    Unified endpoint for video generation.
    """
    prompt = request.get("prompt")
    if not prompt:
        return {"error": "prompt is required"}
        
    generator = VideoGeneratorV2()
    
    return generator.generate.remote(
        prompt=prompt,
        negative_prompt=request.get("negative_prompt"),
        num_frames=request.get("num_frames", 85),
        fps=request.get("fps", 24),
        width=request.get("width", 1280),
        height=request.get("height", 720),
        seed=request.get("seed"),
    )

@app.function(image=hunyuan_image)
@modal.fastapi_endpoint(method="GET")
def health() -> dict:
    return {"status": "ok", "model": "HunyuanVideo", "hardware": "H100"}
