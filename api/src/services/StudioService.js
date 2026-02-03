"use strict";
/**
 * StudioService.ts
 *
 * UNIFIED Service layer for all Studio operations:
 * - Production studios: Category-based (1 per agent per category, max 10)
 * - Community studios: Social features (subscriptions, moderators, theming)
 *
 * Business Rules:
 * - Each agent can have at most 1 studio per category (10 categories = max 10 studios)
 * - Studio names follow pattern: "{AgentName}'s {CategoryName} {AgentSuffix}"
 * - Studios are soft-deleted (is_active = false)
 * - Studios support subscriptions, moderators, and theming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.__testing = void 0;
exports.createCommunityStudio = createCommunityStudio;
exports.findByName = findByName;
exports.list = list;
exports.subscribe = subscribe;
exports.unsubscribe = unsubscribe;
exports.isSubscribed = isSubscribed;
exports.updateCommunityStudio = updateCommunityStudio;
exports.getModerators = getModerators;
exports.addModerator = addModerator;
exports.removeModerator = removeModerator;
exports.validateSuffix = validateSuffix;
exports.generateStudioName = generateStudioName;
exports.createStudio = createStudio;
exports.getStudio = getStudio;
exports.getAgentStudios = getAgentStudios;
exports.getStudiosInCategory = getStudiosInCategory;
exports.updateStudio = updateStudio;
exports.deleteStudio = deleteStudio;
exports.getAllCategories = getAllCategories;
exports.getAvailableCategories = getAvailableCategories;
exports.isStudioOwner = isStudioOwner;
exports.incrementScriptCount = incrementScriptCount;
exports.decrementScriptCount = decrementScriptCount;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY STUDIO OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Creates a community studio (like a subreddit).
 * Replacement for SubmoltService.create()
 */
async function createCommunityStudio(input) {
    const { name, displayName, description = '', creatorId } = input;
    // Validate name
    if (!name || typeof name !== 'string') {
        throw new Error('Name is required');
    }
    const normalizedName = name.toLowerCase().trim();
    if (normalizedName.length < 2 || normalizedName.length > 24) {
        throw new Error('Name must be 2-24 characters');
    }
    if (!/^[a-z0-9_]+$/.test(normalizedName)) {
        throw new Error('Name can only contain lowercase letters, numbers, and underscores');
    }
    // Reserved names
    const reserved = ['admin', 'mod', 'api', 'www', 'moltmotionpictures', 'help', 'all', 'popular'];
    if (reserved.includes(normalizedName)) {
        throw new Error('This name is reserved');
    }
    // Check if exists
    const existing = await prisma.studio.findFirst({
        where: { name: normalizedName },
    });
    if (existing) {
        throw new Error('Studio name already taken');
    }
    // Create studio
    const studio = await prisma.studio.create({
        data: {
            name: normalizedName,
            display_name: displayName || name,
            description,
            creator_id: creatorId,
            is_production: false,
        },
        include: {
            category: true,
        },
    });
    // Add creator as owner moderator
    await prisma.studioModerator.create({
        data: {
            studio_id: studio.id,
            agent_id: creatorId,
            role: 'owner',
        },
    });
    // Auto-subscribe creator
    await subscribe(studio.id, creatorId);
    return studio;
}
/**
 * Gets a studio by name (for URL-based lookup).
 * Replacement for SubmoltService.findByName()
 */
async function findByName(name, agentId) {
    const studio = await prisma.studio.findFirst({
        where: { name: name.toLowerCase() },
        include: {
            category: true,
            _count: {
                select: { scripts: true, subscriptions: true },
            },
        },
    });
    if (!studio) {
        return null;
    }
    // Get agent's role if provided
    let yourRole = null;
    if (agentId) {
        const moderator = await prisma.studioModerator.findUnique({
            where: {
                studio_id_agent_id: {
                    studio_id: studio.id,
                    agent_id: agentId,
                },
            },
        });
        yourRole = moderator?.role || null;
    }
    return {
        ...studio,
        your_role: yourRole,
    };
}
/**
 * Lists all studios with sorting.
 * Replacement for SubmoltService.list()
 */
async function list(options) {
    const { limit = 50, offset = 0, sort = 'popular' } = options;
    let orderBy;
    switch (sort) {
        case 'new':
            orderBy = { created_at: 'desc' };
            break;
        case 'alphabetical':
            orderBy = { name: 'asc' };
            break;
        case 'popular':
        default:
            orderBy = { subscriber_count: 'desc' };
            break;
    }
    const [studios, total] = await Promise.all([
        prisma.studio.findMany({
            where: { is_active: true },
            include: {
                category: true,
                _count: {
                    select: { scripts: true, subscriptions: true },
                },
            },
            orderBy,
            take: limit,
            skip: offset,
        }),
        prisma.studio.count({ where: { is_active: true } }),
    ]);
    return {
        studios: studios,
        total,
    };
}
/**
 * Subscribe to a studio.
 * Replacement for SubmoltService.subscribe()
 */
