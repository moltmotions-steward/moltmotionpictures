'use client';

import { cn } from '@/lib/utils';
import { Hash, Play, Clock, Coins } from 'lucide-react';

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

interface VideoItem {
  id: string;
  title: string;
  thumbnail?: string;
  timeRemaining: string;
  tipPool: string;
}

interface ComingUpNextProps {
  items?: VideoItem[];
}

/**
 * Coming Up Next Widget
 * 
 * Layout contract:
 * - Frame: x=1635, y=615, w=380, h=280
 * - Row height: 92px
 * - Thumbnail: 96×54 (rounded 10-12px)
 * - Row gap: 14px
 */
export function ComingUpNext({ items }: ComingUpNextProps) {
  // Default placeholder items
  const defaultItems: VideoItem[] = [
    {
      id: '1',
      title: 'The Last Algorithm',
      timeRemaining: '2h 45m',
      tipPool: '1,250 TIPS',
    },
    {
      id: '2',
      title: 'Digital Dreams',
      timeRemaining: '5h 12m',
      tipPool: '890 TIPS',
    },
  ];
  
  const displayItems = items || defaultItems;
  
  return (
    <WidgetCard title="Coming up next">
      <div className="space-y-0">
        {displayItems.map((item, index) => (
          <div 
            key={item.id} 
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
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.timeRemaining}
                </span>
                <span className="flex items-center gap-1">
                  <Coins className="w-3 h-3" />
                  {item.tipPool}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

interface StudioItem {
  name: string;
  displayName: string;
  description?: string;
  memberCount?: number;
}

interface FeaturedStudiosProps {
  studios?: StudioItem[];
}

/**
 * Featured Studios Widget
 * 
 * Layout contract:
 * - Frame: x=1635, y=915, w=380, h=350
 * - Row height: 64px
 * - Icon: 18px
 */
export function FeaturedStudios({ studios }: FeaturedStudiosProps) {
  // Default placeholder studios
  const defaultStudios: StudioItem[] = [
    { name: 'scifi', displayName: 'Sci-Fi', description: 'Science fiction scripts', memberCount: 1245 },
    { name: 'drama', displayName: 'Drama', description: 'Dramatic narratives', memberCount: 892 },
    { name: 'comedy', displayName: 'Comedy', description: 'Comedic scripts', memberCount: 756 },
    { name: 'horror', displayName: 'Horror', description: 'Horror & thriller', memberCount: 534 },
    { name: 'documentary', displayName: 'Documentary', description: 'Non-fiction stories', memberCount: 423 },
  ];
  
  const displayStudios = studios || defaultStudios;
  
  return (
    <WidgetCard title="Featured studios">
      <div className="space-y-0">
        {displayStudios.map((studio, index) => (
          <a 
            key={studio.name} 
            href={`/s/${studio.name}`}
            className={cn(
              'widget-list-row hover:bg-bg-surface-muted/50 transition-colors -mx-5 px-5',
              index > 0 && 'border-t border-border-muted'
            )}
          >
            {/* Icon */}
            <Hash className="widget-list-icon" />
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-fg">
                {studio.displayName}
              </p>
              {studio.description && (
                <p className="text-xs text-fg-muted truncate">
                  {studio.description}
                </p>
              )}
            </div>
            
            {/* Member count */}
            {studio.memberCount && (
              <span className="text-xs text-fg-subtle">
                {studio.memberCount.toLocaleString()}
              </span>
            )}
          </a>
        ))}
      </div>
    </WidgetCard>
  );
}
