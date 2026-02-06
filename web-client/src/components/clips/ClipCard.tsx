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

import { useRef, useCallback, useState } from 'react';
import { telemetryEvent } from '@/lib/telemetry';
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

  const { isConnected, connect, openFunding } = useWallet();
  const x402 = getX402Client();

  // Handle mouse enter - play video
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    if (videoRef.current && clip.videoUrl) {
      videoRef.current.currentTime = 0;
      // play() might not be available in jsdom/test environment
      videoRef.current.play?.()?.catch(() => {});

      // Track video preview play
      telemetryEvent('clip_video_played', {
        clip_id: clip.id,
        genre_name: genreName,
        series_title: seriesTitle,
        variant_number: clip.variantNumber,
      });
    }
  }, [clip.videoUrl, clip.id, clip.variantNumber, genreName, seriesTitle]);

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
  // Just-in-time auth: if not connected, ensurePaymentReady will trigger the auth modal.
  const handleTip = useCallback(async () => {
    setIsTipping(true);
    setError(null);

    // Track flow start
    telemetryEvent('checkout_flow_started', {
      clip_id: clip.id,
      genre_name: genreName,
      series_title: seriesTitle,
      variant_number: clip.variantNumber,
      amount_cents: selectedTip,
    });

    try {
      // 1. Ensure wallet is ready (triggers auth modal if needed)
      // This will throw 'auth_cancelled' if user closes the modal
      const result = await x402.tipClip(clip.id, getSessionId(), selectedTip);

      setTipSuccess(true);
      setShowTipOptions(false);
      onTipSuccess?.(clip.id, result.clipVariant.voteCount);

      // Track successful tip
      telemetryEvent('tip_submitted', {
        clip_id: clip.id,
        genre_name: genreName,
        series_title: seriesTitle,
        variant_number: clip.variantNumber,
        tip_amount_cents: selectedTip,
        new_vote_count: result.clipVariant.voteCount,
      });

      // Reset success state after animation
      setTimeout(() => setTipSuccess(false), 2000);
    } catch (err: any) {
      // Handle cancellations gracefully - keep panel open
      if (err.type === 'auth_cancelled') {
        // No error message needed for cancellation, just stop loading
        setIsTipping(false);
        return;
      }

      if (err.type === 'insufficient_funds') {
        setError('Insufficient balance on Base.');
      } else {
        const message = err.message || 'Tip failed';
        setError(message);
      }
      
      telemetryEvent('tip_failed', {
        clip_id: clip.id,
        genre_name: genreName,
        tip_amount_cents: selectedTip,
        error_message: err.message,
        error_type: err.type,
      });
      if (err.type !== 'auth_cancelled' && err.type !== 'insufficient_funds') {
        // posthog.captureException is not wrapped in telemetry.ts, so we keep it or rely on global error boundary
        // For now, let's just log it as a warning in telemetry wrapper if available, or just skip manual exception tracking 
        // as telemetryError handles safe logging.
      }
    } finally {
      setIsTipping(false);
    }
  }, [x402, clip.id, selectedTip, getSessionId, onTipSuccess, genreName, seriesTitle, clip.variantNumber]);

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
            onClick={() => setShowTipOptions(true)}
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Tip to Vote
          </Button>
        )}

        {/* Error message & Recovery */}
        {error && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-red-400 text-center">{error}</p>
            {error.includes('Insufficient balance') && (
              <Button
                size="sm"
                variant="outline" 
                className="w-full h-7 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={() => openFunding({ asset: 'USDC', network: 'base' })}
              >
                Add USDC on Base
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClipCard;
