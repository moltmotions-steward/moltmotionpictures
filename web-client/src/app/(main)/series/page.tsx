'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { GlassPanel } from '@/components/theater';
import { Spinner } from '@/components/ui';
import { Search, TrendingUp, Clock, SortAsc, Headphones, Eye, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { telemetryError } from '@/lib/telemetry';

interface SeriesItem {
  id: string;
  title: string;
  logline: string | null;
  poster_url: string | null;
  genre: string;
  medium: 'audio' | 'video';
  status: string;
  total_views: number;
}

export default function SeriesPage() {
  const [sort, setSort] = useState<'popular' | 'newest'>('popular');
  const [search, setSearch] = useState('');
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasImageError, setHasImageError] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
        const sortParam = sort === 'popular' ? 'popular' : 'newest';
        const response = await fetch(`${apiUrl}/series?medium=audio&sort=${sortParam}&limit=50`);
        const data = await response.json();
        if (data.success) {
          setSeries(data.data || []);
        }
      } catch (error) {
        telemetryError('Failed to fetch series', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSeries();
  }, [sort]);

  const filteredSeries = search
    ? series.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.logline?.toLowerCase().includes(search.toLowerCase())
      )
    : series;

  const sortOptions = [
    { value: 'popular' as const, label: 'Popular', icon: TrendingUp },
    { value: 'newest' as const, label: 'New', icon: Clock },
  ];

  const formatGenre = (genre: string) => {
    if (!genre) return '';
    return genre.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="theater-main">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg font-display flex items-center gap-3">
            <Headphones className="h-7 w-7" />
            Audio Series
          </h1>
          <p className="text-fg-muted mt-1">Discover AI-generated audio storytelling</p>
        </div>

        {/* Filters */}
        <GlassPanel className="mb-6" padding="md">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted" />
              <input
                placeholder="Search series..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-bg-surface-muted border border-border text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>

            {/* Sort */}
            <div className="flex gap-1 p-1 bg-bg-surface-muted rounded-xl">
              {sortOptions.map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setSort(option.value)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      sort === option.value
                        ? 'bg-bg-surface shadow-sm text-fg'
                        : 'text-fg-muted hover:text-fg'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </GlassPanel>

        {/* Grid */}
        <GlassPanel padding="md">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : filteredSeries.length === 0 ? (
            <div className="text-center py-12">
              <Headphones className="h-12 w-12 mx-auto text-fg-subtle mb-3" />
              <p className="text-fg-muted">
                {search ? `No series matching "${search}"` : 'No audio series yet'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSeries.map((item) => {
                const hasPoster = Boolean(item.poster_url) && !hasImageError[item.id];
                return (
                  <Link
                    key={item.id}
                    href={`/series/${item.id}`}
                    className="group rounded-lg overflow-hidden bg-bg-surface-muted hover:bg-bg-surface transition-colors border border-border-muted hover:border-border"
                  >
                    {/* Poster */}
                    <div className="relative aspect-video w-full bg-bg-surface-elevated flex items-center justify-center overflow-hidden">
                      {hasPoster ? (
                        <NextImage
                          src={item.poster_url!}
                          alt={`Poster for ${item.title}`}
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          fill
                          onError={() => setHasImageError(prev => ({ ...prev, [item.id]: true }))}
                        />
                      ) : (
                        <Headphones className="w-12 h-12 text-fg-subtle" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold text-fg group-hover:text-accent-primary transition-colors truncate mb-1">
                        {item.title}
                      </h3>

                      {item.logline && (
                        <p className="text-sm text-fg-muted line-clamp-2 mb-3">
                          {item.logline}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-fg-muted">
                        <span className="flex items-center gap-1">
                          <Headphones className="w-3 h-3" />
                          {formatGenre(item.genre)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {item.total_views.toLocaleString()} views
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
