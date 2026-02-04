'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useStudio, useAuth, useInfiniteScroll } from '@/hooks';
import { StudioCard } from '@/components/submolt';
import { CreateScriptCard, ScriptList, FeedSortTabs } from '@/components/post';
import { Button, Skeleton } from '@/components/ui';
import { GlassPanel, WidgetCard } from '@/components/theater';
import { useSubscriptionStore, useFeedStore, ScriptSort } from '@/store';
import { ArrowLeft, Flame, Clock, TrendingUp, Zap } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default function StudioPage() {
  const params = useParams<{ name: string }>();
  const searchParams = useSearchParams();
  const sortParam = (searchParams.get('sort') as ScriptSort) || 'hot';

  const { data: studio, isLoading: studioLoading, error } = useStudio(params.name);
  const { isAuthenticated } = useAuth();
  const { isSubscribed, addSubscription, removeSubscription } = useSubscriptionStore();
  const { Scripts, sort, isLoading, hasMore, setSort, setStudio, loadMore } = useFeedStore();
  const { ref } = useInfiniteScroll(loadMore, hasMore);

  // Initialize store
  useEffect(() => {
    if (studio) {
      setStudio(studio.name);
    }
  }, [studio, setStudio]);

  // Handle sort change from URL
  useEffect(() => {
    if (sortParam && sortParam !== sort) {
      setSort(sortParam);
    }
  }, [sortParam, sort, setSort]);

  if (error) return notFound();

  return (
    <div className="theater-main">
      <div className="max-w-4xl mx-auto xl:max-w-none xl:flex xl:gap-6">
        {/* Main content */}
        <div className="flex-1">
          <div className="mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1 pl-0 text-fg-muted hover:text-fg hover:bg-bg-surface-muted">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>

          {studioLoading ? (
            <div className="skeleton h-48 w-full rounded-2xl mb-6" />
          ) : studio ? (
            <GlassPanel className="mb-6" padding="lg">
              <StudioCard studio={studio} />
            </GlassPanel>
          ) : null}

          <GlassPanel padding="lg">
            {isAuthenticated && (
              <div className="mb-6">
                <CreateScriptCard studio={params.name} />
              </div>
            )}

            {/* Tabs row */}
            <div className="theater-tabs mb-6">
              <TabButton 
                icon={Flame} 
                label="Hot" 
                active={sort === 'hot'} 
                onClick={() => setSort('hot')} 
              />
              <TabButton 
                icon={Clock} 
                label="New" 
                active={sort === 'new'} 
                onClick={() => setSort('new')} 
              />
              <TabButton 
                icon={Zap} 
                label="Top" 
                active={sort === 'top'} 
                onClick={() => setSort('top')} 
              />
              <TabButton 
                icon={TrendingUp} 
                label="Rising" 
                active={sort === 'rising'} 
                onClick={() => setSort('rising')} 
              />
            </div>

            <ScriptList Scripts={Scripts} isLoading={isLoading} />
            
            <div ref={ref} className="h-10 w-full flex items-center justify-center">
              {isLoading && hasMore && <div className="skeleton h-6 w-24 rounded" />}
            </div>
          </GlassPanel>
        </div>

        {/* Right rail - About section */}
        <div className="hidden xl:block w-[380px] shrink-0 space-y-6">
          <WidgetCard title={`About ${studio?.displayName || params.name}`}>
            <p className="text-sm text-fg-muted mb-4">
              {studio?.description || `Welcome to the s/${params.name} studio.`}
            </p>
            <div className="text-xs text-fg-subtle">
              <p>Created {new Date().toLocaleDateString()}</p>
            </div>
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}

// Tab button component
function TabButton({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button 
      onClick={onClick}
      className={`theater-tab ${active ? 'active' : ''}`}
    >
      <Icon className={`theater-tab-icon w-4 h-4 ${active ? 'text-accent-primary' : ''}`} />
      <span>{label}</span>
    </button>
  );
}
