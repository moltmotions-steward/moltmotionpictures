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

type TipAvailabilityReason = 'audio_only' | 'series_not_completed' | 'audio_not_published' | null;

type Episode = {
  id: string;
  episode_number: number;
  title: string | null;
  runtime_seconds: number | null;
  status: string;
  video_url: string | null;
  tts_audio_url: string | null;
  tts_retry_count: number;
  tts_error_message: string | null;
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
  tip?: {
    eligible: boolean;
    reason: TipAvailabilityReason;
    default_tip_cents: number;
    min_tip_cents: number;
  };
};

const TIP_PRESETS = [10, 25, 50, 100];
const MAX_AUDIO_RENDER_RETRIES = 3;

const TIP_REASON_COPY: Record<Exclude<TipAvailabilityReason, null>, string> = {
  audio_only: 'Tipping is currently available only for audio series.',
  series_not_completed: 'This series can accept tips after all episodes are completed.',
  audio_not_published: 'This series can accept tips after all audio episodes are published.',
};

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return 'Tip failed';
}

function formatTtsError(errorMessage: string | null): string {
  if (!errorMessage) return 'Audio rendering failed after multiple attempts.';
  if (errorMessage === 'missing_audio_script_text') return 'Audio script is missing for this episode.';
  if (errorMessage === 'max_retries_exceeded') return 'Audio rendering retry limit reached.';
  if (errorMessage.startsWith('duration_out_of_bounds:')) return 'Generated audio length failed quality checks.';
  return errorMessage.replace(/_/g, ' ');
}

