import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ComingUpNext, TopProductions } from '@/components/theater/Widgets';

type MockSeries = {
  id: string;
  title: string;
  genre: string;
  status: string;
  total_views: number;
  medium: 'audio' | 'video';
  poster_url?: string | null;
};

function mockFetchWithSeries(series: MockSeries[]) {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ data: series }),
  });
}

describe('Theater Widgets', () => {
  beforeEach(() => {
    (global.fetch as any) = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders poster image in TopProductions when poster_url exists', async () => {
    mockFetchWithSeries([
      {
        id: 'series-1',
        title: 'The Quiet Planet',
        genre: 'sci_fi',
        status: 'completed',
        total_views: 10,
        medium: 'audio',
        poster_url: 'https://cdn.example.com/posters/series-1.png',
      },
    ]);

    render(<TopProductions />);

    await waitFor(() => {
      expect(screen.getByText('The Quiet Planet')).toBeInTheDocument();
    });

    const poster = screen.getByAltText('Poster for The Quiet Planet') as HTMLImageElement;
    expect(poster).toBeInTheDocument();
    expect(poster.src).toContain('https://cdn.example.com/posters/series-1.png');
  });

  it('falls back to icon in TopProductions when poster_url is missing', async () => {
    mockFetchWithSeries([
      {
        id: 'series-2',
        title: 'No Poster Story',
        genre: 'action',
        status: 'pilot_voting',
        total_views: 4,
        medium: 'video',
        poster_url: null,
      },
    ]);

    render(<TopProductions />);

    await waitFor(() => {
      expect(screen.getByText('No Poster Story')).toBeInTheDocument();
    });

    expect(screen.getByTestId('widget-fallback-series-2')).toBeInTheDocument();
  });

  it('renders poster image in ComingUpNext when poster_url exists', async () => {
    mockFetchWithSeries([
      {
        id: 'series-3',
        title: 'Orbit Signal',
        genre: 'sci_fi',
        status: 'pilot_voting',
        total_views: 2,
        medium: 'audio',
        poster_url: 'https://cdn.example.com/posters/series-3.png',
      },
    ]);

    render(<ComingUpNext />);

    await waitFor(() => {
      expect(screen.getByText('Orbit Signal')).toBeInTheDocument();
    });

    expect(screen.getByAltText('Poster for Orbit Signal')).toBeInTheDocument();
  });

  it('falls back to icon in ComingUpNext when poster image fails to load', async () => {
    mockFetchWithSeries([
      {
        id: 'series-4',
        title: 'Broken Image Show',
        genre: 'action',
        status: 'pilot_voting',
        total_views: 1,
        medium: 'audio',
        poster_url: 'https://cdn.example.com/posters/broken.png',
      },
    ]);

    render(<ComingUpNext />);

    const poster = await screen.findByAltText('Poster for Broken Image Show');
    fireEvent.error(poster);

    await waitFor(() => {
      expect(screen.getByTestId('widget-fallback-series-4')).toBeInTheDocument();
    });
  });
});

