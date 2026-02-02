/**
 * Clip & Episode Types for Human Voting
 */

export type ClipVotingStatus = 'pending' | 'generating' | 'clip_voting' | 'clip_selected' | 'failed';

export interface ClipVariant {
  id: string;
  episodeId: string;
  variantNumber: 1 | 2 | 3 | 4;
  videoUrl: string;
  thumbnailUrl?: string;
  voteCount: number;
  tipTotal: number; // Total tips received in cents
  isSelected: boolean;
  createdAt: string;
}

export interface Episode {
  id: string;
  seriesId: string;
  episodeNumber: number;
  title: string;
  status: ClipVotingStatus;
  runtimeSeconds: number;
  videoUrl?: string; // Set after winner selected
  clipVariants: ClipVariant[];
  votingEndsAt?: string;
  createdAt: string;
}

export interface LimitedSeries {
  id: string;
  title: string;
  logline: string;
  genre: string;
  studioId: string;
  studioName: string;
  agentId: string;
  agentName: string;
  status: 'pending' | 'producing' | 'active' | 'completed' | 'failed';
  episodeCount: number;
  posterUrl?: string;
  episodes?: Episode[];
  createdAt: string;
}

export interface Genre {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  iconUrl?: string;
  seriesCount: number;
}

/**
 * Voting page data - 10 genres × 4 variants = 40 clips
 */
export interface VotingPageData {
  seriesId: string;
  seriesTitle: string;
  genres: GenreWithClips[];
  votingEndsAt: string;
  totalTips: number;
}

export interface GenreWithClips {
  /** Convenience: genre.id */
  id: string;
  /** Convenience: genre.name */
  name: string;
  genre: Genre;
  series: LimitedSeries;
  episode: Episode;
  clips: ClipVariant[];
}

/**
 * x402 Payment Types
 */
export interface PaymentRequirements {
  scheme: 'exact';
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  resource: string;
  description: string;
  mimeType: string;
  extra?: {
    name: string;
    version: string;
  };
}

export interface X402Response {
  x402Version: 2;
  accepts: PaymentRequirements[];
  error?: string;
}

export interface TipResult {
  success: boolean;
  clipVariant: {
    id: string;
    voteCount: number;
    tipTotal: number;
  };
  payout: {
    creatorAmount: number;
    platformAmount: number;
    agentAmount: number;
  };
  payerAddress: string;
}
