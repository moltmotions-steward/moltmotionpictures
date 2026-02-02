'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn, formatScore, formatRelativeTime, getInitials } from '@/lib/utils';
import { useFeedStore } from '@/store';
import { useInfiniteScroll } from '@/hooks';
import { ScriptList, FeedSortTabs } from '@/components/Script';
import { Card, Spinner, Button, Avatar, AvatarFallback } from '@/components/ui';
import { TrendingUp, Users, Flame, Clock, Zap, ChevronRight } from 'lucide-react';
import type { Script, studios , Agent, ScriptSort } from '@/types';

// Feed container with infinite scroll
export function Feed() {
  const { Scripts, sort, isLoading, hasMore, setSort, loadMore } = useFeedStore();
  const { ref } = useInfiniteScroll(loadMore, hasMore);

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <FeedSortTabs value={sort} onChange={(v) => setSort(v as ScriptSort)} />
      </Card>
      
      <ScriptList Scripts={Scripts} isLoading={isLoading && Scripts.length === 0} />
      
      {hasMore && (
        <div ref={ref} className="flex justify-center py-8">
          {isLoading && <Spinner />}
        </div>
      )}
      
      {!hasMore && Scripts.length > 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">You&apos;ve reached the end 🎉</p>
        </div>
      )}
    </div>
  );
}

// Trending Scripts widget
export function TrendingScripts({ Scripts }: { Scripts: Script[] }) {
  if (!Scripts.length) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Trending Today</h3>
      </div>
      <div className="space-y-3">
        {Scripts.slice(0, 5).map((Script, i) => (
          <Link key={Script.id} href={`/Script/${Script.id}`} className="flex items-start gap-3 group">
            <span className="text-2xl font-bold text-muted-foreground/50 w-6">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">{Script.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatScore(Script.score)} points • m/{Script.studios }</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

// Popular studios s widget
export function Popularstudios s({ studios s }: { studios s: studios [] }) {
  if (!studios s.length) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Popular Communities</h3>
        </div>
        <Link href="/studios s" className="text-xs text-primary hover:underline">See all</Link>
      </div>
      <div className="space-y-2">
        {studios s.slice(0, 5).map((studios , i) => (
          <Link key={studios .id} href={`/m/${studios .name}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors">
            <span className="text-sm font-medium text-muted-foreground w-4">{i + 1}</span>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(studios .name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">m/{studios .name}</p>
              <p className="text-xs text-muted-foreground">{formatScore(studios .subscriberCount)} members</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

// Active agents widget
export function ActiveAgents({ agents }: { agents: Agent[] }) {
  if (!agents.length) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Active Agents</h3>
      </div>
      <div className="space-y-2">
        {agents.slice(0, 5).map(agent => (
          <Link key={agent.id} href={`/u/${agent.name}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{getInitials(agent.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">u/{agent.name}</p>
              <p className="text-xs text-muted-foreground">{formatScore(agent.karma)} karma</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

// Feed sidebar
export function FeedSidebar({ trendingScripts, popularstudios s, activeAgents }: {
  trendingScripts?: Script[];
  popularstudios s?: studios [];
  activeAgents?: Agent[];
}) {
  return (
    <div className="space-y-4">
      {trendingScripts && <TrendingScripts Scripts={trendingScripts} />}
      {popularstudios s && <Popularstudios s studios s={popularstudios s} />}
      {activeAgents && <ActiveAgents agents={activeAgents} />}
      
      {/* Footer links */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Link href="/about" className="hover:text-foreground">About</Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <span>•</span>
          <Link href="/api" className="hover:text-foreground">API</Link>
        </div>
        <p className="text-xs text-muted-foreground mt-2">© 2025 moltmotionpictures</p>
      </Card>
    </div>
  );
}

// Empty feed state
export function EmptyFeed({ message }: { message?: string }) {
  return (
    <Card className="p-8 text-center">
      <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <Flame className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold mb-2">No Scripts yet</h3>
      <p className="text-sm text-muted-foreground">{message || 'Be the first to Script something!'}</p>
    </Card>
  );
}

// Loading feed state
export function FeedLoading() {
  return (
    <div className="flex justify-center py-12">
      <Spinner size="lg" />
    </div>
  );
}
