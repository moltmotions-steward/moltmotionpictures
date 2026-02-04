'use client';

import { useState, useEffect } from 'react';

/**
 * Design QA Overlay
 * 
 * Shows column guides at reference canvas positions:
 * - x=295 (sidebar boundary)
 * - x=1608 (main/rail boundary)
 * 
 * Enable with Ctrl+Shift+G or by setting NEXT_PUBLIC_DESIGN_QA=true
 */
export function DesignQAOverlay() {
  const [show, setShow] = useState(false);
  const [viewportInfo, setViewportInfo] = useState({ w: 0, h: 0, scale: 1 });
  
  useEffect(() => {
    // Check env var
    if (process.env.NEXT_PUBLIC_DESIGN_QA === 'true') {
      setShow(true);
    }
    
    // Keyboard shortcut: Ctrl+Shift+G
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        setShow(prev => !prev);
      }
    };
    
    // Update viewport info
    const updateViewport = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sx = w / 2048;
      const sy = h / 1365;
      const scale = Math.min(sx, sy);
      setViewportInfo({ w, h, scale });
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateViewport);
    updateViewport();
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateViewport);
    };
  }, []);
  
  if (!show) return null;
  
  const { w, h, scale } = viewportInfo;
  
  // Calculate scaled positions
  const sidebarX = Math.round(295 * scale);
  const railX = Math.round(1608 * scale);
  const heroHeight = Math.round(520 * scale);
  const heroTop = Math.round(110 * scale);
  
  return (
    <>
      {/* Overlay container */}
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        {/* Column guides */}
        <div 
          className="absolute top-0 bottom-0 w-px bg-cyan-500/50"
          style={{ left: sidebarX }}
        />
        <div 
          className="absolute top-0 bottom-0 w-px bg-cyan-500/50"
          style={{ left: railX }}
        />
        
        {/* Hero region */}
        <div 
          className="absolute border border-dashed border-magenta-500/30"
          style={{ 
            left: sidebarX, 
            top: heroTop, 
            width: railX - sidebarX + Math.round(440 * scale), 
            height: heroHeight 
          }}
        />
        
        {/* Info panel */}
        <div className="absolute bottom-4 right-4 bg-black/80 text-white text-xs font-mono p-3 rounded-lg pointer-events-auto">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500" />
            <span>Design QA Mode</span>
            <button 
              onClick={() => setShow(false)}
              className="ml-2 text-white/60 hover:text-white"
            >
              ×
            </button>
          </div>
          <div className="space-y-1 text-white/70">
            <p>Viewport: {w}×{h}</p>
            <p>Scale: {(scale * 100).toFixed(1)}%</p>
            <p>Reference: 2048×1365</p>
            <p className="text-white/40 text-[10px] mt-2">Ctrl+Shift+G to toggle</p>
          </div>
        </div>
      </div>
    </>
  );
}
