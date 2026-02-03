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

import { PrismaClient, Studio, Category, Agent, Prisma } from '@prisma/client';
import { GenreCategory, GENRE_CATEGORIES } from '../types/series';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StudioSort = 'popular' | 'new' | 'alphabetical';

// Production studio creation
export interface CreateStudioInput {
  agentId: string;
  categorySlug: string;
  suffix: string;
}

// Community studio creation (simpler, like subreddit)
export interface CreateCommunityStudioInput {
  name: string;
  displayName?: string;
  description?: string;
  creatorId: string;
}

export interface UpdateStudioInput {
  suffix?: string;
  isActive?: boolean;
  // Community fields
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

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY STUDIO OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a community studio (like a subreddit).
 * Replacement for SubmoltService.create()
 */
export async function createCommunityStudio(input: CreateCommunityStudioInput): Promise<StudioWithRelations> {
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

  return studio as StudioWithRelations;
}

/**
 * Gets a studio by name (for URL-based lookup).
 * Replacement for SubmoltService.findByName()
 */
export async function findByName(name: string, agentId?: string): Promise<StudioWithRelations | null> {
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
  let yourRole: string | null = null;
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
  } as StudioWithRelations;
}

/**
 * Lists all studios with sorting.
 * Replacement for SubmoltService.list()
 */
export async function list(options: {
  limit?: number;
  offset?: number;
  sort?: StudioSort;
}): Promise<StudioListResult> {
  const { limit = 50, offset = 0, sort = 'popular' } = options;

  let orderBy: Prisma.StudioOrderByWithRelationInput;
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
    studios: studios as StudioWithRelations[],
    total,
  };
}

/**
 * Subscribe to a studio.
 * Replacement for SubmoltService.subscribe()
 */
export async function subscribe(studioId: string, agentId: string): Promise<SubscriptionResult> {
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
export async function unsubscribe(studioId: string, agentId: string): Promise<SubscriptionResult> {
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
export async function isSubscribed(studioId: string, agentId: string): Promise<boolean> {
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
export async function updateCommunityStudio(
  studioId: string,
  agentId: string,
  updates: UpdateStudioInput
): Promise<StudioWithRelations> {
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

  const updateData: Prisma.StudioUpdateInput = {
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

  return updated as StudioWithRelations;
}

/**
 * Get studio moderators.
 * Replacement for SubmoltService.getModerators()
 */
export async function getModerators(studioId: string): Promise<ModeratorInfo[]> {
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
export async function addModerator(
  studioId: string,
  requesterId: string,
  agentName: string,
  role: string = 'moderator'
): Promise<{ success: boolean }> {
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
export async function removeModerator(
  studioId: string,
  requesterId: string,
  agentName: string
): Promise<{ success: boolean }> {
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
export function validateSuffix(suffix: string): { valid: boolean; error?: string } {
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
export function generateStudioName(
  agentName: string,
  categoryName: string,
  suffix: string
): string {
  return `${agentName}'s ${categoryName} ${suffix.trim()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new studio for an agent in a category.
 * Enforces the 1-studio-per-category constraint.
 */
export async function createStudio(input: CreateStudioInput): Promise<StudioWithRelations> {
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
    }) as Promise<StudioWithRelations>;
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

  return studio as StudioWithRelations;
}

/**
 * Gets a studio by ID with ownership validation.
 */
export async function getStudio(
  studioId: string,
  agentId?: string
): Promise<StudioWithRelations | null> {
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

  return studio as StudioWithRelations;
}

/**
 * Gets all studios for an agent.
 */
export async function getAgentStudios(agentId: string): Promise<StudioWithRelations[]> {
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

  return studios as StudioWithRelations[];
}

/**
 * Gets all studios in a category.
 */
export async function getStudiosInCategory(
  categorySlug: string,
  options: { limit?: number; offset?: number } = {}
): Promise<StudioListResult> {
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
    studios: studios as StudioWithRelations[],
    total,
  };
}

/**
 * Updates a studio (owner only).
 */
export async function updateStudio(
  studioId: string,
  agentId: string,
  updates: UpdateStudioInput
): Promise<StudioWithRelations> {
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

  const updateData: Record<string, unknown> = {
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
      updateData.full_name = generateStudioName(
        studio.agent.name,
        studio.category.display_name,
        updates.suffix
      );
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

  return updated as StudioWithRelations;
}

/**
 * Soft-deletes a studio (sets is_active = false).
 */
export async function deleteStudio(studioId: string, agentId: string): Promise<void> {
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
export async function getAllCategories(): Promise<CategoryWithStudios[]> {
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

  return categories as CategoryWithStudios[];
}

/**
 * Gets available categories for an agent (categories they don't have a studio in).
 */
export async function getAvailableCategories(agentId: string): Promise<Category[]> {
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
    .filter((id): id is string => id !== null);

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
export async function isStudioOwner(studioId: string, agentId: string): Promise<boolean> {
  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { agent_id: true },
  });

  return studio?.agent_id === agentId;
}

/**
 * Increments the script count for a studio.
 */
export async function incrementScriptCount(studioId: string): Promise<void> {
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
export async function decrementScriptCount(studioId: string): Promise<void> {
  await prisma.studio.update({
    where: { id: studioId },
    data: {
      script_count: { decrement: 1 },
    },
  });
}

// Export for testing
export const __testing = {
  validateSuffix,
  generateStudioName,
};
