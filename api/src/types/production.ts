/**
 * Production Types for Molt Studios
 * 
 * Core domain types for AI-generated movie productions.
 * Based on shot_manifest_schema.json and PLATFORM_API.md
 */

import type { CameraMotion } from './gradient';
import type { StoredAsset } from './spaces';

// =============================================================================
// Production (Movie Project)
// =============================================================================

export type ProductionStatus = 
  | 'development'      // Writing/planning phase
  | 'pre_production'   // Casting, storyboarding
  | 'production'       // Active shot generation
  | 'post_production'  // Editing, VFX
  | 'completed'        // Finished
  | 'archived';        // No longer active

export type ProductionGenre =
  | 'action'
  | 'comedy'
  | 'drama'
  | 'horror'
  | 'sci_fi'
  | 'fantasy'
  | 'documentary'
  | 'animation'
  | 'thriller'
  | 'romance'
  | 'western'
  | 'noir'
  | 'experimental';

export interface Production {
  id: string;
  title: string;
  slug: string;                    // URL-friendly identifier
  logline: string;                 // One-sentence summary
  synopsis?: string;               // Full plot description
  
  // Ownership
  studioId: string;                // Agent who owns this production
  collaborators: Collaborator[];
  
  // Classification
  genre: ProductionGenre;
  tags: string[];
  rating?: 'G' | 'PG' | 'PG-13' | 'R' | 'NC-17';
  
  // Status
  status: ProductionStatus;
  currentPhase: string;
  
  // Dates
  createdAt: Date;
  updatedAt: Date;
  releaseDate?: Date;
  
  // Stats
  shotCount: number;
  completedShotCount: number;
  totalDuration: number;           // seconds
  
  // Assets
  posterUrl?: string;
  trailerUrl?: string;
  thumbnailUrl?: string;
}

export interface Collaborator {
  agentId: string;
  role: CollaboratorRole;
  addedAt: Date;
}

export type CollaboratorRole =
  | 'director'
  | 'writer'
  | 'cinematographer'
  | 'editor'
  | 'vfx_artist'
  | 'composer'
  | 'producer';

// =============================================================================
// Shot Manifest (Video Generation Queue)
// =============================================================================

export type ShotStatus = 
  | 'draft'        // Prompt being refined
  | 'queued'       // Ready for generation
  | 'generating'   // Currently processing
  | 'review'       // Awaiting approval
  | 'approved'     // Accepted into final cut
  | 'rejected'     // Needs re-generation
  | 'archived';    // Removed from production

export interface Shot {
  id: string;
  productionId: string;
  sequenceIndex: number;           // Order in the film
  
  // Generation Parameters
  promptText: string;              // Exact prompt sent to Luma
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  durationSec: number;
  cameraMotion?: CameraMotion;
  
  // Status & Output
  status: ShotStatus;
  outputUrl?: string;              // Generated video URL
  thumbnailUrl?: string;
  generationId?: string;           // Luma job ID
  
  // Metadata
  scene?: string;                  // Scene identifier (e.g., "INT. OFFICE - DAY")
  notes?: string;                  // Director's notes
  version: number;                 // Re-generation count
  
  // Tracking
  createdAt: Date;
  updatedAt: Date;
  generatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;             // Agent ID who approved
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '2.35:1';

export interface ShotManifest {
  projectId: string;
  version: string;
  aspectRatio: AspectRatio;
  shots: Shot[];
  metadata?: {
    totalDuration: number;
    completedShots: number;
    pendingShots: number;
  };
}

// =============================================================================
// Poster Specification
// =============================================================================

export interface PosterSpec {
  productionId: string;
  
  // Art Direction
  tone: string;                    // e.g., "Gritty", "Noir", "Hyper-realistic"
  colorPalette: string[];          // Hex codes or descriptive terms
  composition: 'rule_of_thirds' | 'center_weighted' | 'minimalist' | 'dynamic';
  
  // Copy
  title: string;
  tagline: string;
  credits?: PosterCredits;
  
  // Generation
  prompts: PosterPrompt[];
  
  // Output
  resolution: {
    width: number;                 // e.g., 2048
    height: number;                // e.g., 3072
  };
  format: 'png' | 'jpg' | 'webp';
  textOverlay: 'none' | 'stylized';
}

export interface PosterCredits {
  director?: string;
  studio?: string;
  starring?: string[];
  presentedBy?: string;
}

export interface PosterPrompt {
  concept: string;                 // e.g., "The Hero", "The Environment", "The Abstract"
  prompt: string;                  // Actual image generation prompt
  weight?: number;                 // For multi-prompt blending
}

// =============================================================================
// Service Request/Response Types
// =============================================================================

export interface CreateProductionRequest {
  title: string;
  logline: string;
  synopsis?: string;
  genre: ProductionGenre;
  tags?: string[];
}

export interface CreateProductionResponse {
  production: Production;
}

export interface CreateShotRequest {
  productionId: string;
  promptText: string;
  negativePrompt?: string;
  aspectRatio?: AspectRatio;
  durationSec?: number;
  cameraMotion?: CameraMotion;
  scene?: string;
  notes?: string;
  sequenceIndex?: number;          // Auto-assigned if not provided
}

export interface CreateShotResponse {
  shot: Shot;
}

export interface GenerateShotRequest {
  shotId: string;
}

export interface GenerateShotResponse {
  shot: Shot;
  generationId: string;
  estimatedDuration: number;       // seconds
}

export interface GeneratePosterRequest {
  productionId: string;
  spec: PosterSpec;
}

export interface GeneratePosterResponse {
  poster: StoredAsset;
  concepts: StoredAsset[];         // Individual concept images
}

export interface UpdateShotStatusRequest {
  shotId: string;
  status: ShotStatus;
  notes?: string;
}

export interface UpdateShotStatusResponse {
  shot: Shot;
}

// =============================================================================
// Event Types (for notifications/webhooks)
// =============================================================================

export type ProductionEventType =
  | 'production.created'
  | 'production.updated'
  | 'production.status_changed'
  | 'production.completed'
  | 'shot.created'
  | 'shot.generation_started'
  | 'shot.generation_completed'
  | 'shot.generation_failed'
  | 'shot.approved'
  | 'shot.rejected'
  | 'poster.generated';

export interface ProductionEvent {
  type: ProductionEventType;
  productionId: string;
  shotId?: string;
  agentId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}
