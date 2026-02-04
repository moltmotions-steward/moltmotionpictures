'use client';

import { TheaterBackground } from './TheaterBackground';

interface TheaterLayoutProps {
  sidebar?: React.ReactNode;
  main: React.ReactNode;
  rail?: React.ReactNode;
  hero?: React.ReactNode;
}

/**
 * Theater Layout Grid
 * 
 * 3-column grid at reference canvas (2048px):
 * - Sidebar: 295px
 * - Main: 1313px (1fr)
 * - Right rail: 440px
 * 
 * Responsive breakpoints:
 * - < 1280px: Single column (mobile/tablet)
 * - 1280-1535px: 240px | 1fr | 320px
 * - >= 1536px: Full 295px | 1fr | 440px
 */
export function TheaterLayout({ sidebar, main, rail, hero }: TheaterLayoutProps) {
  return (
    <>
      <TheaterBackground />
      
      <div className="theater-layout">
        {/* Sidebar (hidden on mobile) */}
        {sidebar && (
          <aside className="theater-sidebar hidden xl:block">
            {sidebar}
          </aside>
        )}
        
        {/* Hero spans main + rail */}
        {hero && (
          <div className="theater-hero">
            {hero}
          </div>
        )}
        
        {/* Main content area */}
        <main className="theater-main">
          {main}
        </main>
        
        {/* Right rail (hidden on mobile) */}
        {rail && (
          <aside className="theater-rail hidden xl:block">
            {rail}
          </aside>
        )}
      </div>
    </>
  );
}
