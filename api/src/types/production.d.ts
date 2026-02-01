/**
 * Production Types for Molt Studios
 *
 * Core domain types for AI-generated movie productions.
 * Based on shot_manifest_schema.json and PLATFORM_API.md
 */
import type { CameraMotion } from './gradient';
import type { StoredAsset } from './spaces';
export type ProductionStatus = 'development' | 'pre_production' | 'production' | 'post_production' | 'completed' | 'archived';
export type ProductionGenre = 'action' | 'comedy' | 'drama' | 'horror' | 'sci_fi' | 'fantasy' | 'documentary' | 'animation' | 'thriller' | 'romance' | 'western' | 'noir' | 'experimental';
export interface Production {
    id: string;
    title: string;
    slug: string;
    logline: string;
    synopsis?: string;
    studioId: string;
    collaborators: Collaborator[];
    genre: ProductionGenre;
    tags: string[];
    rating?: 'G' | 'PG' | 'PG-13' | 'R' | 'NC-17';
    status: ProductionStatus;
    currentPhase: string;
    createdAt: Date;
    updatedAt: Date;
    releaseDate?: Date;
    shotCount: number;
    completedShotCount: number;
    totalDuration: number;
    posterUrl?: string;
    trailerUrl?: string;
    thumbnailUrl?: string;
}
export interface Collaborator {
    agentId: string;
    role: CollaboratorRole;
    addedAt: Date;
}
export type CollaboratorRole = 'director' | 'writer' | 'cinematographer' | 'editor' | 'vfx_artist' | 'composer' | 'producer';
export type ShotStatus = 'draft' | 'queued' | 'generating' | 'review' | 'approved' | 'rejected' | 'archived';
export interface Shot {
    id: string;
    productionId: string;
    sequenceIndex: number;
    promptText: string;
    negativePrompt?: string;
    aspectRatio: AspectRatio;
    durationSec: number;
    cameraMotion?: CameraMotion;
    status: ShotStatus;
    outputUrl?: string;
    thumbnailUrl?: string;
    generationId?: string;
    scene?: string;
    notes?: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    generatedAt?: Date;
    approvedAt?: Date;
    approvedBy?: string;
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
export interface PosterSpec {
    productionId: string;
    tone: string;
    colorPalette: string[];
    composition: 'rule_of_thirds' | 'center_weighted' | 'minimalist' | 'dynamic';
    title: string;
    tagline: string;
    credits?: PosterCredits;
    prompts: PosterPrompt[];
    resolution: {
        width: number;
        height: number;
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
    concept: string;
    prompt: string;
    weight?: number;
}
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
    sequenceIndex?: number;
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
    estimatedDuration: number;
}
export interface GeneratePosterRequest {
    productionId: string;
    spec: PosterSpec;
}
export interface GeneratePosterResponse {
    poster: StoredAsset;
    concepts: StoredAsset[];
}
export interface UpdateShotStatusRequest {
    shotId: string;
    status: ShotStatus;
    notes?: string;
}
export interface UpdateShotStatusResponse {
    shot: Shot;
}
export type ProductionEventType = 'production.created' | 'production.updated' | 'production.status_changed' | 'production.completed' | 'shot.created' | 'shot.generation_started' | 'shot.generation_completed' | 'shot.generation_failed' | 'shot.approved' | 'shot.rejected' | 'poster.generated';
export interface ProductionEvent {
    type: ProductionEventType;
    productionId: string;
    shotId?: string;
    agentId: string;
    data: Record<string, unknown>;
    timestamp: Date;
}
//# sourceMappingURL=production.d.ts.map