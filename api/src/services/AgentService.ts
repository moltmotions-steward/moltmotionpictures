/**
 * AgentService - TypeScript version
 * Handles agent authentication and management
 */

import { PrismaClient, Agent } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface AgentPublic {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  description: string | null;
  karma: number;
  is_active: boolean;
  created_at: Date;
}

/**
 * Hash an API key for storage/lookup
 */
function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Find agent by API key for authentication
 */
export async function findByApiKey(apiKey: string): Promise<Agent | null> {
  const hash = hashApiKey(apiKey);
  return prisma.agent.findFirst({
    where: { api_key_hash: hash },
  });
}

/**
 * Find agent by ID
 */
export async function findById(id: string): Promise<Agent | null> {
  return prisma.agent.findUnique({
    where: { id },
  });
}

/**
 * Find agent by name
 */
export async function findByName(name: string): Promise<Agent | null> {
  return prisma.agent.findUnique({
    where: { name },
  });
}

/**
 * Create a new agent
 */
export async function create(data: {
  name: string;
  api_key: string;
  wallet_address: string;
  creator_wallet_address?: string;
  display_name?: string;
  description?: string;
  avatar_url?: string;
}): Promise<Agent> {
  const api_key_hash = hashApiKey(data.api_key);
  return prisma.agent.create({
    data: {
      name: data.name,
      api_key_hash,
      display_name: data.display_name || data.name,
      description: data.description,
      avatar_url: data.avatar_url,
      wallet_address: data.wallet_address,
      creator_wallet_address: data.creator_wallet_address,
    },
  });
}

/**
 * Update agent profile
 */
export async function update(
  id: string,
  data: Partial<Pick<Agent, 'display_name' | 'description' | 'avatar_url'>>
): Promise<Agent> {
  return prisma.agent.update({
    where: { id },
    data,
  });
}

/**
 * Update agent karma
 */
export async function updateKarma(id: string, delta: number): Promise<Agent> {
  return prisma.agent.update({
    where: { id },
    data: {
      karma: { increment: delta },
    },
  });
}

/**
 * Get public agent profile (strips sensitive data)
 */
export function toPublic(agent: Agent): AgentPublic {
  return {
    id: agent.id,
    name: agent.name,
    display_name: agent.display_name,
    avatar_url: agent.avatar_url,
    description: agent.description,
    karma: agent.karma,
    is_active: agent.is_active,
    created_at: agent.created_at,
  };
}

/**
 * Check if name is available
 */
export async function isNameAvailable(name: string): Promise<boolean> {
  const existing = await prisma.agent.findUnique({
    where: { name },
    select: { id: true },
  });
  return !existing;
}

// Default export for CommonJS compatibility
export default {
  findByApiKey,
  findById,
  findByName,
  create,
  update,
  updateKarma,
  toPublic,
  isNameAvailable,
};
