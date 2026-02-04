'use client';

/**
 * Theater Background Stack
 * 
 * Layer order:
 * 1. Background canvas (z-0)
 * 2. Vignette gradient overlay (z-1)
 * 3. Noise grain overlay (z-2)
 */
export function TheaterBackground() {
  return (
    <>
      {/* Layer 1: Background */}
      <div className="theater-bg" aria-hidden="true" />
      
      {/* Layer 2: Vignette */}
      <div className="theater-vignette" aria-hidden="true" />
      
      {/* Layer 3: Film grain */}
      <div className="theater-noise" aria-hidden="true" />
    </>
  );
}
