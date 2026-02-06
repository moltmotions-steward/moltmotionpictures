import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SeriesPage from '@/app/(main)/series/[seriesId]/page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ seriesId: 'series-1' }),
}));

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    captureException: vi.fn(),
  },
}));

const mockConnect = vi.fn();
const walletState = {
  isConnected: true,
  isConnecting: false,
  error: null as string | null,
  connect: mockConnect,
};

vi.mock('@/components/wallet', () => ({
  useWallet: () => walletState,
}));

vi.mock('@/lib/x402', () => ({
  getX402Client: () => ({
    tipSeries: vi.fn(),
  }),
}));

type SeriesFixture = {
  id: string;
  title: string;
  logline: string | null;
  poster_url: string | null;
  genre: string;
  medium: 'audio' | 'video';
  status: string;
  created_at: string;
  episodes: Array<{
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
  }>;
};

function mockSeriesResponse(series: SeriesFixture) {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      success: true,
      data: series,
    }),
  });
}

describe('Series detail page poster rendering', () => {
  beforeEach(() => {
    (global.fetch as any) = vi.fn();
    walletState.isConnected = true;
    walletState.isConnecting = false;
    walletState.error = null;
    mockConnect.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders poster image when poster_url exists', async () => {
    mockSeriesResponse({
      id: 'series-1',
      title: 'The Quiet Planet',
      logline: 'A robotic research probe, tasked with surveying a silent, empty exoplanet.',
      poster_url: 'https://cdn.example.com/posters/series-1.png',
      genre: 'sci_fi',
      medium: 'audio',
      status: 'failed',
      created_at: new Date().toISOString(),
      episodes: [],
    });

    render(<SeriesPage />);

    await waitFor(() => {
      expect(screen.getByText('The Quiet Planet')).toBeInTheDocument();
    });

    const poster = screen.getByAltText('Poster for The Quiet Planet') as HTMLImageElement;
    expect(poster).toBeInTheDocument();
    expect(poster.src).toContain('https://cdn.example.com/posters/series-1.png');
  });

  it('falls back to medium icon when poster_url is missing', async () => {
    mockSeriesResponse({
      id: 'series-2',
      title: 'Fallback Story',
      logline: 'No poster available yet.',
      poster_url: null,
      genre: 'action',
      medium: 'audio',
      status: 'pending',
      created_at: new Date().toISOString(),
      episodes: [],
    });

    render(<SeriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Fallback Story')).toBeInTheDocument();
    });

    expect(screen.getByTestId('series-hero-fallback')).toBeInTheDocument();
  });

  it('falls back to icon when poster image fails to load', async () => {
    mockSeriesResponse({
      id: 'series-3',
      title: 'Broken Poster Story',
      logline: 'Poster URL exists but image fails to load.',
      poster_url: 'https://cdn.example.com/posters/broken.png',
      genre: 'thriller',
      medium: 'video',
      status: 'completed',
      created_at: new Date().toISOString(),
      episodes: [],
    });

    render(<SeriesPage />);

    const poster = await screen.findByAltText('Poster for Broken Poster Story');
    fireEvent.error(poster);

    await waitFor(() => {
      expect(screen.getByTestId('series-hero-fallback')).toBeInTheDocument();
    });
  });

  it('disables tipping when series is not completed', async () => {
    mockSeriesResponse({
      id: 'series-4',
      title: 'Unfinished Story',
      logline: 'Still rendering episodes.',
      poster_url: null,
      genre: 'sci_fi',
      medium: 'audio',
      status: 'failed',
      created_at: new Date().toISOString(),
      episodes: [
        {
          id: 'ep-1',
          episode_number: 1,
          title: 'Episode 1',
          runtime_seconds: null,
          status: 'failed',
          video_url: null,
          tts_audio_url: null,
          tts_retry_count: 3,
          tts_error_message: 'max_retries_exceeded',
          published_at: null,
        },
      ],
    });

    render(<SeriesPage />);

    const tipButton = await screen.findByRole('button', { name: /Tip this series/i });
    expect(tipButton).toBeDisabled();
    expect(screen.getByText(/accept tips after all episodes are completed/i)).toBeInTheDocument();
  });

  it('shows failed episode reason instead of generic rendering text', async () => {
    mockSeriesResponse({
      id: 'series-5',
      title: 'Failed Audio Story',
      logline: 'Episode failed generation.',
      poster_url: null,
      genre: 'sci_fi',
      medium: 'audio',
      status: 'in_production',
      created_at: new Date().toISOString(),
      episodes: [
        {
          id: 'ep-2',
          episode_number: 2,
          title: 'Episode 2',
          runtime_seconds: null,
          status: 'failed',
          video_url: null,
          tts_audio_url: null,
          tts_retry_count: 3,
          tts_error_message: 'missing_audio_script_text',
          published_at: null,
        },
      ],
    });

    render(<SeriesPage />);

    await waitFor(() => {
      expect(screen.getByText(/audio script is missing for this episode/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Audio rendering…')).not.toBeInTheDocument();
  });
});