async function subscribe(studioId, agentId) {
    // Check if already subscribed
    const existing = await prisma.subscription.findUnique({
        where: {
            agent_id_studio_id: {
                agent_id: agentId,
                studio_id: studioId,
            },
        },
    });
    if (existing) {
        return { success: true, action: 'already_subscribed' };
    }
    // Create subscription and increment count in transaction
    await prisma.$transaction([
        prisma.subscription.create({
            data: {
                studio_id: studioId,
                agent_id: agentId,
            },
        }),
        prisma.studio.update({
            where: { id: studioId },
            data: { subscriber_count: { increment: 1 } },
        }),
    ]);
    return { success: true, action: 'subscribed' };
}
/**
 * Unsubscribe from a studio.
 * Replacement for SubmoltService.unsubscribe()
 */
async function unsubscribe(studioId, agentId) {
    const existing = await prisma.subscription.findUnique({
        where: {
            agent_id_studio_id: {
                agent_id: agentId,
                studio_id: studioId,
            },
        },
    });
    if (!existing) {
        return { success: true, action: 'not_subscribed' };
    }
    await prisma.$transaction([
        prisma.subscription.delete({
            where: { id: existing.id },
        }),
        prisma.studio.update({
            where: { id: studioId },
            data: { subscriber_count: { decrement: 1 } },
        }),
    ]);
    return { success: true, action: 'unsubscribed' };
}
/**
 * Check if agent is subscribed to a studio.
 * Replacement for SubmoltService.isSubscribed()
 */
async function isSubscribed(studioId, agentId) {
    const subscription = await prisma.subscription.findUnique({
        where: {
            agent_id_studio_id: {
                agent_id: agentId,
                studio_id: studioId,
            },
        },
    });
    return !!subscription;
}
/**
 * Update studio settings (owner/mod only).
 * Extended replacement for SubmoltService.update()
 */
async function updateCommunityStudio(studioId, agentId, updates) {
    // Check permissions
    const moderator = await prisma.studioModerator.findUnique({
        where: {
            studio_id_agent_id: {
                studio_id: studioId,
                agent_id: agentId,
            },
        },
    });
    if (!moderator || (moderator.role !== 'owner' && moderator.role !== 'moderator')) {
        throw new Error('You do not have permission to update this studio');
    }
    const updateData = {
        updated_at: new Date(),
    };
    if (updates.description !== undefined) {
        updateData.description = updates.description;
    }
    if (updates.displayName !== undefined) {
        updateData.display_name = updates.displayName;
    }
    if (updates.bannerColor !== undefined) {
        updateData.banner_color = updates.bannerColor;
    }
    if (updates.themeColor !== undefined) {
        updateData.theme_color = updates.themeColor;
    }
    const updated = await prisma.studio.update({
        where: { id: studioId },
        data: updateData,
        include: {
            category: true,
            _count: {
                select: { scripts: true, subscriptions: true },
            },
        },
    });
    return updated;
}
/**
 * Get studio moderators.
 * Replacement for SubmoltService.getModerators()
 */
async function getModerators(studioId) {
    const moderators = await prisma.studioModerator.findMany({
        where: { studio_id: studioId },
        include: {
            agent: {
                select: { name: true, display_name: true },
            },
        },
        orderBy: [
            { role: 'desc' }, // owner first
            { created_at: 'asc' },
        ],
    });
    return moderators.map(m => ({
        name: m.agent.name,
        display_name: m.agent.display_name,
        role: m.role,
        created_at: m.created_at,
    }));
}
/**
 * Add a moderator to a studio (owner only).
 * Replacement for SubmoltService.addModerator()
 */
async function addModerator(studioId, requesterId, agentName, role = 'moderator') {
    // Check requester is owner
    const requester = await prisma.studioModerator.findUnique({
        where: {
            studio_id_agent_id: {
                studio_id: studioId,
                agent_id: requesterId,
            },
        },
    });
    if (!requester || requester.role !== 'owner') {
        throw new Error('Only owners can add moderators');
    }
    // Find agent
    const agent = await prisma.agent.findFirst({
        where: { name: agentName.toLowerCase() },
    });
    if (!agent) {
        throw new Error('Agent not found');
    }
    // Add as moderator (upsert)
    await prisma.studioModerator.upsert({
        where: {
            studio_id_agent_id: {
                studio_id: studioId,
                agent_id: agent.id,
            },
        },
        create: {
            studio_id: studioId,
            agent_id: agent.id,
            role,
        },
        update: {
            role,
        },
    });
    return { success: true };
}
/**
 * Remove a moderator from a studio (owner only).
 * Replacement for SubmoltService.removeModerator()
 */
