import { getAuthUserId } from '@convex-dev/auth/server'
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server'

export type Role = 'admin' | 'moderator' | 'user'

export async function requireUser(ctx: MutationCtx | QueryCtx) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error('Unauthorized')
  const user = await ctx.db.get(userId)
  if (!user || user.deletedAt) throw new Error('User not found')
  return { userId, user }
}

export async function requireUserFromAction(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error('Unauthorized')
  const user = await ctx.runQuery(internal.users.getByIdInternal, { userId })
  if (!user || user.deletedAt) throw new Error('User not found')
  return { userId, user: user as Doc<'users'> }
}

export function assertRole(user: Doc<'users'>, allowed: Role[]) {
  if (!user.role || !allowed.includes(user.role as Role)) {
    throw new Error('Forbidden')
  }
}

export function assertAdmin(user: Doc<'users'>) {
  assertRole(user, ['admin'])
}

export function assertModerator(user: Doc<'users'>) {
  assertRole(user, ['admin', 'moderator'])
}

/**
 * MODERATION ENFORCEMENT
 * These functions ensure skills are not served if flagged for moderation.
 * Must be called on ALL public-facing endpoints that serve skill data.
 */

export type ModerationStatus = 'active' | 'hidden' | 'pending' | 'rejected' | 'removed'

export type SkillForModeration = {
  softDeletedAt?: number
  moderationStatus?: ModerationStatus
  moderationFlags?: string[]
}

/**
 * Check if a skill should be blocked from public access.
 * Returns null if skill is accessible, or an error message if blocked.
 */
export function checkSkillModeration(skill: SkillForModeration | null | undefined): string | null {
  if (!skill) return 'Skill not found'
  if (skill.softDeletedAt) return 'Skill not found'
  
  // Block if moderation status is not active
  if (skill.moderationStatus && skill.moderationStatus !== 'active') {
    return 'Skill is not available'
  }
  
  // Block if flagged for malware, abuse, or other critical flags
  const blockedFlags = ['blocked.malware', 'blocked.abuse', 'blocked.tos', 'blocked.dmca']
  if (skill.moderationFlags?.some(flag => blockedFlags.includes(flag))) {
    return 'Skill has been removed for policy violation'
  }
  
  return null // Skill is accessible
}

/**
 * Assert that a skill passes moderation checks.
 * Throws an error if the skill should not be served.
 */
export function assertSkillModeration(skill: SkillForModeration | null | undefined): void {
  const error = checkSkillModeration(skill)
  if (error) throw new Error(error)
}
