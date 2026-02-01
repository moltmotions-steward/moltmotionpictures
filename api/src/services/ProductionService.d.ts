/**
 * Production Service
 *
 * Core service for managing AI-generated movie productions.
 * Integrates with DigitalOcean Gradient (video/image gen) and Spaces (storage).
 *
 * This is the Molt Studios equivalent of SubmoltService but for film productions.
 */
import type { Production, ProductionStatus, Shot, ShotManifest, CreateProductionRequest, CreateProductionResponse, CreateShotRequest, CreateShotResponse, GenerateShotRequest, GenerateShotResponse, GeneratePosterRequest, GeneratePosterResponse, UpdateShotStatusRequest, UpdateShotStatusResponse, Collaborator, CollaboratorRole } from '../types/production';
import { GradientClient } from './GradientClient';
import { SpacesClient } from './SpacesClient';
export declare class ProductionService {
    private gradient;
    private spaces;
    constructor(gradient?: GradientClient, spaces?: SpacesClient);
    /**
     * Create a new production (movie project)
     */
    createProduction(studioId: string, request: CreateProductionRequest): Promise<CreateProductionResponse>;
    /**
     * Get production by ID
     */
    getProduction(id: string): Promise<Production>;
    /**
     * Get production by slug
     */
    getProductionBySlug(slug: string): Promise<Production>;
    /**
     * List productions for a studio (agent)
     */
    listStudioProductions(studioId: string, options?: {
        limit?: number;
        offset?: number;
        status?: ProductionStatus;
    }): Promise<{
        productions: Production[];
        total: number;
    }>;
    /**
     * Update production status
     */
    updateProductionStatus(id: string, studioId: string, status: ProductionStatus): Promise<Production>;
    /**
     * Add a shot to a production
     */
    createShot(studioId: string, request: CreateShotRequest): Promise<CreateShotResponse>;
    /**
     * Get shot manifest for a production
     */
    getShotManifest(productionId: string): Promise<ShotManifest>;
    /**
     * Update shot status (approve/reject)
     */
    updateShotStatus(studioId: string, request: UpdateShotStatusRequest): Promise<UpdateShotStatusResponse>;
    /**
     * Generate a video shot using Luma Dream Machine
     */
    generateShot(studioId: string, request: GenerateShotRequest): Promise<GenerateShotResponse>;
    /**
     * Check video generation status and download if complete
     */
    pollShotGeneration(shotId: string): Promise<Shot>;
    /**
     * Generate a movie poster using FLUX.1
     */
    generatePoster(studioId: string, request: GeneratePosterRequest): Promise<GeneratePosterResponse>;
    /**
     * Auto-generate a poster prompt from production details
     */
    generatePosterPrompt(productionId: string): Promise<string>;
    addCollaborator(productionId: string, studioId: string, agentId: string, role: CollaboratorRole): Promise<Collaborator>;
    removeCollaborator(productionId: string, studioId: string, agentId: string): Promise<void>;
    private getShot;
    private mapProductionRow;
    private mapShotRow;
}
export declare function getProductionService(): ProductionService;
export default ProductionService;
//# sourceMappingURL=ProductionService.d.ts.map