export default function SeriesPage() {
  const params = useParams<{ seriesId: string }>();
  const seriesId = params.seriesId;

  const [series, setSeries] = useState<SeriesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tipError, setTipError] = useState<string | null>(null);
  const [waitingForWalletConnect, setWaitingForWalletConnect] = useState(false);

  const { isConnected, isConnecting, error: walletError, connect } = useWallet();
  const x402 = getX402Client();

  const [showTipOptions, setShowTipOptions] = useState(false);
  const [selectedTip, setSelectedTip] = useState(25);
  const [isTipping, setIsTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);
  const [hasPosterError, setHasPosterError] = useState(false);

  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL || '/api/v1', []);
  const hasSeriesAudio = useMemo(
    () => series?.episodes.length === 5 && series.episodes.every((ep) => !!ep.tts_audio_url),
    [series]
  );

  const tipAvailability = useMemo(() => {
    if (!series) {
      return { eligible: false, reason: null as TipAvailabilityReason, minTipCents: 10, defaultTipCents: 25 };
    }
    if (series.tip) {
      return {
        eligible: series.tip.eligible,
        reason: series.tip.reason,
        minTipCents: series.tip.min_tip_cents,
        defaultTipCents: series.tip.default_tip_cents,
      };
    }
    if (series.medium !== 'audio') {
      return { eligible: false, reason: 'audio_only' as TipAvailabilityReason, minTipCents: 10, defaultTipCents: 25 };
    }
    if (series.status !== 'completed') {
      return { eligible: false, reason: 'series_not_completed' as TipAvailabilityReason, minTipCents: 10, defaultTipCents: 25 };
    }
    if (!hasSeriesAudio) {
      return { eligible: false, reason: 'audio_not_published' as TipAvailabilityReason, minTipCents: 10, defaultTipCents: 25 };
    }
    return { eligible: true, reason: null as TipAvailabilityReason, minTipCents: 10, defaultTipCents: 25 };
  }, [hasSeriesAudio, series]);

  const tipPresets = useMemo(() => {
    const allowed = TIP_PRESETS.filter((amount) => amount >= tipAvailability.minTipCents);
    return allowed.length > 0 ? allowed : [tipAvailability.minTipCents];
  }, [tipAvailability.minTipCents]);

  const fetchSeries = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${apiUrl}/series/${seriesId}`);
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to load series');
      }
      setSeries(json.data as SeriesResponse);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load series');
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [apiUrl, seriesId]);

  useEffect(() => {
    void fetchSeries(true);
  }, [fetchSeries]);

  useEffect(() => {
    if (!tipPresets.includes(selectedTip)) {
      setSelectedTip(tipPresets[0]);
    }
  }, [selectedTip, tipPresets]);

  useEffect(() => {
    setHasPosterError(false);
  }, [series?.id, series?.poster_url]);

  useEffect(() => {
    if (!series) return;
    if (series.medium !== 'audio') return;

    const hasInFlightEpisodes = series.episodes.some(
      (ep) => !ep.tts_audio_url && ep.status !== 'failed'
    );
    if (!hasInFlightEpisodes) return;

    const intervalId = window.setInterval(() => {
      void fetchSeries(false);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [fetchSeries, series]);

  useEffect(() => {
    if (!tipAvailability.eligible) {
      setShowTipOptions(false);
    }
  }, [tipAvailability.eligible]);

  useEffect(() => {
    if (!waitingForWalletConnect) return;
    if (isConnected) {
      setShowTipOptions(true);
      setWaitingForWalletConnect(false);
      setTipError(null);
      return;
    }
    if (!isConnecting && walletError) {
      setTipError(walletError);
      setWaitingForWalletConnect(false);
    }
  }, [isConnected, isConnecting, waitingForWalletConnect, walletError]);

  const formatTip = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleTipStart = useCallback(async () => {
    if (!tipAvailability.eligible) {
      if (tipAvailability.reason) {
        setTipError(TIP_REASON_COPY[tipAvailability.reason]);
      }
      return;
    }

    if (isConnected) {
      setShowTipOptions(true);
      return;
    }

    setTipError(null);
    setWaitingForWalletConnect(true);
    await connect();
  }, [connect, isConnected, tipAvailability]);

  const handleTip = useCallback(async () => {
    if (!series) return;

    if (!isConnected) {
      setTipError('Connect a wallet before tipping.');
      return;
    }

    setIsTipping(true);
    setTipError(null);

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
      void fetchSeries(false);
    } catch (e) {
      const message = extractErrorMessage(e);
      setTipError(message);
      posthog.capture('series_tip_failed', { series_id: series.id, tip_amount_cents: selectedTip, error_message: message });
      posthog.captureException(e);
    } finally {
      setIsTipping(false);
    }
  }, [fetchSeries, isConnected, selectedTip, series, x402]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (loadError || !series) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <GlassPanel padding="lg">
          <p className="text-fg text-sm">Failed to load series.</p>
          <p className="text-fg-muted text-xs mt-2">{loadError}</p>
        </GlassPanel>
      </div>
    );
  }

  const canPlayAudio = series.medium === 'audio';
  const hasPoster = Boolean(series.poster_url) && !hasPosterError;
  const tipUnavailableMessage = tipAvailability.reason ? TIP_REASON_COPY[tipAvailability.reason] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <GlassPanel padding="lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="w-[120px] h-[68px] md:w-[144px] md:h-[81px] rounded-lg bg-bg-surface-muted shrink-0 overflow-hidden flex items-center justify-center">
              {hasPoster ? (
                <img
                  src={series.poster_url!}
                  alt={`Poster for ${series.title}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => setHasPosterError(true)}
                />
              ) : (
                <span data-testid="series-hero-fallback">
                  {series.medium === 'audio' ? (
                    <Headphones className="w-6 h-6 text-fg-subtle" />
                  ) : (
                    <Play className="w-6 h-6 text-fg-subtle" />
                  )}
                </span>
              )}
            </div>

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
          </div>

          {/* Series-level tip */}
          <div className="w-full md:w-[220px] md:shrink-0">
            {showTipOptions ? (
              <div className="space-y-2">
                <div className="flex gap-1">
                  {tipPresets.map((amount) => (
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
                {tipError ? <p className="text-xs text-destructive">{tipError}</p> : null}
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-green-500 text-green-500 hover:bg-green-500 hover:text-white disabled:border-border-muted disabled:text-fg-muted disabled:hover:bg-transparent"
                  onClick={handleTipStart}
                  disabled={!tipAvailability.eligible || isConnecting || waitingForWalletConnect}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  {isConnecting || waitingForWalletConnect ? 'Connecting wallet…' : 'Tip this series'}
                </Button>
                {tipUnavailableMessage ? <p className="text-xs text-fg-muted">{tipUnavailableMessage}</p> : null}
                {tipError ? <p className="text-xs text-destructive">{tipError}</p> : null}
              </div>
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
                ) : ep.status === 'failed' ? (
                  <div className="space-y-1">
                    <div className="text-xs text-destructive">
                      {formatTtsError(ep.tts_error_message)}
                    </div>
                    <div className="text-[11px] text-fg-muted">
                      Retry attempts: {Math.min(ep.tts_retry_count, MAX_AUDIO_RENDER_RETRIES)} / {MAX_AUDIO_RENDER_RETRIES}
                    </div>
                  </div>
                ) : ep.status === 'pending' && ep.tts_retry_count > 0 ? (
                  <div className="text-xs text-fg-muted">
                    Retry scheduled (attempt {Math.min(ep.tts_retry_count + 1, MAX_AUDIO_RENDER_RETRIES)} of {MAX_AUDIO_RENDER_RETRIES})…
                  </div>
                ) : ep.status === 'generating_tts' ? (
                  <div className="text-xs text-fg-muted">Audio rendering…</div>
                ) : (
                  <div className="text-xs text-fg-muted">Queued for audio rendering…</div>
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
