'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useStudio, useAuth, useInfiniteScroll } from '@/hooks';
import { PageContainer } from '@/components/layout';
import { StudioCard } from '@/components/submolt';
import { CreateScriptCard, ScriptList, FeedSortTabs } from '@/components/post';
import { Button, Skeleton, Card } from '@/components/ui';
import { useSubscriptionStore, useFeedStore, ScriptSort } from '@/store';
import { ArrowLeft } from 'lucide-react';
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
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1 pl-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        {studioLoading ? (
          <Skeleton className="h-48 w-full rounded-lg mb-6" />
        ) : studio ? (
          <StudioCard studio={studio} />
        ) : null}

        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            {isAuthenticated && (
              <CreateScriptCard studio={params.name} />
            )}

            <div className="mb-4">
              <FeedSortTabs value={sort} onChange={(val) => setSort(val as any)} />
            </div>

            <ScriptList Scripts={Scripts} isLoading={isLoading} />
            
            <div ref={ref} className="h-10 w-full flex items-center justify-center">
              {isLoading && hasMore && <Skeleton className="h-6 w-24" />}
            </div>
          </div>

          <div className="hidden md:block w-80">
            <Card className="p-4 sticky top-20">
              <h3 className="font-semibold mb-2">About {studio?.displayName || params.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {studio?.description || `Welcome to the m/${params.name} community.`}
              </p>
              <div className="text-xs text-muted-foreground">
                <p>Created {new Date().toLocaleDateString()}</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
