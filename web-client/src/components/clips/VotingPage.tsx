/**
 * VotingPage Component
 * 
 * Netflix-style voting interface displaying:
 * - 10 genre rows (carousels)
 * - 4 clip variants per genre
 * - 40 clips total
 * 
 * Humans browse and tip-vote to select winners.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { GenreCarousel } from '@/components/clips/GenreCarousel';
import { WalletButton } from '@/components/wallet';
import { cn } from '@/lib/utils';
import { Clock, DollarSign, Trophy, Flame } from 'lucide-react';
import type { VotingPageData, GenreWithClips } from '@/types/clips';

interface VotingPageProps {
  initialData?: VotingPageData;
  seriesId: string;
}

// Countdown hook
function useCountdown(endTime: Date | string | null) {
  const [remaining, setRemaining] = useState('');
  
  useEffect(() => {
    if (!endTime) return;

    const target = new Date(endTime).getTime();
    
    const update = () => {
      const now = Date.now();
      const diff = target - now;
      
      if (diff <= 0) {
        setRemaining('Voting ended');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (days > 0) {
        setRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setRemaining(`${minutes}m ${seconds}s`);
      }
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime]);
  
  return remaining;
}

export function VotingPage({ initialData, seriesId }: VotingPageProps) {
  const [data, setData] = useState<VotingPageData | null>(initialData || null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  // Fetch voting data
  const fetchData = useCallback(async () => {
    setError(null); // Reset error before fetching
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/series/${seriesId}/voting`);
      if (!response.ok) {
        throw new Error('Failed to load voting data');
      }
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    if (!initialData) {
      fetchData();
    }
  }, [initialData, fetchData]);

  // Handle tip success - update local state
  const handleTipSuccess = useCallback((clipId: string, newVoteCount: number) => {
    setData((prev) => {
      if (!prev) return prev;
      
      return {
        ...prev,
        genres: prev.genres.map((genre) => ({
          ...genre,
          clips: genre.clips.map((clip) =>
            clip.id === clipId
              ? { ...clip, voteCount: newVoteCount }
              : clip
          )
        }))
      };
    });
  }, []);

  // Calculate totals
  const stats = useMemo(() => {
    if (!data) return { totalVotes: 0, totalTips: 0, clipCount: 0 };
    
    let totalVotes = 0;
    let totalTips = 0;
    let clipCount = 0;
    
    data.genres.forEach((genre) => {
      genre.clips.forEach((clip) => {
        totalVotes += clip.voteCount;
        totalTips += clip.tipTotal;
        clipCount++;
      });
    });
    
    return { totalVotes, totalTips, clipCount };
  }, [data]);

  // Countdown
  const countdown = useCountdown(data?.votingEndsAt || null);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading clips...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error || 'No data available'}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Header */}
      <header className="relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-900/20 via-black to-black" />
        
        <div className="relative max-w-7xl mx-auto px-4 py-8 md:py-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            {/* Title */}
            <div>
              <p className="text-green-400 text-sm font-medium mb-2">VOTE NOW</p>
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
                {data.seriesTitle}
              </h1>
              <p className="text-gray-400 max-w-xl">
                Tip your favorite clips to vote. Winners get produced. Your tips support creators.
              </p>
            </div>

            {/* Stats & Wallet */}
            <div className="flex flex-col items-end gap-4">
              <WalletButton />
              
              {/* Countdown */}
              <div className="flex items-center gap-2 text-white">
                <Clock className="h-5 w-5 text-yellow-400" />
                <span className="text-lg font-medium">{countdown || 'Loading...'}</span>
                <span className="text-gray-500 text-sm">remaining</span>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-8 flex flex-wrap gap-6 text-center">
            <Stat
              icon={<Flame className="h-5 w-5 text-orange-400" />}
              value={stats.clipCount}
              label="Clips"
            />
            <Stat
              icon={<Trophy className="h-5 w-5 text-yellow-400" />}
              value={stats.totalVotes}
              label="Votes"
            />
            <Stat
              icon={<DollarSign className="h-5 w-5 text-green-400" />}
              value={`$${(stats.totalTips / 100).toFixed(2)}`}
              label="Tipped"
            />
          </div>
        </div>
      </header>

      {/* Genre Carousels */}
      <main className="pb-16">
        {data.genres
          .sort((a, b) => {
            // Sort by total tips per genre (hottest first)
            const aTips = a.clips.reduce((sum, c) => sum + c.tipTotal, 0);
            const bTips = b.clips.reduce((sum, c) => sum + c.tipTotal, 0);
            return bTips - aTips;
          })
          .map((genre) => (
            <GenreCarousel
              key={genre.id}
              genre={genre}
              seriesTitle={data.seriesTitle}
              onTipSuccess={handleTipSuccess}
            />
          ))}
      </main>

      {/* Floating Wallet Connect CTA (mobile) */}
      <div className="fixed bottom-4 left-4 right-4 md:hidden z-50">
        <WalletButton className="w-full justify-center" />
      </div>
    </div>
  );
}

// Stat component
function Stat({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
      {icon}
      <span className="text-white font-bold">{value}</span>
      <span className="text-gray-500 text-sm">{label}</span>
    </div>
  );
}

export default VotingPage;
