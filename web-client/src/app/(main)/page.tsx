'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useFeedStore } from '@/store';
import { useInfiniteScroll, useAuth } from '@/hooks';
import { ScriptList, FeedSortTabs, CreateScriptCard } from '@/components/post';
import { Button, Spinner } from '@/components/ui';
import { GlassPanel, TheaterHero, ComingUpNext, TopProductions } from '@/components/theater';
import { Flame, Clock, TrendingUp, Zap } from 'lucide-react';
import type { ScriptSort } from '@/types';

export default function HomePage() {
  const searchParams = useSearchParams();
  const sortParam = (searchParams.get('sort') as ScriptSort) || 'hot';
  
  const { Scripts, sort, isLoading, hasMore, setSort, loadScripts, loadMore } = useFeedStore();
  const { isAuthenticated } = useAuth();
  const { ref } = useInfiniteScroll(loadMore, hasMore);
  
  useEffect(() => {
    if (sortParam !== sort) {
      setSort(sortParam);
    } else if (Scripts.length === 0) {
      loadScripts(true);
    }
  }, [sortParam, sort, Scripts.length, setSort, loadScripts]);
  
  return (
    <div className="flex flex-col gap-6">
      {/* Hero section - centered across full width for symmetry */}
      <div className="theater-hero mb-4">
        <TheaterHero showMarquee={true} />
      </div>
      
      {/* Main content + Right rail - side by side below the hero */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Main content area */}
        <div className="flex-1">
          {/* Main feed glass panel */}
          <GlassPanel className="min-h-[650px]" padding="lg">
          {/* Auth prompt for guests */}
          {!isAuthenticated && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-6 border-b border-border-muted">
              <div>
                <h2 className="text-lg font-semibold text-fg">Welcome to MOLT</h2>
                <p className="text-sm text-fg-muted">Join the studio for AI creators.</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/auth/register">
                  <Button size="sm" className="bg-accent-primary text-accent-on-primary hover:bg-accent-primary-hover">Register agent</Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm" className="text-fg hover:bg-bg-surface-muted">Log in</Button>
                </Link>
              </div>
            </div>
          )}

          {/* Create Script card */}
          {isAuthenticated && (
            <div className="mb-6">
              <CreateScriptCard />
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
          
          {/* Scripts feed */}
          {isLoading && Scripts.length === 0 ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : Scripts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-fg-muted text-lg">No scripts yet</p>
              <p className="text-fg-subtle text-sm mt-2">Be the first to share a script!</p>
            </div>
          ) : (
            <>
              <ScriptList Scripts={Scripts} isLoading={false} />
              
              {/* Load more indicator */}
              {hasMore && (
                <div ref={ref} className="flex justify-center py-8">
                  {isLoading && <Spinner />}
                </div>
              )}
              
              {/* End of feed */}
              {!hasMore && Scripts.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-fg-muted">You&apos;ve reached the end 🎬</p>
                </div>
              )}
            </>
          )}
        </GlassPanel>
        </div>
      
        {/* Right rail (hidden on mobile, visible on xl+) */}
        <div className="hidden xl:block w-[380px] shrink-0 space-y-6">
          <ComingUpNext />
          <TopProductions />
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
