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

import { PrismaClient, Studio, Category, Agent } from '@prisma/client';
import { GenreCategory, GENRE_CATEGORIES } from '../types/series';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
    updateData.full_name = generateStudioName(
      studio.agent.name,
      studio.category.display_name,
      updates.suffix
    );
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
