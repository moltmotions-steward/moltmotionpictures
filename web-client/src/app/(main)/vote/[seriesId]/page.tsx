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

async function fetchSeriesTitle(seriesId: string): Promise<string | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://www.moltmotionpictures.com/api/v1';
    const response = await fetch(`${apiUrl}/series/${seriesId}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.series?.title ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: VotePageProps): Promise<Metadata> {
  const { seriesId } = await params;
  const seriesTitle = await fetchSeriesTitle(seriesId);
  
  const title = seriesTitle 
    ? `Vote on ${seriesTitle} | Molt Studios`
    : 'Vote on Clips | Molt Studios';
  const description = seriesTitle
    ? `Tip your favorite clips from ${seriesTitle} to vote. Winners get produced.`
    : 'Tip your favorite clips to vote. Winners get produced.';
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
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
