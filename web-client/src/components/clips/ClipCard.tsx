/**
 * ClipCard Component
 * 
 * Displays a clip variant with:
 * - Video thumbnail (auto-play on hover)
 * - Tip button with amount selector
 * - Vote count and tip total
 * - Winner badge if selected
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useWallet } from '@/components/wallet';
import { getX402Client } from '@/lib/x402';
import { Button } from '@/components/ui';
import { DollarSign, Play, Trophy, Loader2, Check } from 'lucide-react';
import type { ClipVariant } from '@/types/clips';

interface ClipCardProps {
  clip: ClipVariant;
  genreName: string;
  seriesTitle: string;
  onTipSuccess?: (clipId: string, newVoteCount: number) => void;
  className?: string;
}

const TIP_PRESETS = [10, 25, 50, 100]; // cents

export function ClipCard({ clip, genreName, seriesTitle, onTipSuccess, className }: ClipCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [showTipOptions, setShowTipOptions] = useState(false);
  const [selectedTip, setSelectedTip] = useState(25);
  const [isTipping, setIsTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isConnected, connect } = useWallet();
  const x402 = getX402Client();

  // Handle mouse enter - play video
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    if (videoRef.current && clip.videoUrl) {
      videoRef.current.currentTime = 0;
      // play() might not be available in jsdom/test environment
      videoRef.current.play?.()?.catch(() => {});
    }
  }, [clip.videoUrl]);

  // Handle mouse leave - pause video
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause?.();
    }
  }, []);

  // Get session ID for voting
  const getSessionId = useCallback((): string => {
    if (typeof window === 'undefined') return 'server';
    let sessionId = sessionStorage.getItem('molt_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('molt_session_id', sessionId);
    }
    return sessionId;
  }, []);

  // Handle tip action
  const handleTip = useCallback(async () => {
    if (!isConnected) {
      await connect();
      return;
    }

    setIsTipping(true);
    setError(null);

    try {
      const result = await x402.tipClip(clip.id, getSessionId(), selectedTip);
      
      setTipSuccess(true);
      setShowTipOptions(false);
      onTipSuccess?.(clip.id, result.clipVariant.voteCount);

      // Reset success state after animation
      setTimeout(() => setTipSuccess(false), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tip failed';
      setError(message);
    } finally {
      setIsTipping(false);
    }
  }, [isConnected, connect, x402, clip.id, selectedTip, getSessionId, onTipSuccess]);

  // Format tip amount
  const formatTip = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div
      className={cn(
        'group relative flex-shrink-0 w-[280px] cursor-pointer',
        'transition-transform duration-300 ease-out',
        isHovering && 'scale-110 z-10',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video / Thumbnail */}
      <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
        {clip.videoUrl ? (
          <video
            ref={videoRef}
            src={clip.videoUrl}
            poster={clip.thumbnailUrl}
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Play className="h-12 w-12 text-muted-foreground" />
          </div>
        )}

        {/* Play indicator on hover */}
        {isHovering && clip.videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="bg-white/90 rounded-full p-3">
              <Play className="h-6 w-6 text-black fill-current" />
            </div>
          </div>
        )}

        {/* Winner badge */}
        {clip.isSelected && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">
            <Trophy className="h-3 w-3" />
            WINNER
          </div>
        )}

        {/* Variant number badge */}
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          V{clip.variantNumber}
        </div>
      </div>

      {/* Info overlay on hover */}
      <div
        className={cn(
          'absolute left-0 right-0 -bottom-2 p-3 rounded-b-lg',
          'bg-gradient-to-t from-black via-black/90 to-transparent',
          'transform transition-all duration-300',
          isHovering ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        )}
      >
        {/* Title & Stats */}
        <div className="mb-2">
          <p className="text-white text-sm font-medium truncate">{seriesTitle}</p>
          <p className="text-gray-400 text-xs">{genreName}</p>
        </div>

        {/* Vote count & Tips */}
        <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
          <span>{clip.voteCount} votes</span>
          <span className="text-green-400">{formatTip(clip.tipTotal)} tipped</span>
        </div>

        {/* Tip UI */}
        {showTipOptions ? (
          <div className="space-y-2">
            {/* Preset amounts */}
            <div className="flex gap-1">
              {TIP_PRESETS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setSelectedTip(amount)}
                  className={cn(
                    'flex-1 py-1 text-xs rounded transition-colors',
                    selectedTip === amount
                      ? 'bg-green-500 text-white'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  )}
                >
                  {formatTip(amount)}
                </button>
              ))}
            </div>

            {/* Confirm button */}
            <Button
              size="sm"
              className="w-full bg-green-500 hover:bg-green-600 text-white"
              onClick={handleTip}
              disabled={isTipping}
            >
              {isTipping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tipSuccess ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Tipped!
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-1" />
                  Tip {formatTip(selectedTip)}
                </>
              )}
            </Button>

            {/* Cancel */}
            <button
              onClick={() => setShowTipOptions(false)}
              className="w-full text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-green-500 text-green-400 hover:bg-green-500 hover:text-white"
            onClick={() => isConnected ? setShowTipOptions(true) : connect()}
          >
            <DollarSign className="h-4 w-4 mr-1" />
            {isConnected ? 'Tip to Vote' : 'Connect to Vote'}
          </Button>
        )}

        {/* Error message */}
        {error && (
          <p className="mt-2 text-xs text-red-400 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}

export default ClipCard;
