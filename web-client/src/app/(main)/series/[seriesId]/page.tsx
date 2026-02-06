'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import posthog from 'posthog-js';
import { GlassPanel } from '@/components/theater';
import { Button, Spinner } from '@/components/ui';
import { useWallet } from '@/components/wallet';
import { getX402Client } from '@/lib/x402';
import { cn } from '@/lib/utils';
import { DollarSign, Headphones, Loader2, Play, Check } from 'lucide-react';

type Episode = {
  id: string;
  episode_number: number;
  title: string | null;
  runtime_seconds: number | null;
  status: string;
  video_url: string | null;
  tts_audio_url: string | null;
  published_at: string | null;
};

type SeriesResponse = {
  id: string;
  title: string;
  logline: string | null;
  poster_url: string | null;
  genre: string;
  medium: 'audio' | 'video';
  status: string;
  created_at: string;
  episodes: Episode[];
};

const TIP_PRESETS = [10, 25, 50, 100];

export default function SeriesPage() {
  const params = useParams<{ seriesId: string }>();
  const seriesId = params.seriesId;

  const [series, setSeries] = useState<SeriesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isConnected, connect } = useWallet();
  const x402 = getX402Client();

  const [showTipOptions, setShowTipOptions] = useState(false);
  const [selectedTip, setSelectedTip] = useState(25);
  const [isTipping, setIsTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL || '/api/v1', []);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiUrl}/series/${seriesId}`);
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load series');
        }
        setSeries(json.data as SeriesResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load series');
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [apiUrl, seriesId]);

  const formatTip = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleTip = useCallback(async () => {
    if (!series) return;

    if (!isConnected) {
      await connect();
      return;
    }

    setIsTipping(true);
    setError(null);

    try {
      await x402.tipSeries(series.id, selectedTip);
      setTipSuccess(true);
      setShowTipOptions(false);

      posthog.capture('series_tip_submitted', {
        series_id: series.id,
        series_title: series.title,
        medium: series.medium,
        tip_amount_cents: selectedTip,
      });

      setTimeout(() => setTipSuccess(false), 2000);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Tip failed';
      setError(message);
      posthog.capture('series_tip_failed', { series_id: series.id, tip_amount_cents: selectedTip, error_message: message });
      posthog.captureException(e);
    } finally {
      setIsTipping(false);
    }
  }, [series, isConnected, connect, x402, selectedTip]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <GlassPanel padding="lg">
          <p className="text-fg text-sm">Failed to load series.</p>
          <p className="text-fg-muted text-xs mt-2">{error}</p>
        </GlassPanel>
      </div>
    );
  }

  const canPlayAudio = series.medium === 'audio';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <GlassPanel padding="lg">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-fg-muted text-xs mb-2">
              {series.medium === 'audio' ? <Headphones className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span className="uppercase tracking-wide">{series.medium}</span>
              <span>·</span>
              <span className="uppercase tracking-wide">{series.genre?.replace('_', ' ')}</span>
              <span>·</span>
              <span className="uppercase tracking-wide">{series.status}</span>
            </div>
            <h1 className="text-xl font-semibold text-fg truncate">{series.title}</h1>
            {series.logline && <p className="text-fg-muted text-sm mt-2">{series.logline}</p>}
          </div>

          {/* Series-level tip */}
          <div className="shrink-0 w-[220px]">
            {showTipOptions ? (
              <div className="space-y-2">
                <div className="flex gap-1">
                  {TIP_PRESETS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setSelectedTip(amount)}
                      className={cn(
                        'flex-1 py-1 text-xs rounded transition-colors',
                        selectedTip === amount ? 'bg-green-500 text-white' : 'bg-white/10 text-fg hover:bg-white/20'
                      )}
                    >
                      {formatTip(amount)}
                    </button>
                  ))}
                </div>
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
                <button
                  onClick={() => setShowTipOptions(false)}
                  className="w-full text-xs text-fg-muted hover:text-fg"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                onClick={() => (isConnected ? setShowTipOptions(true) : connect())}
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Tip this series
              </Button>
            )}
          </div>
        </div>
      </GlassPanel>

      <GlassPanel padding="lg">
        <h2 className="text-sm font-semibold text-fg mb-4">Episodes</h2>
        <div className="space-y-4">
          {series.episodes.map((ep) => (
            <div key={ep.id} className="rounded-lg border border-border-muted p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-xs text-fg-muted">
                    Episode {ep.episode_number} · {ep.status}
                  </p>
                  <p className="text-sm font-medium text-fg truncate">{ep.title || `Episode ${ep.episode_number}`}</p>
                </div>
                <div className="text-xs text-fg-muted">
                  {ep.runtime_seconds ? `${Math.round(ep.runtime_seconds / 60)} min` : ''}
                </div>
              </div>

              {canPlayAudio ? (
                ep.tts_audio_url ? (
                  <audio controls preload="none" className="w-full">
                    <source src={ep.tts_audio_url} />
                  </audio>
                ) : (
                  <div className="text-xs text-fg-muted">Audio rendering…</div>
                )
              ) : ep.video_url ? (
                <video controls preload="none" className="w-full rounded" src={ep.video_url} />
              ) : (
                <div className="text-xs text-fg-muted">Not yet published.</div>
              )}
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

