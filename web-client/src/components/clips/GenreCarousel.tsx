/**
 * GenreCarousel Component
 * 
 * Netflix-style horizontal scrolling row for a single genre.
 * Displays 4 clip variants with smooth scroll navigation.
 * 
 * Based on CSS Grid + scroll-behavior: smooth approach
 */

'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClipCard } from './ClipCard';
import type { GenreWithClips } from '@/types/clips';

interface GenreCarouselProps {
  genre: GenreWithClips;
  seriesTitle: string;
  onTipSuccess?: (clipId: string, newVoteCount: number) => void;
  className?: string;
}

export function GenreCarousel({ genre, seriesTitle, onTipSuccess, className }: GenreCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovering, setIsHovering] = useState(false);

  // Check scroll state
  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  // Initialize scroll state
  useEffect(() => {
    updateScrollState();
  }, [updateScrollState]);

  // Scroll handlers
  const scroll = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const cardWidth = 280 + 16; // card width + gap
    const scrollAmount = direction === 'left' ? -cardWidth * 2 : cardWidth * 2;

    container.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  }, []);

  // Find the leading clip
  const leadingClip = genre.clips.reduce((max, clip) => 
    clip.tipTotal > max.tipTotal ? clip : max
  , genre.clips[0]);

  return (
    <div 
      className={cn('relative group/carousel py-4', className)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Genre Header */}
      <div className="flex items-center justify-between mb-4 px-4 md:px-12">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white">
            {genre.name}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {genre.clips.length} variants • {leadingClip?.voteCount || 0} votes leading
          </p>
        </div>
        
        {/* Genre stats */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          <div className="text-gray-400">
            <span className="text-green-400 font-semibold">
              ${(genre.clips.reduce((sum, c) => sum + c.tipTotal, 0) / 100).toFixed(2)}
            </span>
            {' '}tipped
          </div>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 z-20',
            'w-12 h-full flex items-center justify-center',
            'bg-gradient-to-r from-black/80 to-transparent',
            'text-white hover:from-black transition-all',
            'opacity-0 group-hover/carousel:opacity-100',
            !canScrollLeft && 'hidden'
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-10 w-10" />
        </button>

        {/* Clips Row */}
        <div
          ref={scrollContainerRef}
          className={cn(
            'flex gap-4 overflow-x-auto scrollbar-hide',
            'px-4 md:px-12 py-4',
            'scroll-smooth snap-x snap-mandatory'
          )}
          onScroll={updateScrollState}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {genre.clips
            .sort((a, b) => a.variantNumber - b.variantNumber)
            .map((clip) => (
              <div key={clip.id} className="snap-start">
                <ClipCard
                  clip={clip}
                  genreName={genre.name}
                  seriesTitle={seriesTitle}
                  onTipSuccess={onTipSuccess}
                />
              </div>
            ))}
          
          {/* Spacer at end for last card hover expansion */}
          <div className="flex-shrink-0 w-12" aria-hidden="true" />
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className={cn(
            'absolute right-0 top-1/2 -translate-y-1/2 z-20',
            'w-12 h-full flex items-center justify-center',
            'bg-gradient-to-l from-black/80 to-transparent',
            'text-white hover:from-black transition-all',
            'opacity-0 group-hover/carousel:opacity-100',
            !canScrollRight && 'hidden'
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-10 w-10" />
        </button>
      </div>
    </div>
  );
}

export default GenreCarousel;
