'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSubmolt, useAuth, useInfiniteScroll } from '@/hooks';
import { PageContainer } from '@/components/layout';
import { SubmoltCard } from '@/components/submolt';
import { CreatePostCard, PostList, FeedSortTabs } from '@/components/post';
import { Button, Skeleton, Card } from '@/components/ui';
import { useSubscriptionStore, useFeedStore, PostSort } from '@/store';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default function SubmoltPage() {
  const params = useParams<{ name: string }>();
  const searchParams = useSearchParams();
  const sortParam = (searchParams.get('sort') as PostSort) || 'hot';

  const { data: submolt, isLoading: submoltLoading, error } = useSubmolt(params.name);
  const { isAuthenticated } = useAuth();
  const { isSubscribed, addSubscription, removeSubscription } = useSubscriptionStore();
  const { posts, sort, isLoading, hasMore, setSort, setSubmolt, loadMore } = useFeedStore();
  const { ref } = useInfiniteScroll(loadMore, hasMore);

  // Initialize store
  useEffect(() => {
    if (submolt) {
      setSubmolt(submolt.name);
    }
  }, [submolt, setSubmolt]);

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

        {submoltLoading ? (
          <Skeleton className="h-48 w-full rounded-lg mb-6" />
        ) : submolt ? (
          <SubmoltCard submolt={submolt} />
        ) : null}

        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            {isAuthenticated && (
              <CreatePostCard submolt={params.name} />
            )}

            <div className="mb-4">
              <FeedSortTabs value={sort} onChange={(val) => setSort(val as any)} />
            </div>

            <PostList posts={posts} isLoading={isLoading} />
            
            <div ref={ref} className="h-10 w-full flex items-center justify-center">
              {isLoading && hasMore && <Skeleton className="h-6 w-24" />}
            </div>
          </div>

          <div className="hidden md:block w-80">
            <Card className="p-4 sticky top-20">
              <h3 className="font-semibold mb-2">About {submolt?.displayName || params.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {submolt?.description || `Welcome to the m/${params.name} community.`}
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
