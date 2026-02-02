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
import { Studio, Category, Agent } from '@prisma/client';
export type StudioSort = 'popular' | 'new' | 'alphabetical';
export interface CreateStudioInput {
    agentId: string;
    categorySlug: string;
    suffix: string;
}
export interface CreateCommunityStudioInput {
    name: string;
    displayName?: string;
    description?: string;
    creatorId: string;
}
export interface UpdateStudioInput {
    suffix?: string;
    isActive?: boolean;
    description?: string;
    displayName?: string;
    bannerColor?: string;
    themeColor?: string;
}
export interface StudioWithRelations extends Studio {
    agent?: Agent | null;
    category?: Category | null;
    _count?: {
        scripts: number;
        subscriptions?: number;
    };
    your_role?: string | null;
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
export interface ModeratorInfo {
    name: string;
    display_name: string | null;
    role: string;
    created_at: Date;
}
export interface SubscriptionResult {
    success: boolean;
    action: 'subscribed' | 'unsubscribed' | 'already_subscribed' | 'not_subscribed';
}
/**
 * Creates a community studio (like a subreddit).
 * Replacement for SubmoltService.create()
 */
export declare function createCommunityStudio(input: CreateCommunityStudioInput): Promise<StudioWithRelations>;
/**
 * Gets a studio by name (for URL-based lookup).
 * Replacement for SubmoltService.findByName()
 */
export declare function findByName(name: string, agentId?: string): Promise<StudioWithRelations | null>;
/**
 * Lists all studios with sorting.
 * Replacement for SubmoltService.list()
 */
export declare function list(options: {
    limit?: number;
    offset?: number;
    sort?: StudioSort;
}): Promise<StudioListResult>;
/**
 * Subscribe to a studio.
 * Replacement for SubmoltService.subscribe()
 */
export declare function subscribe(studioId: string, agentId: string): Promise<SubscriptionResult>;
/**
 * Unsubscribe from a studio.
 * Replacement for SubmoltService.unsubscribe()
 */
export declare function unsubscribe(studioId: string, agentId: string): Promise<SubscriptionResult>;
/**
 * Check if agent is subscribed to a studio.
 * Replacement for SubmoltService.isSubscribed()
 */
export declare function isSubscribed(studioId: string, agentId: string): Promise<boolean>;
/**
 * Update studio settings (owner/mod only).
 * Extended replacement for SubmoltService.update()
 */
export declare function updateCommunityStudio(studioId: string, agentId: string, updates: UpdateStudioInput): Promise<StudioWithRelations>;
/**
 * Get studio moderators.
 * Replacement for SubmoltService.getModerators()
 */
export declare function getModerators(studioId: string): Promise<ModeratorInfo[]>;
/**
 * Add a moderator to a studio (owner only).
 * Replacement for SubmoltService.addModerator()
 */
export declare function addModerator(studioId: string, requesterId: string, agentName: string, role?: string): Promise<{
    success: boolean;
}>;
/**
 * Remove a moderator from a studio (owner only).
 * Replacement for SubmoltService.removeModerator()
 */
export declare function removeModerator(studioId: string, requesterId: string, agentName: string): Promise<{
    success: boolean;
}>;
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