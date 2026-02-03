import { describe, expect, it } from 'vitest'
import { assertSkillModeration, checkSkillModeration } from './access'

describe('Moderation Enforcement', () => {
  describe('checkSkillModeration', () => {
    it('returns null for active skills', () => {
      const skill = { moderationStatus: 'active' as const }
      expect(checkSkillModeration(skill)).toBeNull()
    })

    it('returns null for skills without moderation status (default active)', () => {
      const skill = {}
      expect(checkSkillModeration(skill)).toBeNull()
    })

    it('returns error for null/undefined skill', () => {
      expect(checkSkillModeration(null)).toBe('Skill not found')
      expect(checkSkillModeration(undefined)).toBe('Skill not found')
    })

    it('returns error for soft-deleted skills', () => {
      const skill = { softDeletedAt: Date.now() }
      expect(checkSkillModeration(skill)).toBe('Skill not found')
    })

    it('returns error for hidden skills', () => {
      const skill = { moderationStatus: 'hidden' as const }
      expect(checkSkillModeration(skill)).toBe('Skill is not available')
    })

    it('returns error for pending skills', () => {
      const skill = { moderationStatus: 'pending' as const }
      expect(checkSkillModeration(skill)).toBe('Skill is not available')
    })

    it('returns error for rejected skills', () => {
      const skill = { moderationStatus: 'rejected' as const }
      expect(checkSkillModeration(skill)).toBe('Skill is not available')
    })

    it('returns error for removed skills', () => {
      const skill = { moderationStatus: 'removed' as const }
      expect(checkSkillModeration(skill)).toBe('Skill is not available')
    })

    it('returns error for malware-flagged skills', () => {
      const skill = { 
        moderationStatus: 'active' as const, 
        moderationFlags: ['blocked.malware'] 
      }
      expect(checkSkillModeration(skill)).toBe('Skill has been removed for policy violation')
    })

    it('returns error for abuse-flagged skills', () => {
      const skill = { 
        moderationStatus: 'active' as const, 
        moderationFlags: ['blocked.abuse'] 
      }
      expect(checkSkillModeration(skill)).toBe('Skill has been removed for policy violation')
    })

    it('returns error for TOS violation skills', () => {
      const skill = { 
        moderationStatus: 'active' as const, 
        moderationFlags: ['blocked.tos'] 
      }
      expect(checkSkillModeration(skill)).toBe('Skill has been removed for policy violation')
    })

    it('returns error for DMCA-flagged skills', () => {
      const skill = { 
        moderationStatus: 'active' as const, 
        moderationFlags: ['blocked.dmca'] 
      }
      expect(checkSkillModeration(skill)).toBe('Skill has been removed for policy violation')
    })

    it('allows skills with non-blocking flags', () => {
      const skill = { 
        moderationStatus: 'active' as const, 
        moderationFlags: ['reviewed', 'featured', 'warning.large'] 
      }
      expect(checkSkillModeration(skill)).toBeNull()
    })

    it('blocks if ANY blocking flag is present', () => {
      const skill = { 
        moderationStatus: 'active' as const, 
        moderationFlags: ['featured', 'blocked.malware', 'reviewed'] 
      }
      expect(checkSkillModeration(skill)).toBe('Skill has been removed for policy violation')
    })
  })

  describe('assertSkillModeration', () => {
    it('does not throw for accessible skills', () => {
      const skill = { moderationStatus: 'active' as const }
      expect(() => assertSkillModeration(skill)).not.toThrow()
    })

    it('throws for blocked skills', () => {
      const skill = { moderationStatus: 'hidden' as const }
      expect(() => assertSkillModeration(skill)).toThrow('Skill is not available')
    })

    it('throws for malware-flagged skills', () => {
      const skill = { moderationFlags: ['blocked.malware'] }
      expect(() => assertSkillModeration(skill)).toThrow('Skill has been removed for policy violation')
    })
  })
})
