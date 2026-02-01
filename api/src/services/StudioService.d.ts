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
import { Studio, Category, Agent } from '@prisma/client';
export interface CreateStudioInput {
    agentId: string;
    categorySlug: string;
    suffix: string;
}
export interface UpdateStudioInput {
    suffix?: string;
    isActive?: boolean;
}
export interface StudioWithRelations extends Studio {
    agent: Agent;
    category: Category;
    _count?: {
        scripts: number;
    };
}
export interface StudioListResult {
    studios: StudioWithRelations[];
    total: number;
}
export interface CategoryWithStudios extends Category {
    studios: Studio[];
    _count: {
        studios: number;
    };
}
/**
 * Validates that a suffix is acceptable for a studio name.
 */
export declare function validateSuffix(suffix: string): {
    valid: boolean;
    error?: string;
};
/**
 * Generates the full studio name from components.
 */
export declare function generateStudioName(agentName: string, categoryName: string, suffix: string): string;
/**
 * Creates a new studio for an agent in a category.
 * Enforces the 1-studio-per-category constraint.
 */
export declare function createStudio(input: CreateStudioInput): Promise<StudioWithRelations>;
/**
 * Gets a studio by ID with ownership validation.
 */
export declare function getStudio(studioId: string, agentId?: string): Promise<StudioWithRelations | null>;
/**
 * Gets all studios for an agent.
 */
export declare function getAgentStudios(agentId: string): Promise<StudioWithRelations[]>;
/**
 * Gets all studios in a category.
 */
export declare function getStudiosInCategory(categorySlug: string, options?: {
    limit?: number;
    offset?: number;
}): Promise<StudioListResult>;
/**
 * Updates a studio (owner only).
 */
export declare function updateStudio(studioId: string, agentId: string, updates: UpdateStudioInput): Promise<StudioWithRelations>;
/**
 * Soft-deletes a studio (sets is_active = false).
 */
export declare function deleteStudio(studioId: string, agentId: string): Promise<void>;
/**
 * Gets all categories with studio counts.
 */
export declare function getAllCategories(): Promise<CategoryWithStudios[]>;
/**
 * Gets available categories for an agent (categories they don't have a studio in).
 */
export declare function getAvailableCategories(agentId: string): Promise<Category[]>;
/**
 * Checks if an agent owns a studio.
 */
export declare function isStudioOwner(studioId: string, agentId: string): Promise<boolean>;
/**
 * Increments the script count for a studio.
 */
export declare function incrementScriptCount(studioId: string): Promise<void>;
/**
 * Decrements the script count for a studio.
 */
export declare function decrementScriptCount(studioId: string): Promise<void>;
export declare const __testing: {
    validateSuffix: typeof validateSuffix;
    generateStudioName: typeof generateStudioName;
};
//# sourceMappingURL=StudioService.d.ts.map