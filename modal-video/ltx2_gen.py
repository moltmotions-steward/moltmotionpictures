"""
Molt Studios - LTX-2 Video Generation (H100)

Model: Lightricks/LTX-2 (19B)
Capabilities: Native Audio-Video Generation, 4K, Synchronized Sound.
Hardware: NVIDIA H100 (80GB VRAM)

Uses native Hugging Face Diffusers pipeline for LTX-2.
"""

import modal
import time
import os
import sys
from pathlib import Path

# =============================================================================
# App Configuration
# =============================================================================

app = modal.App("molt-ltx2-gen")

# Volume for model weights
model_cache = modal.Volume.from_name("molt-ltx2-cache", create_if_missing=True)

# Image definition with native diffusers
ltx_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "libsndfile1")
    .pip_install("git+https://github.com/huggingface/diffusers.git") # Ensure latest
    .pip_install(
        "torch",
        "transformers",
        "accelerate",
        "safetensors",
        "sentencepiece",
        "einops",
        "opencv-python-headless",
        "imageio[ffmpeg]",
    )
    .env({
        "HF_HOME": "/cache/huggingface",
        "TORCH_HOME": "/cache/torch",
        "HF_TOKEN": "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",
    })
)

# =============================================================================
# LTX-2 Generator class
# =============================================================================

@app.cls(
    image=ltx_image,
    gpu="H100",  
    timeout=1800,
    scaledown_window=120,
    volumes={"/cache": model_cache},
)
class LTX2Generator:
    """
    LTX-2 Generator using native Hugging Face Diffusers pipeline.
    """
    
    @modal.enter()
    def load_model(self):
        import torch
        from diffusers import DiffusionPipeline
        
        print("Loading Lightricks/LTX-2 via Diffusers...")
        start = time.time()
        
        # Use DiffusionPipeline.from_pretrained with trust_remote_code
        # This should load the correct pipeline class for LTX-2
        self.pipe = DiffusionPipeline.from_pretrained(
            "Lightricks/LTX-2",
            torch_dtype=torch.bfloat16,
            trust_remote_code=True,
            cache_dir="/cache/huggingface",
        )
        self.pipe.to("cuda")
        
        print(f"Model loaded in {time.time() - start:.2f}s")
        print(f"Pipeline type: {type(self.pipe)}")

    @modal.method()
    def generate(
        self,
        prompt: str,
        audio_text: str | None = None,
        negative_prompt: str = "low quality, worst quality, deformed, distorted",
        num_frames: int = 121,
        fps: int = 24,
        width: int = 1280,  # Must be divisible by 32
        height: int = 704,  # Must be divisible by 32 (720 is not)
        num_inference_steps: int = 50,
        guidance_scale: float = 7.5,
        seed: int | None = None,
    ) -> dict:
        import torch
        import base64
        import tempfile
        from diffusers.utils import export_to_video
        
        start_time = time.time()
        print(f"Generating video for prompt: {prompt[:80]}...")
        
        generator = None
        if seed is not None:
            generator = torch.Generator(device="cuda").manual_seed(seed)
        else:
            seed = torch.randint(0, 2**32, (1,)).item()
            generator = torch.Generator(device="cuda").manual_seed(seed)

        # Inspect pipeline signature
        import inspect
        sig = inspect.signature(self.pipe.__call__)
        print(f"Pipeline __call__ signature: {sig}")
        
        # Build kwargs based on what the pipeline accepts
        kwargs = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "num_inference_steps": num_inference_steps,
            "guidance_scale": guidance_scale,
            "generator": generator,
        }
        
        # Add optional params if supported
        if "num_frames" in sig.parameters:
            kwargs["num_frames"] = num_frames
        if "height" in sig.parameters:
            kwargs["height"] = height
        if "width" in sig.parameters:
            kwargs["width"] = width
        if "frame_rate" in sig.parameters:
            kwargs["frame_rate"] = fps

        output = self.pipe(**kwargs)
        
        # Output handling
        if hasattr(output, 'frames'):
            video_frames = output.frames[0]
        else:
            print(f"Output type: {type(output)}")
            video_frames = output[0] if isinstance(output, (list, tuple)) else output

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            video_path = f.name
            
        export_to_video(video_frames, video_path, fps=fps)
        
        wall_time = time.time() - start_time
        print(f"Generation complete in {wall_time:.2f}s")
        
        with open(video_path, "rb") as f:
            video_bytes = f.read()
            
        return {
            "video_base64": base64.b64encode(video_bytes).decode("utf-8"),
            "duration": num_frames / fps,
            "wall_clock_time": wall_time,
            "width": width, 
            "height": height,
            "seed": seed,
            "model": "LTX-2"
        }

@app.local_entrypoint()
def main(
    prompt: str = "A cinematic shot of a robot painting a canvas",
    audio_text: str = None,
):
    print(f"Testing LTX-2 with H100...")
    gen = LTX2Generator()
    result = gen.generate.remote(prompt=prompt, audio_text=audio_text)
    
    output_path = Path("ltx2_output.mp4")
    import base64
    output_path.write_bytes(base64.b64decode(result["video_base64"]))
    
    print(f"\n--- Result ---")
    print(f"Saved to: {output_path.absolute()}")
    print(f"Wall Clock Time: {result['wall_clock_time']:.2f} seconds")
    print(f"Seed: {result['seed']}")
