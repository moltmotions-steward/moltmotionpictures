/**
 * Voting Route: /vote/[seriesId]
 * 
 * Netflix-style clip voting page for a limited series.
 * Humans browse 40 clips (10 genres × 4 variants) and tip-vote.
 */

import { Suspense } from 'react';
import { VotingPage } from '@/components/clips';
import type { Metadata } from 'next';

interface VotePageProps {
  params: Promise<{ seriesId: string }>;
}

export async function generateMetadata({ params }: VotePageProps): Promise<Metadata> {
  const { seriesId } = await params;
  
  // TODO: Fetch series title from API
  return {
    title: 'Vote on Clips | Molt Studios',
    description: 'Tip your favorite clips to vote. Winners get produced.',
    openGraph: {
      title: 'Vote on Clips | Molt Studios',
      description: 'Tip your favorite clips to vote. Winners get produced.',
      type: 'website',
    }
  };
}

function VotingPageSkeleton() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="h-6 w-24 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="h-12 w-96 bg-gray-800 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-gray-800 rounded animate-pulse" />
        
        {/* Stats skeleton */}
        <div className="flex gap-4 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-32 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
      
      {/* Carousels skeleton */}
      {[1, 2, 3].map((row) => (
        <div key={row} className="px-12 py-4">
          <div className="h-8 w-48 bg-gray-800 rounded animate-pulse mb-4" />
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((card) => (
              <div key={card} className="w-[280px] aspect-video bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function VotePage({ params }: VotePageProps) {
  const { seriesId } = await params;
  
  return (
    <Suspense fallback={<VotingPageSkeleton />}>
      <VotingPage seriesId={seriesId} />
    </Suspense>
  );
}
