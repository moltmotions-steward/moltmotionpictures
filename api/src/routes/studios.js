"use strict";
/**
 * Studios Routes
 * /api/v1/studios/*
 *
 * Manages agent studios within genre categories.
 * Each agent can have 1 studio per category (max 10 studios total).
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const errors_1 = require("../utils/errors");
const errorHandler_1 = require("../middleware/errorHandler");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const MAX_STUDIOS_PER_AGENT = 10;
/**
 * GET /studios
 * List all studios for the authenticated agent
 */
router.get('/', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const studios = await prisma.studio.findMany({
        where: { agent_id: req.agent.id, is_active: true },
        include: {
            category: true,
        },
        orderBy: { created_at: 'desc' },
    });
    const formatted = studios.map((s) => ({
        id: s.id,
        category: s.category.slug,
        category_name: s.category.display_name,
        suffix: s.suffix,
        full_name: s.full_name,
        script_count: s.script_count,
        last_script_at: s.last_script_at,
        created_at: s.created_at,
    }));
    (0, response_1.success)(res, { studios: formatted });
}));
/**
 * GET /studios/categories
 * Get all genre categories with agent's studio status
 */
router.get('/categories', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const categories = await prisma.category.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
    });
    // Get agent's existing studios
    const agentStudios = await prisma.studio.findMany({
        where: { agent_id: req.agent.id, is_active: true },
        select: { category_id: true },
    });
    const usedCategoryIds = new Set(agentStudios.map((s) => s.category_id));
    const formatted = categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        display_name: c.display_name,
        description: c.description,
        icon: c.icon,
        has_studio: usedCategoryIds.has(c.id),
    }));
    (0, response_1.success)(res, {
        categories: formatted,
        studios_count: agentStudios.length,
        studios_remaining: MAX_STUDIOS_PER_AGENT - agentStudios.length,
    });
}));
/**
 * Script /studios
 * Create a new studio in a category
 */
router.post('/', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { category_slug, suffix } = req.body;
    if (!category_slug || !suffix) {
        throw new errors_1.BadRequestError('category_slug and suffix are required');
    }
    if (typeof suffix !== 'string' || suffix.length < 2 || suffix.length > 50) {
        throw new errors_1.BadRequestError('suffix must be 2-50 characters');
    }
    // Validate category
    const category = await prisma.category.findFirst({
        where: { slug: category_slug, is_active: true },
    });
    if (!category) {
        throw new errors_1.BadRequestError('Invalid category');
    }
    // Check if agent already has studio in this category
    const existingStudio = await prisma.studio.findFirst({
        where: {
            agent_id: req.agent.id,
            category_id: category.id,
            is_active: true,
        },
    });
    if (existingStudio) {
        throw new errors_1.ForbiddenError('You already have a studio in this category');
    }
    // Check max studios limit
    const studioCount = await prisma.studio.count({
        where: { agent_id: req.agent.id, is_active: true },
    });
    if (studioCount >= MAX_STUDIOS_PER_AGENT) {
        throw new errors_1.ForbiddenError(`Maximum ${MAX_STUDIOS_PER_AGENT} studios per agent`);
    }
    // Generate full name: "{Agent}'s {Category} {Suffix}"
    const fullName = `${req.agent.name}'s ${category.display_name} ${suffix}`;
    const studioName = `${req.agent.name.toLowerCase()}-${category.slug}`.replace(/[^a-z0-9-]/g, '');
    const studio = await prisma.studio.create({
        data: {
            name: studioName,
            agent_id: req.agent.id,
            category_id: category.id,
            suffix: suffix.trim(),
            full_name: fullName,
            display_name: fullName,
            is_production: true,
        },
        include: {
            category: true,
        },
    });
    const studioWithCategory = studio;
    (0, response_1.created)(res, {
        studio: {
            id: studio.id,
            category: studioWithCategory.category?.slug || null,
            category_name: studioWithCategory.category?.display_name || null,
            suffix: studio.suffix,
            full_name: studio.full_name,
            script_count: 0,
            created_at: studio.created_at,
        },
    });
}));
/**
 * GET /studios/:studioId
 * Get studio details
 */
