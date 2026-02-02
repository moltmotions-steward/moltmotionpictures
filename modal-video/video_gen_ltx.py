"""
Molt Studios - LTX-Video (Lighter/Faster Alternative)

This is a lighter-weight alternative using LTX-Video model.
Faster cold starts and cheaper GPU (A10G instead of A100).

Good for iteration and testing; Mochi is better for final quality.
"""

import modal

app = modal.App("molt-video-gen-ltx")

# Lighter image for LTX-Video
ltx_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .pip_install(
        "torch>=2.1.0",
        "diffusers>=0.32.0",
        "transformers>=4.44.0",
        "accelerate>=0.33.0",
        "sentencepiece>=0.2.0",
        "imageio[ffmpeg]>=2.34.0",
        "numpy<2.0",
        "safetensors>=0.4.0",
        "huggingface_hub>=0.25.0",
    )
    .env({
        "HF_HOME": "/cache/huggingface",
    })
)

model_cache = modal.Volume.from_name("molt-ltx-cache", create_if_missing=True)


@app.cls(
    image=ltx_image,
    gpu="A10G",  # Cheaper GPU, sufficient for LTX
    timeout=300,  # 5 minute timeout
    container_idle_timeout=60,  # Spin down after 60s idle
    volumes={"/cache": model_cache},
)
class LTXVideoGenerator:
    """LTX-Video generator - faster and cheaper than Mochi."""
    
    @modal.enter()
    def load_model(self):
        import torch
        from diffusers import LTXPipeline
        from diffusers.utils import export_to_video
        
        print("Loading LTX-Video model...")
        
        self.pipe = LTXPipeline.from_pretrained(
            "Lightricks/LTX-Video",
            torch_dtype=torch.bfloat16,
            cache_dir="/cache/huggingface",
        )
        self.pipe.to("cuda")
        
        self.export_to_video = export_to_video
        print("LTX-Video model loaded!")
    
    @modal.method()
    def generate(
        self,
        prompt: str,
        negative_prompt: str = "worst quality, inconsistent motion, blurry",
        num_frames: int = 121,  # 5 seconds at 24fps
        fps: int = 24,
        width: int = 704,
        height: int = 480,
        num_inference_steps: int = 40,
        guidance_scale: float = 3.0,
        seed: int | None = None,
    ) -> dict:
        """Generate video from text prompt."""
        import torch
        import base64
        import time
        
        start_time = time.time()
        
        generator = None
        if seed is not None:
            generator = torch.Generator(device="cuda").manual_seed(seed)
        else:
            seed = torch.randint(0, 2**32, (1,)).item()
            generator = torch.Generator(device="cuda").manual_seed(seed)
        
        print(f"Generating: {prompt[:80]}...")
        
        video = self.pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_frames=num_frames,
            width=width,
            height=height,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            generator=generator,
        ).frames[0]
        
        video_path = "/tmp/output.mp4"
        self.export_to_video(video, video_path, fps=fps)
        
        with open(video_path, "rb") as f:
            video_bytes = f.read()
        
        video_base64 = base64.b64encode(video_bytes).decode("utf-8")
        generation_time = time.time() - start_time
        
        print(f"Done in {generation_time:.1f}s")
        
        return {
            "video_base64": video_base64,
            "duration_seconds": num_frames / fps,
            "width": width,
            "height": height,
            "fps": fps,
            "seed": seed,
            "generation_time_seconds": generation_time,
            "prompt": prompt,
            "model": "ltx-video",
        }
    
    @modal.method()
    def health_check(self) -> dict:
        import torch
        return {
            "status": "healthy",
            "model": "ltx-video",
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none",
        }


@app.function(image=ltx_image, timeout=300, container_idle_timeout=30)
@modal.web_endpoint(method="POST", docs=True)
def generate_video(request: dict) -> dict:
    """HTTP endpoint for LTX video generation."""
    prompt = request.get("prompt")
    if not prompt:
        return {"error": "prompt is required"}
    
    generator = LTXVideoGenerator()
    
    return generator.generate.remote(
        prompt=prompt,
        negative_prompt=request.get("negative_prompt", "worst quality, blurry"),
        num_frames=request.get("num_frames", 121),
        fps=request.get("fps", 24),
        width=request.get("width", 704),
        height=request.get("height", 480),
        num_inference_steps=request.get("num_inference_steps", 40),
        guidance_scale=request.get("guidance_scale", 3.0),
        seed=request.get("seed"),
    )


@app.function(image=ltx_image, timeout=10, container_idle_timeout=10)
@modal.web_endpoint(method="GET", docs=True)
def health() -> dict:
    return {"status": "ok", "service": "molt-video-gen-ltx", "model": "ltx-video"}


@app.local_entrypoint()
def main(prompt: str = "A drone shot flying over mountains at golden hour"):
    print(f"Testing LTX-Video: {prompt}")
    
    generator = LTXVideoGenerator()
    result = generator.generate.remote(prompt=prompt, num_frames=49)
    
    import base64
    from pathlib import Path
    
    video_bytes = base64.b64decode(result["video_base64"])
    Path("test_ltx_output.mp4").write_bytes(video_bytes)
    
    print(f"Generated in {result['generation_time_seconds']:.1f}s")
    print(f"Saved to test_ltx_output.mp4")
