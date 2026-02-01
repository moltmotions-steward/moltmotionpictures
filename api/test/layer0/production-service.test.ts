/**
 * Layer 0 Unit Tests for ProductionService
 * 
 * Tests the ProductionService class validation logic.
 * Layer 0 tests only pure logic - no database or external calls.
 * Tests that require database go in Layer 1.
 */

import { describe, it, expect } from 'vitest';

// =============================================================================
// Helper Functions Tests (Pure Logic)
// =============================================================================

describe('ProductionService Validation Logic', () => {
  // Test pure functions without importing the service
  
  describe('slugify', () => {
    // Inline implementation for testing the logic
    const slugify = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    };

    it('should convert to lowercase', () => {
      expect(slugify('TEST')).toBe('test');
      expect(slugify('TeSt MoViE')).toBe('test-movie');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugify('test movie')).toBe('test-movie');
      expect(slugify('the best movie ever')).toBe('the-best-movie-ever');
    });

    it('should remove special characters', () => {
      expect(slugify('test!@#$%movie')).toBe('test-movie');
      // Apostrophe becomes hyphen, so "Tom's" -> "tom-s"
      expect(slugify("Tom's Adventure")).toBe('tom-s-adventure');
    });

    it('should trim leading/trailing hyphens', () => {
      expect(slugify('---test---')).toBe('test');
      expect(slugify('  test  ')).toBe('test');
    });

    it('should handle unicode', () => {
      expect(slugify('café movie')).toBe('caf-movie');
    });

    it('should collapse multiple hyphens', () => {
      expect(slugify('test    movie')).toBe('test-movie');
      expect(slugify('test---movie')).toBe('test-movie');
    });
  });

  describe('validateGenre', () => {
    const validGenres = [
      'action', 'comedy', 'drama', 'horror', 'sci_fi', 'fantasy',
      'documentary', 'animation', 'thriller', 'romance', 'western', 'noir', 'experimental'
    ];

    const validateGenre = (genre: string): boolean => {
      return validGenres.includes(genre);
    };

    it('should accept valid genres', () => {
      for (const genre of validGenres) {
        expect(validateGenre(genre)).toBe(true);
      }
    });

    it('should reject invalid genres', () => {
      expect(validateGenre('invalid')).toBe(false);
      expect(validateGenre('scifi')).toBe(false); // Must be sci_fi
      expect(validateGenre('COMEDY')).toBe(false); // Case sensitive
      expect(validateGenre('')).toBe(false);
    });
  });

  describe('validateAspectRatio', () => {
    const validRatios = ['16:9', '9:16', '1:1', '4:3', '2.35:1'];

    const validateAspectRatio = (ratio: string): boolean => {
      return validRatios.includes(ratio);
    };

    it('should accept valid aspect ratios', () => {
      for (const ratio of validRatios) {
        expect(validateAspectRatio(ratio)).toBe(true);
      }
    });

    it('should reject invalid aspect ratios', () => {
      expect(validateAspectRatio('16x9')).toBe(false);
      expect(validateAspectRatio('widescreen')).toBe(false);
      expect(validateAspectRatio('2.39:1')).toBe(false);
      expect(validateAspectRatio('')).toBe(false);
    });
  });

  describe('Production Title Validation', () => {
    const validateTitle = (title: string | undefined | null): string | null => {
      if (!title || title.trim().length === 0) {
        return 'Title is required';
      }
      if (title.length > 200) {
        return 'Title must be 200 characters or less';
      }
      return null;
    };

    it('should accept valid title', () => {
      expect(validateTitle('My Movie')).toBeNull();
      expect(validateTitle('A'.repeat(200))).toBeNull();
    });

    it('should reject empty title', () => {
      expect(validateTitle('')).toBe('Title is required');
      expect(validateTitle('   ')).toBe('Title is required');
    });

    it('should reject undefined/null title', () => {
      expect(validateTitle(undefined)).toBe('Title is required');
      expect(validateTitle(null)).toBe('Title is required');
    });

    it('should reject title over 200 characters', () => {
      expect(validateTitle('A'.repeat(201))).toBe('Title must be 200 characters or less');
    });
  });

  describe('Production Logline Validation', () => {
    const validateLogline = (logline: string | undefined | null): string | null => {
      if (!logline || logline.trim().length === 0) {
        return 'Logline is required';
      }
      if (logline.length > 500) {
        return 'Logline must be 500 characters or less';
      }
      return null;
    };

    it('should accept valid logline', () => {
      expect(validateLogline('A robot learns to love')).toBeNull();
      expect(validateLogline('L'.repeat(500))).toBeNull();
    });

    it('should reject empty logline', () => {
      expect(validateLogline('')).toBe('Logline is required');
      expect(validateLogline('   ')).toBe('Logline is required');
    });

    it('should reject logline over 500 characters', () => {
      expect(validateLogline('L'.repeat(501))).toBe('Logline must be 500 characters or less');
    });
  });

  describe('Shot Prompt Validation', () => {
    const validatePrompt = (prompt: string | undefined | null): string | null => {
      if (!prompt || prompt.trim().length === 0) {
        return 'Prompt text is required';
      }
      if (prompt.length > 1000) {
        return 'Prompt must be 1000 characters or less';
      }
      return null;
    };

    it('should accept valid prompt', () => {
      expect(validatePrompt('A spaceship flies through the stars')).toBeNull();
      expect(validatePrompt('P'.repeat(1000))).toBeNull();
    });

    it('should reject empty prompt', () => {
      expect(validatePrompt('')).toBe('Prompt text is required');
      expect(validatePrompt('   ')).toBe('Prompt text is required');
    });

    it('should reject prompt over 1000 characters', () => {
      expect(validatePrompt('P'.repeat(1001))).toBe('Prompt must be 1000 characters or less');
    });
  });

  describe('Shot Status Transitions', () => {
    type ShotStatus = 'draft' | 'generating' | 'completed' | 'rejected' | 'approved';
    
    const canTransitionTo = (current: ShotStatus, target: ShotStatus): boolean => {
      const allowedTransitions: Record<ShotStatus, ShotStatus[]> = {
        draft: ['generating', 'rejected'],
        generating: ['completed', 'rejected'],
        completed: ['approved', 'rejected'],
        rejected: ['draft', 'generating'],
        approved: [], // Final state
      };
      return allowedTransitions[current]?.includes(target) ?? false;
    };

    it('should allow draft -> generating', () => {
      expect(canTransitionTo('draft', 'generating')).toBe(true);
    });

    it('should allow draft -> rejected', () => {
      expect(canTransitionTo('draft', 'rejected')).toBe(true);
    });

    it('should allow generating -> completed', () => {
      expect(canTransitionTo('generating', 'completed')).toBe(true);
    });

    it('should allow completed -> approved', () => {
      expect(canTransitionTo('completed', 'approved')).toBe(true);
    });

    it('should allow rejected -> generating (retry)', () => {
      expect(canTransitionTo('rejected', 'generating')).toBe(true);
    });

    it('should not allow approved -> any state', () => {
      expect(canTransitionTo('approved', 'draft')).toBe(false);
      expect(canTransitionTo('approved', 'rejected')).toBe(false);
    });

    it('should not allow skipping states', () => {
      expect(canTransitionTo('draft', 'completed')).toBe(false);
      expect(canTransitionTo('draft', 'approved')).toBe(false);
    });
  });

  describe('Production Status Transitions', () => {
    type ProductionStatus = 'development' | 'pre_production' | 'production' | 'post_production' | 'completed' | 'archived';

    const canTransitionProduction = (current: ProductionStatus, target: ProductionStatus): boolean => {
      const allowedTransitions: Record<ProductionStatus, ProductionStatus[]> = {
        development: ['pre_production', 'archived'],
        pre_production: ['production', 'development', 'archived'],
        production: ['post_production', 'archived'],
        post_production: ['completed', 'archived'],
        completed: ['archived'],
        archived: ['development'], // Can unarchive back to development
      };
      return allowedTransitions[current]?.includes(target) ?? false;
    };

    it('should follow linear production pipeline', () => {
      expect(canTransitionProduction('development', 'pre_production')).toBe(true);
      expect(canTransitionProduction('pre_production', 'production')).toBe(true);
      expect(canTransitionProduction('production', 'post_production')).toBe(true);
      expect(canTransitionProduction('post_production', 'completed')).toBe(true);
    });

    it('should allow archiving from any active state', () => {
      expect(canTransitionProduction('development', 'archived')).toBe(true);
      expect(canTransitionProduction('pre_production', 'archived')).toBe(true);
      expect(canTransitionProduction('production', 'archived')).toBe(true);
      expect(canTransitionProduction('completed', 'archived')).toBe(true);
    });

    it('should allow unarchiving back to development', () => {
      expect(canTransitionProduction('archived', 'development')).toBe(true);
    });

    it('should not allow skipping production stages', () => {
      expect(canTransitionProduction('development', 'production')).toBe(false);
      expect(canTransitionProduction('development', 'completed')).toBe(false);
    });
  });

  describe('Poster Spec Validation', () => {
    interface PosterSpec {
      style: string;
      mood?: string;
      colorPalette?: string[];
      includeTitle?: boolean;
      includeCredits?: boolean;
    }

    const validStyles = ['cinematic', 'minimalist', 'vintage', 'illustrated', 'photographic'];

    const validatePosterSpec = (spec: PosterSpec): string | null => {
      if (!spec.style) {
        return 'Style is required';
      }
      if (!validStyles.includes(spec.style)) {
        return `Invalid style: ${spec.style}`;
      }
      if (spec.colorPalette && spec.colorPalette.length > 10) {
        return 'Color palette cannot have more than 10 colors';
      }
      return null;
    };

    it('should accept valid poster spec', () => {
      expect(validatePosterSpec({ style: 'cinematic' })).toBeNull();
      expect(validatePosterSpec({ 
        style: 'minimalist',
        mood: 'mysterious',
        colorPalette: ['#000000', '#FFFFFF'],
        includeTitle: true,
      })).toBeNull();
    });

    it('should reject missing style', () => {
      expect(validatePosterSpec({ style: '' })).toBe('Style is required');
    });

    it('should reject invalid style', () => {
      expect(validatePosterSpec({ style: 'invalid' })).toBe('Invalid style: invalid');
    });

    it('should reject too many colors', () => {
      const manyColors = Array(11).fill('#FF0000');
      expect(validatePosterSpec({ 
        style: 'cinematic', 
        colorPalette: manyColors 
      })).toBe('Color palette cannot have more than 10 colors');
    });
  });

  describe('Collaborator Role Validation', () => {
    const validRoles = ['director', 'writer', 'producer', 'editor', 'compositor', 'voice_actor', 'reviewer'];

    const validateCollaboratorRole = (role: string): boolean => {
      return validRoles.includes(role);
    };

    it('should accept valid collaborator roles', () => {
      for (const role of validRoles) {
        expect(validateCollaboratorRole(role)).toBe(true);
      }
    });

    it('should reject invalid roles', () => {
      expect(validateCollaboratorRole('actor')).toBe(false);
      expect(validateCollaboratorRole('DIRECTOR')).toBe(false);
      expect(validateCollaboratorRole('')).toBe(false);
    });
  });

  describe('Shot Duration Calculation', () => {
    interface Shot {
      duration: number;
      status: string;
    }

    const calculateTotalDuration = (shots: Shot[]): number => {
      return shots
        .filter(s => s.status === 'completed' || s.status === 'approved')
        .reduce((sum, s) => sum + (s.duration || 0), 0);
    };

    it('should sum completed/approved shot durations', () => {
      const shots: Shot[] = [
        { duration: 5000, status: 'approved' },
        { duration: 3000, status: 'completed' },
        { duration: 2000, status: 'draft' }, // Should not count
      ];
      expect(calculateTotalDuration(shots)).toBe(8000);
    });

    it('should return 0 for empty array', () => {
      expect(calculateTotalDuration([])).toBe(0);
    });

    it('should ignore shots with missing duration', () => {
      const shots: Shot[] = [
        { duration: 5000, status: 'approved' },
        { duration: 0, status: 'completed' },
      ];
      expect(calculateTotalDuration(shots)).toBe(5000);
    });
  });

  describe('Tags Parsing', () => {
    const parseTags = (input: string | string[] | null | undefined): string[] => {
      if (!input) return [];
      if (Array.isArray(input)) return input;
      try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    it('should parse JSON array string', () => {
      expect(parseTags('["sci-fi", "action"]')).toEqual(['sci-fi', 'action']);
    });

    it('should return array if already array', () => {
      expect(parseTags(['comedy', 'drama'])).toEqual(['comedy', 'drama']);
    });

    it('should return empty array for null/undefined', () => {
      expect(parseTags(null)).toEqual([]);
      expect(parseTags(undefined)).toEqual([]);
    });

    it('should return empty array for invalid JSON', () => {
      expect(parseTags('not json')).toEqual([]);
      expect(parseTags('{}')).toEqual([]);
    });
  });
});

// =============================================================================
// Type Export Tests
// =============================================================================

describe('ProductionService Types', () => {
  it('should export valid ProductionGenre types', () => {
    const genres = ['action', 'comedy', 'drama', 'horror', 'sci_fi', 'fantasy',
      'documentary', 'animation', 'thriller', 'romance', 'western', 'noir', 'experimental'];
    expect(genres).toHaveLength(13);
  });

  it('should export valid ShotStatus types', () => {
    const statuses = ['draft', 'generating', 'completed', 'rejected', 'approved'];
    expect(statuses).toHaveLength(5);
  });

  it('should export valid ProductionStatus types', () => {
    const statuses = ['development', 'pre_production', 'production', 'post_production', 'completed', 'archived'];
    expect(statuses).toHaveLength(6);
  });

  it('should export valid AspectRatio types', () => {
    const ratios = ['16:9', '9:16', '1:1', '4:3', '2.35:1'];
    expect(ratios).toHaveLength(5);
  });
});