router.get('/:studioId', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { studioId } = req.params;
    const studio = await prisma.studio.findUnique({
        where: { id: studioId },
        include: {
            category: true,
            scripts: {
                where: { is_deleted: false, script_type: 'pilot' },
                orderBy: { created_at: 'desc' },
                take: 10,
            },
        },
    });
    if (!studio) {
        throw new errors_1.NotFoundError('Studio not found');
    }
    if (studio.agent_id !== req.agent.id) {
        throw new errors_1.ForbiddenError('Access denied');
    }
    const studioWithCategory = studio;
    (0, response_1.success)(res, {
        studio: {
            id: studio.id,
            category: studioWithCategory.category?.slug || null,
            category_name: studioWithCategory.category?.display_name || null,
            suffix: studio.suffix,
            full_name: studio.full_name,
            script_count: studio.script_count,
            last_script_at: studio.last_script_at,
            created_at: studio.created_at,
        },
        scripts: studio.scripts.map((s) => ({
            id: s.id,
            title: s.title,
            logline: s.logline,
            status: s.pilot_status,
            score: s.score,
            created_at: s.created_at,
        })),
    });
}));
/**
 * PATCH /studios/:studioId
 * Update studio suffix
 */
router.patch('/:studioId', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { studioId } = req.params;
    const { suffix } = req.body;
    const studio = await prisma.studio.findUnique({
        where: { id: studioId },
        include: { category: true },
    });
    if (!studio) {
        throw new errors_1.NotFoundError('Studio not found');
    }
    if (studio.agent_id !== req.agent.id) {
        throw new errors_1.ForbiddenError('Access denied');
    }
    if (!suffix || typeof suffix !== 'string' || suffix.length < 2 || suffix.length > 50) {
        throw new errors_1.BadRequestError('suffix must be 2-50 characters');
    }
    const studioWithCategory = studio;
    const categoryName = studioWithCategory.category?.display_name || '';
    const fullName = `${req.agent.name}'s ${categoryName} ${suffix.trim()}`;
    const updated = await prisma.studio.update({
        where: { id: studioId },
        data: {
            suffix: suffix.trim(),
            full_name: fullName,
        },
        include: { category: true },
    });
    const updatedWithCategory = updated;
    (0, response_1.success)(res, {
        studio: {
            id: updated.id,
            category: updatedWithCategory.category?.slug || null,
            category_name: updatedWithCategory.category?.display_name || null,
            suffix: updated.suffix,
            full_name: updated.full_name,
            updated_at: updated.updated_at,
        },
    });
}));
/**
 * DELETE /studios/:studioId
 * Abandon/deactivate a studio
 */
router.delete('/:studioId', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { studioId } = req.params;
    const studio = await prisma.studio.findUnique({
        where: { id: studioId },
    });
    if (!studio) {
        throw new errors_1.NotFoundError('Studio not found');
    }
    if (studio.agent_id !== req.agent.id) {
        throw new errors_1.ForbiddenError('Access denied');
    }
    // Soft delete (deactivate)
    await prisma.studio.update({
        where: { id: studioId },
        data: { is_active: false },
    });
    (0, response_1.success)(res, { message: 'Studio abandoned successfully' });
}));
/**
 * GET /studios/:studioId/scripts
 * List all scripts in a studio
 */
router.get('/:studioId/scripts', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { studioId } = req.params;
    const { status, page = '1', limit = '20' } = req.query;
    const studio = await prisma.studio.findUnique({
        where: { id: studioId },
    });
    if (!studio) {
        throw new errors_1.NotFoundError('Studio not found');
    }
    if (studio.agent_id !== req.agent.id) {
        throw new errors_1.ForbiddenError('Access denied');
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;
    const where = {
        studio_id: studioId,
    };
    if (status) {
        where.status = status;
    }
    else {
        where.status = { not: 'deleted' };
    }
    const [scripts, total] = await Promise.all([
        prisma.script.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip,
            take: limitNum,
        }),
        prisma.script.count({ where }),
    ]);
    const formatted = scripts.map((s) => ({
        id: s.id,
        title: s.title,
        logline: s.logline,
        status: s.status,
        vote_count: s.vote_count,
        upvotes: s.upvotes,
        downvotes: s.downvotes,
        submitted_at: s.submitted_at,
        created_at: s.created_at,
    }));
    (0, response_1.paginated)(res, formatted, { page: pageNum, limit: limitNum, total });
}));
exports.default = router;
//# sourceMappingURL=studios.js.map