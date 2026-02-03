"use strict";
/**
 * Production Service
 *
 * Core service for managing AI-generated movie productions.
 * Integrates with DigitalOcean Gradient (video/image gen) and Spaces (storage).
 *
 * This is the Molt Studios equivalent of studios Service but for film productions.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionService = void 0;
exports.getProductionService = getProductionService;
const crypto_1 = __importDefault(require("crypto"));
const GradientClient_1 = require("./GradientClient");
const SpacesClient_1 = require("./SpacesClient");
// =============================================================================
// Database Helpers (using existing Prisma pattern)
// =============================================================================
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { queryOne, queryAll, transaction } = require('../config/database');
// eslint-disable-next-line @typescript-eslint/no-require-imports  
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
// =============================================================================
// Helper Functions
// =============================================================================
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
function validateGenre(genre) {
    const validGenres = [
        'action', 'comedy', 'drama', 'horror', 'sci_fi', 'fantasy',
        'documentary', 'animation', 'thriller', 'romance', 'western', 'noir', 'experimental'
    ];
    return validGenres.includes(genre);
}
function validateAspectRatio(ratio) {
    const validRatios = ['16:9', '9:16', '1:1', '4:3', '2.35:1'];
    return validRatios.includes(ratio);
}
// =============================================================================
// Production Service Class
// =============================================================================
class ProductionService {
    gradient;
    spaces;
    constructor(gradient, spaces) {
        this.gradient = gradient || (0, GradientClient_1.getGradientClient)();
        this.spaces = spaces || (0, SpacesClient_1.getSpacesClient)();
    }
    // ---------------------------------------------------------------------------
    // Production CRUD
    // ---------------------------------------------------------------------------
    /**
     * Create a new production (movie project)
     */
    async createProduction(studioId, request) {
        // Validate
        if (!request.title || request.title.trim().length === 0) {
            throw new BadRequestError('Title is required');
        }
        if (request.title.length > 200) {
            throw new BadRequestError('Title must be 200 characters or less');
        }
        if (!request.logline || request.logline.trim().length === 0) {
            throw new BadRequestError('Logline is required');
        }
        if (request.logline.length > 500) {
            throw new BadRequestError('Logline must be 500 characters or less');
        }
        if (!validateGenre(request.genre)) {
            throw new BadRequestError(`Invalid genre: ${request.genre}`);
        }
        const id = crypto_1.default.randomUUID();
        const slug = slugify(request.title);
        // Check for slug collision
        const existing = await queryOne('SELECT id FROM productions WHERE slug = $1', [slug]);
        const finalSlug = existing ? `${slug}-${id.slice(0, 8)}` : slug;
        const production = await queryOne(`INSERT INTO productions (
        id, title, slug, logline, synopsis, studio_id, genre, tags, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`, [
            id,
            request.title.trim(),
            finalSlug,
            request.logline.trim(),
            request.synopsis?.trim() || null,
            studioId,
            request.genre,
            JSON.stringify(request.tags || []),
            'development',
        ]);
        return {
            production: this.mapProductionRow(production),
        };
    }
    /**
     * Get production by ID
     */
    async getProduction(id) {
        const production = await queryOne(`SELECT p.*, a.name as studio_name, a.display_name as studio_display_name
       FROM productions p
       JOIN agents a ON p.studio_id = a.id
       WHERE p.id = $1`, [id]);
        if (!production) {
            throw new NotFoundError('Production');
        }
        return this.mapProductionRow(production);
    }
    /**
     * Get production by slug
     */
    async getProductionBySlug(slug) {
        const production = await queryOne(`SELECT p.*, a.name as studio_name, a.display_name as studio_display_name
       FROM productions p
       JOIN agents a ON p.studio_id = a.id
       WHERE p.slug = $1`, [slug]);
        if (!production) {
            throw new NotFoundError('Production');
        }
        return this.mapProductionRow(production);
    }
    /**
     * List productions for a studio (agent)
     */
    async listStudioProductions(studioId, options = {}) {
        const limit = Math.min(options.limit || 25, 100);
        const offset = options.offset || 0;
        let query = `
      SELECT p.*, a.name as studio_name, a.display_name as studio_display_name
      FROM productions p
      JOIN agents a ON p.studio_id = a.id
      WHERE p.studio_id = $1
    `;
        const params = [studioId];
        if (options.status) {
            params.push(options.status);
            query += ` AND p.status = $${params.length}`;
        }
        query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const productions = await queryAll(query, params);
        const countResult = await queryOne('SELECT COUNT(*) as count FROM productions WHERE studio_id = $1', [studioId]);
        return {
            productions: productions.map((p) => this.mapProductionRow(p)),
            total: parseInt(countResult?.count || '0', 10),
        };
    }
    /**
     * Update production status
     */
    async updateProductionStatus(id, studioId, status) {
        const production = await this.getProduction(id);
        if (production.studioId !== studioId) {
            throw new ForbiddenError('You do not own this production');
        }
        const updated = await queryOne(`UPDATE productions SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`, [status, id]);
        return this.mapProductionRow(updated);
    }
    // ---------------------------------------------------------------------------
    // Shot Management
    // ---------------------------------------------------------------------------
    /**
     * Add a shot to a production
     */
    async createShot(studioId, request) {
        const production = await this.getProduction(request.productionId);
        if (production.studioId !== studioId) {
            throw new ForbiddenError('You do not own this production');
        }
        if (!request.promptText || request.promptText.trim().length === 0) {
            throw new BadRequestError('Prompt text is required');
        }
        // Get next sequence index if not provided
        let sequenceIndex = request.sequenceIndex;
        if (sequenceIndex === undefined) {
            const maxSeq = await queryOne('SELECT COALESCE(MAX(sequence_index), -1) as max_seq FROM shots WHERE production_id = $1', [request.productionId]);
            sequenceIndex = (maxSeq?.max_seq || 0) + 1;
        }
        const id = crypto_1.default.randomUUID();
        const shot = await queryOne(`INSERT INTO shots (
        id, production_id, sequence_index, prompt_text, negative_prompt,
        aspect_ratio, duration_sec, camera_motion, scene, notes, status, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`, [
            id,
            request.productionId,
            sequenceIndex,
            request.promptText.trim(),
            request.negativePrompt?.trim() || null,
            request.aspectRatio || '16:9',
            request.durationSec || 5,
            request.cameraMotion || null,
            request.scene?.trim() || null,
            request.notes?.trim() || null,
            'draft',
            1,
        ]);
        // Update production shot count
        await queryOne('UPDATE productions SET shot_count = shot_count + 1, updated_at = NOW() WHERE id = $1', [request.productionId]);
        return {
            shot: this.mapShotRow(shot),
        };
    }
    /**
     * Get shot manifest for a production
     */
    async getShotManifest(productionId) {
        const production = await this.getProduction(productionId);
        const shots = await queryAll(`SELECT * FROM shots 
       WHERE production_id = $1 
       ORDER BY sequence_index ASC`, [productionId]);
        const mappedShots = shots.map((s) => this.mapShotRow(s));
        const completedShots = mappedShots.filter((s) => s.status === 'approved').length;
        const pendingShots = mappedShots.filter((s) => s.status === 'draft' || s.status === 'queued' || s.status === 'generating' || s.status === 'review').length;
        const totalDuration = mappedShots.reduce((sum, s) => sum + s.durationSec, 0);
        return {
            projectId: productionId,
            version: '1.0',
            aspectRatio: production.ScripterUrl ? '16:9' : '16:9', // Could be dynamic
            shots: mappedShots,
            metadata: {
                totalDuration,
                completedShots,
                pendingShots,
            },
        };
    }
    /**
     * Update shot status (approve/reject)
     */
    async updateShotStatus(studioId, request) {
        const shot = await this.getShot(request.shotId);
        const production = await this.getProduction(shot.productionId);
        if (production.studioId !== studioId) {
            throw new ForbiddenError('You do not own this production');
        }
        const updates = ['status = $1', 'updated_at = NOW()'];
        const params = [request.status];
        if (request.notes) {
            updates.push(`notes = $${params.length + 1}`);
            params.push(request.notes);
        }
        if (request.status === 'approved') {
            updates.push(`approved_at = NOW()`);
            updates.push(`approved_by = $${params.length + 1}`);
            params.push(studioId);
        }
        params.push(request.shotId);
        const updated = await queryOne(`UPDATE shots SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
        // Update production completed shot count
        if (request.status === 'approved') {
            await queryOne('UPDATE productions SET completed_shot_count = completed_shot_count + 1, updated_at = NOW() WHERE id = $1', [shot.productionId]);
        }
        return {
            shot: this.mapShotRow(updated),
        };
    }
    // ---------------------------------------------------------------------------
    // AI Generation
    // ---------------------------------------------------------------------------
    /**
     * Generate a video shot using Luma Dream Machine
     */
    async generateShot(studioId, request) {
        const shot = await this.getShot(request.shotId);
        const production = await this.getProduction(shot.productionId);
        if (production.studioId !== studioId) {
            throw new ForbiddenError('You do not own this production');
        }
        if (shot.status !== 'draft' && shot.status !== 'rejected') {
            throw new BadRequestError('Shot must be in draft or rejected status to generate');
        }
        // Update shot status to generating
        await queryOne('UPDATE shots SET status = $1, updated_at = NOW() WHERE id = $2', ['generating', request.shotId]);
        try {
            // Optionally refine the prompt using LLM
            const refinedPrompt = await this.gradient.refineVideoPrompt(shot.promptText);
            // Generate video via Luma
            const result = await this.gradient.generateShot(refinedPrompt, {
                negativePrompt: shot.negativePrompt || undefined,
                aspectRatio: shot.aspectRatio,
                duration: shot.durationSec,
                cameraMotion: shot.cameraMotion || undefined,
            });
            // Update shot with generation ID
            await queryOne(`UPDATE shots SET 
          generation_id = $1, 
          status = $2,
          updated_at = NOW()
        WHERE id = $3`, [result.id, 'generating', request.shotId]);
            return {
                shot: await this.getShot(request.shotId),
                generationId: result.id,
                estimatedDuration: shot.durationSec * 10, // Rough estimate
            };
        }
        catch (error) {
            // Revert status on failure
            await queryOne('UPDATE shots SET status = $1, updated_at = NOW() WHERE id = $2', ['draft', request.shotId]);
            throw error;
        }
    }
    /**
     * Check video generation status and download if complete
     */
    async pollShotGeneration(shotId) {
        const shot = await this.getShot(shotId);
        if (!shot.generationId) {
            throw new BadRequestError('Shot has no active generation');
        }
        if (shot.status !== 'generating') {
            return shot; // Already completed or failed
        }
        const status = await this.gradient.getVideoStatus(shot.generationId);
        if (status.status === 'completed' && status.video_url) {
            // Download and store in Spaces
            const asset = await this.spaces.uploadFromUrl(status.video_url, `productions/${shot.productionId}/shots/${shot.id}/v${shot.version}.mp4`, {
                productionId: shot.productionId,
                shotId: shot.id,
                assetType: 'video',
                generatedBy: 'luma-dream-machine',
                prompt: shot.promptText,
                agentId: '', // Will be set by caller
            });
            // Update shot with output URL
            await queryOne(`UPDATE shots SET 
          output_url = $1,
          thumbnail_url = $2,
          status = $3,
          generated_at = NOW(),
          updated_at = NOW()
        WHERE id = $4`, [asset.url, status.thumbnail_url || null, 'review', shot.id]);
        }
        else if (status.status === 'failed') {
            await queryOne(`UPDATE shots SET 
          status = $1,
          notes = COALESCE(notes, '') || ' | Generation failed: ' || $2,
          updated_at = NOW()
        WHERE id = $3`, ['rejected', status.error || 'Unknown error', shot.id]);
        }
        return this.getShot(shotId);
    }
    /**
     * Generate a movie Scripter using FLUX.1
     */
    async generateScripter(studioId, request) {
        const production = await this.getProduction(request.productionId);
        if (production.studioId !== studioId) {
            throw new ForbiddenError('You do not own this production');
        }
        const concepts = [];
        // Generate each concept
        for (const concept of request.spec.prompts) {
            const result = await this.gradient.generateScripter(concept.prompt, {
                negativePrompt: 'text, watermark, logo, signature, blurry, low quality',
                width: request.spec.resolution.width,
                height: request.spec.resolution.height,
                model: 'flux.1-schnell',
            });
            if (result.images?.[0]?.url) {
                // Download and store
                const imageResponse = await fetch(result.images[0].url);
                const buffer = Buffer.from(await imageResponse.arrayBuffer());
                const asset = await this.spaces.uploadImage(buffer, {
                    productionId: request.productionId,
                    type: 'Scripter',
                    format: request.spec.format,
                    agentId: studioId,
                });
                concepts.push(asset);
            }
        }
        // Use first concept as main Scripter (could be more sophisticated)
        const mainScripter = concepts[0];
        if (mainScripter) {
            // Update production with Scripter URL
            await queryOne('UPDATE productions SET poster_url = $1, updated_at = NOW() WHERE id = $2', [mainScripter.cdnUrl || mainScripter.url, request.productionId]);
        }
        return {
            Scripter: mainScripter,
            concepts,
        };
    }
    /**
     * Auto-generate a Scripter prompt from production details
     */
    async generateScripterPrompt(productionId) {
        const production = await this.getProduction(productionId);
        return this.gradient.generateScripterPrompt(production.title, production.logline, production.genre);
    }
    // ---------------------------------------------------------------------------
    // Collaborators
    // ---------------------------------------------------------------------------
    async addCollaborator(productionId, studioId, agentId, role) {
        const production = await this.getProduction(productionId);
        if (production.studioId !== studioId) {
            throw new ForbiddenError('You do not own this production');
        }
        await queryOne(`INSERT INTO production_collaborators (production_id, agent_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (production_id, agent_id) DO UPDATE SET role = $3`, [productionId, agentId, role]);
        return {
            agentId,
            role,
            addedAt: new Date(),
        };
    }
    async removeCollaborator(productionId, studioId, agentId) {
        const production = await this.getProduction(productionId);
        if (production.studioId !== studioId) {
            throw new ForbiddenError('You do not own this production');
        }
        await queryOne('DELETE FROM production_collaborators WHERE production_id = $1 AND agent_id = $2', [productionId, agentId]);
    }
    // ---------------------------------------------------------------------------
    // Private Helpers
    // ---------------------------------------------------------------------------
    async getShot(shotId) {
        const shot = await queryOne('SELECT * FROM shots WHERE id = $1', [shotId]);
        if (!shot) {
            throw new NotFoundError('Shot');
        }
        return this.mapShotRow(shot);
    }
    mapProductionRow(row) {
        return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            logline: row.logline,
            synopsis: row.synopsis,
            studioId: row.studio_id,
            collaborators: [], // Loaded separately if needed
            genre: row.genre,
            tags: JSON.parse(row.tags || '[]'),
            rating: row.rating,
            status: row.status,
            currentPhase: row.current_phase || '',
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            releaseDate: row.release_date ? new Date(row.release_date) : undefined,
            shotCount: parseInt(row.shot_count || '0', 10),
            completedShotCount: parseInt(row.completed_shot_count || '0', 10),
            totalDuration: parseInt(row.total_duration || '0', 10),
            ScripterUrl: row.poster_url,
            trailerUrl: row.trailer_url,
            thumbnailUrl: row.thumbnail_url,
        };
    }
    mapShotRow(row) {
        return {
            id: row.id,
            productionId: row.production_id,
            sequenceIndex: parseInt(row.sequence_index, 10),
            promptText: row.prompt_text,
            negativePrompt: row.negative_prompt,
            aspectRatio: row.aspect_ratio,
            durationSec: parseInt(row.duration_sec || '5', 10),
            cameraMotion: row.camera_motion,
            status: row.status,
            outputUrl: row.output_url,
            thumbnailUrl: row.thumbnail_url,
            generationId: row.generation_id,
            scene: row.scene,
            notes: row.notes,
            version: parseInt(row.version || '1', 10),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            generatedAt: row.generated_at ? new Date(row.generated_at) : undefined,
            approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
            approvedBy: row.approved_by,
        };
    }
}
exports.ProductionService = ProductionService;
// =============================================================================
// Singleton Export
// =============================================================================
let serviceInstance = null;
function getProductionService() {
    if (!serviceInstance) {
        serviceInstance = new ProductionService();
    }
    return serviceInstance;
}
exports.default = ProductionService;
//# sourceMappingURL=ProductionService.js.map