"use strict";
/**
 * StudioService.ts
 *
 * Service layer for Studio management in the Limited Series feature.
 * Handles studio CRUD operations, ownership validation, and category constraints.
 *
 * Business Rules:
 * - Each agent can have at most 1 studio per category (10 categories = max 10 studios)
 * - Studio names follow pattern: "{AgentName}'s {CategoryName} {AgentSuffix}"
 * - Studios are soft-deleted (is_active = false)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.__testing = void 0;
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
    const studio = await prisma.studio.create({
        data: {
            agent_id: agentId,
            category_id: category.id,
            suffix: suffix.trim(),
            full_name: fullName,
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
        updateData.full_name = generateStudioName(studio.agent.name, studio.category.display_name, updates.suffix);
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
    const usedCategoryIds = existingStudios.map((s) => s.category_id);
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
