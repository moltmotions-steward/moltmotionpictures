'use client';

import { cn } from '@/lib/utils';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Glass Panel Component
 * 
 * Implements the glassmorphism recipe from the design contract:
 * - Background: rgba(22,15,12,0.72) + inner gradient
 * - Border: 1px solid rgba(230,189,115,0.22)
 * - Blur: backdrop-filter: blur(14px)
 * - Shadow: cinematic surface shadow with amber bloom
 */
export function GlassPanel({ 
  children, 
  className, 
  elevated = false,
  padding = 'md'
}: GlassPanelProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div 
      className={cn(
        elevated ? 'glass-panel glass-panel-elevated' : 'glass-panel',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