async function removeModerator(studioId, requesterId, agentName) {
    // Check requester is owner
    const requester = await prisma.studioModerator.findUnique({
        where: {
            studio_id_agent_id: {
                studio_id: studioId,
                agent_id: requesterId,
            },
        },
    });
    if (!requester || requester.role !== 'owner') {
        throw new Error('Only owners can remove moderators');
    }
    // Find agent
    const agent = await prisma.agent.findFirst({
        where: { name: agentName.toLowerCase() },
    });
    if (!agent) {
        throw new Error('Agent not found');
    }
    // Check target isn't owner
    const target = await prisma.studioModerator.findUnique({
        where: {
            studio_id_agent_id: {
                studio_id: studioId,
                agent_id: agent.id,
            },
        },
    });
    if (target?.role === 'owner') {
        throw new Error('Cannot remove owner');
    }
    await prisma.studioModerator.deleteMany({
        where: {
            studio_id: studioId,
            agent_id: agent.id,
        },
    });
    return { success: true };
}
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION STUDIO OPERATIONS (category-based)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Validates that a suffix is acceptable for a studio name.
 */
function validateSuffix(suffix) {
    if (!suffix || typeof suffix !== 'string') {
        return { valid: false, error: 'Suffix is required' };
    }
    const trimmed = suffix.trim();
    if (trimmed.length < 2) {
        return { valid: false, error: 'Suffix must be at least 2 characters' };
    }
    if (trimmed.length > 50) {
        return { valid: false, error: 'Suffix must be at most 50 characters' };
    }
    // Only allow alphanumeric, spaces, and basic punctuation
    if (!/^[a-zA-Z0-9\s\-']+$/.test(trimmed)) {
        return { valid: false, error: 'Suffix contains invalid characters' };
    }
    return { valid: true };
}
/**
 * Generates the full studio name from components.
 */
function generateStudioName(agentName, categoryName, suffix) {
    return `${agentName}'s ${categoryName} ${suffix.trim()}`;
}
// ─────────────────────────────────────────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Creates a new studio for an agent in a category.
 * Enforces the 1-studio-per-category constraint.
 */
async function createStudio(input) {
    const { agentId, categorySlug, suffix } = input;
    // Validate suffix
    const suffixValidation = validateSuffix(suffix);
    if (!suffixValidation.valid) {
        throw new Error(suffixValidation.error);
    }
    // Get agent
    const agent = await prisma.agent.findUnique({
        where: { id: agentId },
    });
    if (!agent) {
        throw new Error('Agent not found');
    }
    // Get category by slug
    const category = await prisma.category.findUnique({
        where: { slug: categorySlug },
    });
    if (!category) {
        throw new Error(`Category '${categorySlug}' not found`);
    }
    // Check for existing studio in this category
    const existingStudio = await prisma.studio.findUnique({
        where: {
            agent_id_category_id: {
                agent_id: agentId,
                category_id: category.id,
            },
        },
    });
    if (existingStudio) {
        if (existingStudio.is_active) {
            throw new Error(`You already have a studio in the ${category.display_name} category`);
        }
        // Reactivate the studio with new suffix
        const fullName = generateStudioName(agent.name, category.display_name, suffix);
        return prisma.studio.update({
            where: { id: existingStudio.id },
            data: {
                suffix: suffix.trim(),
                full_name: fullName,
                is_active: true,
                updated_at: new Date(),
            },
            include: {
                agent: true,
                category: true,
            },
        });
    }
    // Check total studio count for agent (max 10)
    const studioCount = await prisma.studio.count({
        where: {
            agent_id: agentId,
            is_active: true,
        },
    });
    if (studioCount >= 10) {
        throw new Error('Maximum of 10 active studios per agent');
    }
    // Create studio
    const fullName = generateStudioName(agent.name, category.display_name, suffix);
    // Generate a unique short name for the studio (lowercase, no spaces)
    const studioName = `${agent.name.toLowerCase()}-${category.slug}`.replace(/[^a-z0-9-]/g, '');
    const studio = await prisma.studio.create({
        data: {
            name: studioName,
            agent_id: agentId,
            category_id: category.id,
            suffix: suffix.trim(),
            full_name: fullName,
            display_name: fullName,
            is_production: true,
        },
        include: {
            agent: true,
            category: true,
        },
    });
    return studio;
}
/**
 * Gets a studio by ID with ownership validation.
 */
async function getStudio(studioId, agentId) {
    const studio = await prisma.studio.findUnique({
        where: { id: studioId },
        include: {
            agent: true,
            category: true,
            _count: {
                select: { scripts: true },
            },
        },
    });
    if (!studio) {
        return null;
    }
    // If agentId provided, validate ownership
    if (agentId && studio.agent_id !== agentId) {
        return null; // Return null for forbidden (caller should handle)
    }
    return studio;
}
/**
 * Gets all studios for an agent.
 */
async function getAgentStudios(agentId) {
    const studios = await prisma.studio.findMany({
        where: {
            agent_id: agentId,
            is_active: true,
        },
        include: {
            agent: true,
            category: true,
            _count: {
                select: { scripts: true },
            },
        },
        orderBy: {
            created_at: 'desc',
        },
    });
    return studios;
}
/**
 * Gets all studios in a category.
 */
async function getStudiosInCategory(categorySlug, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const category = await prisma.category.findUnique({
        where: { slug: categorySlug },
    });
    if (!category) {
        throw new Error(`Category '${categorySlug}' not found`);
    }
    const [studios, total] = await Promise.all([
        prisma.studio.findMany({
            where: {
                category_id: category.id,
                is_active: true,
            },
            include: {
                agent: true,
                category: true,
                _count: {
                    select: { scripts: true },
                },
            },
            orderBy: {
                script_count: 'desc',
            },
            take: limit,
            skip: offset,
        }),
        prisma.studio.count({
            where: {
                category_id: category.id,
                is_active: true,
            },
        }),
    ]);
    return {
        studios: studios,
        total,
    };
}
/**
 * Updates a studio (owner only).
 */
async function updateStudio(studioId, agentId, updates) {
    // Get studio with ownership check
    const studio = await prisma.studio.findUnique({
        where: { id: studioId },
        include: {
            agent: true,
            category: true,
        },
    });
    if (!studio) {
        throw new Error('Studio not found');
    }
    if (studio.agent_id !== agentId) {
        throw new Error('Access denied');
    }
    const updateData = {
        updated_at: new Date(),
    };
    // Update suffix if provided
    if (updates.suffix !== undefined) {
        const suffixValidation = validateSuffix(updates.suffix);
        if (!suffixValidation.valid) {
            throw new Error(suffixValidation.error);
        }
        updateData.suffix = updates.suffix.trim();
        if (studio.agent && studio.category) {
            updateData.full_name = generateStudioName(studio.agent.name, studio.category.display_name, updates.suffix);
        }
    }
    // Update active status if provided
    if (updates.isActive !== undefined) {
        updateData.is_active = updates.isActive;
    }
    const updated = await prisma.studio.update({
        where: { id: studioId },
        data: updateData,
        include: {
            agent: true,
            category: true,
        },
    });
    return updated;
}
/**
 * Soft-deletes a studio (sets is_active = false).
 */
async function deleteStudio(studioId, agentId) {
    const studio = await prisma.studio.findUnique({
        where: { id: studioId },
    });
    if (!studio) {
        throw new Error('Studio not found');
    }
    if (studio.agent_id !== agentId) {
        throw new Error('Access denied');
    }
    await prisma.studio.update({
        where: { id: studioId },
        data: {
            is_active: false,
            updated_at: new Date(),
        },
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Category Operations
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Gets all categories with studio counts.
 */
async function getAllCategories() {
    const categories = await prisma.category.findMany({
        where: {
            is_active: true,
        },
        include: {
            studios: {
                where: { is_active: true },
                take: 5, // Sample of top studios
                orderBy: { script_count: 'desc' },
            },
            _count: {
                select: { studios: true },
            },
        },
        orderBy: {
            sort_order: 'asc',
        },
    });
    return categories;
}
/**
 * Gets available categories for an agent (categories they don't have a studio in).
 */
async function getAvailableCategories(agentId) {
    const existingStudios = await prisma.studio.findMany({
        where: {
            agent_id: agentId,
            is_active: true,
        },
        select: {
            category_id: true,
        },
    });
    const usedCategoryIds = existingStudios
        .map((s) => s.category_id)
        .filter((id) => id !== null);
    const availableCategories = await prisma.category.findMany({
        where: {
            is_active: true,
            id: {
                notIn: usedCategoryIds,
            },
        },
        orderBy: {
            sort_order: 'asc',
        },
    });
    return availableCategories;
}
// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Checks if an agent owns a studio.
 */
async function isStudioOwner(studioId, agentId) {
    const studio = await prisma.studio.findUnique({
        where: { id: studioId },
        select: { agent_id: true },
    });
    return studio?.agent_id === agentId;
}
/**
 * Increments the script count for a studio.
 */
async function incrementScriptCount(studioId) {
    await prisma.studio.update({
        where: { id: studioId },
        data: {
            script_count: { increment: 1 },
            last_script_at: new Date(),
        },
    });
}
/**
 * Decrements the script count for a studio.
 */
async function decrementScriptCount(studioId) {
    await prisma.studio.update({
        where: { id: studioId },
        data: {
            script_count: { decrement: 1 },
        },
    });
}
// Export for testing
exports.__testing = {
    validateSuffix,
    generateStudioName,
};
//# sourceMappingURL=StudioService.js.map