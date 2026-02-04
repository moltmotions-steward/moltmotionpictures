'use client';

import { useState, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';
import { telemetryError } from '@/lib/telemetry';
import { Play, Eye } from 'lucide-react';

interface WidgetCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Widget Card for Right Rail
 * 
 * Layout contract (at 2048×1365):
 * - Frame: w=380
 * - Internal padding: 20px
 */
export function WidgetCard({ title, children, className }: WidgetCardProps) {
  return (
    <div className={cn('widget-card', className)}>
      <h3 className="widget-header">{title}</h3>
      {children}
    </div>
  );
}

interface SeriesItem {
  id: string;
  title: string;
  genre: string;
  status: string;
  total_views: number;
}

/**
 * Coming Up Next Widget
 * 
 * Fetches series in voting status from the API.
 * Shows series currently in pilot_voting phase.
 *
 * Optimization: Memoized to prevent re-renders when parent HomePage updates.
 */
export const ComingUpNext = memo(function ComingUpNext() {
  const [items, setItems] = useState<SeriesItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVotingPeriods = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
        const response = await fetch(`${apiUrl}/series?status=pilot_voting&limit=3`);
        if (response.ok) {
          const data = await response.json();
          setItems(data.data || []);
        }
      } catch (error) {
        telemetryError('Failed to fetch voting periods', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVotingPeriods();
  }, []);

  const formatGenre = (genre: string) => {
    if (!genre) return '';
    return genre.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <WidgetCard title="Coming up next">
        <div className="py-8 text-center text-fg-muted text-sm">Loading...</div>
      </WidgetCard>
    );
  }

  if (items.length === 0) {
    return (
      <WidgetCard title="Coming up next">
        <div className="py-8 text-center text-fg-muted text-sm">No active voting</div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Coming up next">
      <div className="space-y-0">
        {items.map((item, index) => (
          <a 
            key={item.id}
            href={`/vote/${item.id}`}
            className={cn(
              'widget-row',
              index > 0 && 'border-t border-border-muted'
            )}
          >
            {/* Thumbnail */}
            <div className="widget-thumbnail flex items-center justify-center">
              <Play className="w-6 h-6 text-fg-subtle" />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-fg truncate">
                {item.title}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-fg-muted">
                <span>{formatGenre(item.genre)}</span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {(item.total_views || 0).toLocaleString()} views
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </WidgetCard>
  );
});

/**
 * Top Productions Widget
 * 
 * Fetches popular series from the API.
 * Shows winning scripts that became produced Limited Series.
 *
 * Optimization: Memoized to prevent re-renders when parent HomePage updates.
 */
export const TopProductions = memo(function TopProductions() {
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
        const response = await fetch(`${apiUrl}/series?sort=popular&limit=5`);
        if (response.ok) {
          const data = await response.json();
          setSeries(data.data || []);
        }
      } catch (error) {
        telemetryError('Failed to fetch series', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSeries();
  }, []);

  const formatGenre = (genre: string) => {
    if (!genre) return '';
    return genre.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <WidgetCard title="Top productions">
        <div className="py-8 text-center text-fg-muted text-sm">Loading...</div>
      </WidgetCard>
    );
  }

  if (series.length === 0) {
    return (
      <WidgetCard title="Top productions">
        <div className="py-8 text-center text-fg-muted text-sm">No productions yet</div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Top productions">
      <div className="space-y-0">
        {series.map((item, index) => (
          <a 
            key={item.id}
            href={`/m/${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            className={cn(
              'widget-row',
              index > 0 && 'border-t border-border-muted'
            )}
          >
            {/* Thumbnail */}
            <div className="widget-thumbnail flex items-center justify-center">
              <Play className="w-6 h-6 text-fg-subtle" />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-fg truncate">
                {item.title}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-fg-muted">
                <span>{formatGenre(item.genre)}</span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {(item.total_views || 0).toLocaleString()} views
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </WidgetCard>
  );
});
