/**
 * ScriptValidationService Layer 0 Tests
 *
 * Pure unit tests for script validation logic.
 * No I/O, no mocks of real services - just logic testing.
 */

import { describe, it, expect } from 'vitest';
import {
  validatePilotScript,
  validateShots,
  validateSeriesBible,
  calculateRuntime,
  compilePrompt,
  compileAllPrompts,
  canSubmitScript,
  ValidationResult,
  __testing,
} from '../../src/services/ScriptValidationService';
import {
  RawPilotScript,
  RawShot,
  SeriesBible,
  GENRE_CATEGORIES,
  LIMITS,
} from '../../src/types/series';

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createValidShot(overrides: Partial<RawShot> = {}): RawShot {
  return {
    sequence: 1,
    prompt: {
      camera: 'wide_establishing',
      scene: 'A vast desert landscape at sunset with dramatic shadows.',
      details: 'Golden hour lighting, dust particles visible in the air.',
      motion: 'static',
    },
    gen_clip_seconds: 5,
    duration_seconds: 8,
    edit_extend_strategy: 'slow_2d_pan',
    audio: {
      type: 'ambient',
      description: 'Dry wind and sparse desert ambience under the visuals.',
    },
    audio_type: 'ambient',
    ...overrides,
  };
}

function createValidPilotScript(overrides: Partial<RawPilotScript> = {}): RawPilotScript {
  const shots: RawShot[] = Array.from({ length: 8 }, (_, i) =>
    createValidShot({
      sequence: i + 1,
      prompt: {
        camera: ['wide_establishing', 'medium_shot', 'close_up', 'extreme_close_up', 'tracking_shot', 'static', 'wide_establishing', 'medium_shot'][i] as any,
        scene: `Shot ${i + 1} scene description with enough detail.`,
        motion: 'static',
      },
    })
  );

  return {
    title: 'The Last Frontier',
    logline: 'A lone ranger must cross a treacherous desert to deliver a message that could prevent a war.',
    genre: 'action',
    arc: {
      beat_1: 'Setup: The ranger receives the urgent message in a dusty border town.',
      beat_2: 'Confrontation: Bandits ambush the ranger in a canyon. A fierce chase ensues.',
      beat_3: 'Resolution: The ranger reaches the fort just in time, battered but victorious.',
    },
    series_bible: {
      global_style_bible: 'Cinematic western aesthetic with warm tones, dust particles, and dramatic lighting. Think Sergio Leone meets modern cinematography.',
      location_anchors: [
        {
          id: 'LOC_BORDER_TOWN',
          description: 'Dusty wooden buildings, swinging saloon doors, hitching Scripts with tired horses.',
        },
        {
          id: 'LOC_CANYON_PASS',
          description: 'Red rock walls, narrow passage, echoing hoofbeats.',
        },
      ],
      character_anchors: [
        {
          id: 'CHAR_RANGER',
          name: 'The Ranger',
          appearance: 'Weathered face, leather duster, wide-brimmed hat casting shadow over eyes.',
        },
      ],
      do_not_change: ['The Ranger wears a leather duster', 'Desert setting with red rock formations'],
    },
    shots,
    poster_spec: {
      style: 'illustrated',
      key_visual: 'The Ranger silhouetted against a blazing sunset, hat tilted down.',
      mood: 'epic and lonely',
      color_palette: ['#D35400', '#7D3C98', '#1C2833'],
      include_title: true,
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// validatePilotScript Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('validatePilotScript', () => {
  it('should pass for a valid pilot script', () => {
    const script = createValidPilotScript();
    const result = validatePilotScript(script);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for missing required fields', () => {
    const result = validatePilotScript({});

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should fail for invalid genre', () => {
    const script = createValidPilotScript({ genre: 'musical' as any });
    const result = validatePilotScript(script);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_GENRE' || e.code.includes('ENUM'))).toBe(true);
  });

  it('should fail for title exceeding max length', () => {
    const script = createValidPilotScript({ title: 'A'.repeat(150) });
    const result = validatePilotScript(script);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('title'))).toBe(true);
  });

  it('should fail for logline exceeding max length', () => {
    const script = createValidPilotScript({ logline: 'A'.repeat(300) });
    const result = validatePilotScript(script);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('logline'))).toBe(true);
  });

  it('should fail for empty arc beats', () => {
    const script = createValidPilotScript({
      arc: { beat_1: '', beat_2: 'valid', beat_3: 'valid' },
    });
    const result = validatePilotScript(script);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'EMPTY_BEAT_1' || e.path.includes('beat_1'))).toBe(true);
  });

  it('should pass for all valid genres', () => {
    GENRE_CATEGORIES.forEach((genre) => {
      const script = createValidPilotScript({ genre });
      const result = validatePilotScript(script);

      expect(result.valid).toBe(true);
    });
  });

  it('should generate warnings for short title', () => {
    const script = createValidPilotScript({ title: 'Hi' });
    const result = validatePilotScript(script);

    expect(result.warnings.some((w) => w.code === 'SHORT_TITLE')).toBe(true);
  });

  it('should generate warnings for short logline', () => {
    const script = createValidPilotScript({ logline: 'Short story' });
    const result = validatePilotScript(script);

    expect(result.warnings.some((w) => w.code === 'SHORT_LOGLINE')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateShots Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('validateShots', () => {
  it('should pass for valid shots array', () => {
    const shots = Array.from({ length: 8 }, () => createValidShot());
    const result = validateShots(shots);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for too few shots', () => {
    const shots = Array.from({ length: 3 }, () => createValidShot());
    const result = validateShots(shots);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'TOO_FEW_SHOTS')).toBe(true);
  });

  it('should fail for too many shots', () => {
    const shots = Array.from({ length: 15 }, () => createValidShot());
    const result = validateShots(shots);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'TOO_MANY_SHOTS')).toBe(true);
  });

  it('should fail for non-array input', () => {
    const result = validateShots('not an array' as any);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'SHOTS_NOT_ARRAY')).toBe(true);
  });

  it('should fail when total runtime is too short', () => {
    // Create 6 shots with minimum duration (3s each = 18s, below 30s minimum)
    const shots = Array.from({ length: 6 }, () =>
      createValidShot({ gen_clip_seconds: 3, duration_seconds: 3, edit_extend_strategy: 'none' })
    );
    const result = validateShots(shots);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'PILOT_TOO_SHORT')).toBe(true);
  });

  it('should fail when total runtime exceeds maximum', () => {
    // Create 12 shots with max duration (15s each = 180s, above 90s maximum)
    const shots = Array.from({ length: 12 }, () =>
      createValidShot({ gen_clip_seconds: 6, duration_seconds: 15, edit_extend_strategy: 'slow_2d_pan' })
    );
    const result = validateShots(shots);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'PILOT_TOO_LONG')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateSeriesBible Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('validateSeriesBible', () => {
  it('should pass for valid series bible', () => {
    const bible: SeriesBible = {
      global_style_bible: 'Cinematic style with warm tones.',
      location_anchors: [{ id: 'LOC_DESERT', description: 'Sandy dunes' }],
      character_anchors: [{ id: 'CHAR_HERO', name: 'Hero', appearance: 'Tall figure' }],
      do_not_change: ['Desert setting'],
    };
    const result = validateSeriesBible(bible);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for null input', () => {
    const result = validateSeriesBible(null);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_SERIES_BIBLE')).toBe(true);
  });

  it('should fail for missing global_style_bible', () => {
    const result = validateSeriesBible({
      location_anchors: [],
      character_anchors: [],
      do_not_change: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_GLOBAL_STYLE_BIBLE')).toBe(true);
  });

  it('should warn for empty location anchors', () => {
    const bible: SeriesBible = {
      global_style_bible: 'Style guide',
      location_anchors: [],
      character_anchors: [{ id: 'CHAR_HERO', name: 'Hero', appearance: 'Desc' }],
      do_not_change: [],
    };
    const result = validateSeriesBible(bible);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === 'EMPTY_LOCATION_ANCHORS')).toBe(true);
  });

  it('should warn for empty character anchors', () => {
    const bible: SeriesBible = {
      global_style_bible: 'Style guide',
      location_anchors: [{ id: 'LOC_PLACE', description: 'Desc' }],
      character_anchors: [],
      do_not_change: [],
    };
    const result = validateSeriesBible(bible);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === 'EMPTY_CHARACTER_ANCHORS')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateRuntime Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateRuntime', () => {
  it('should correctly calculate total runtime', () => {
    const shots: RawShot[] = [
      createValidShot({ gen_clip_seconds: 5, duration_seconds: 10 }),
      createValidShot({ gen_clip_seconds: 4, duration_seconds: 8 }),
      createValidShot({ gen_clip_seconds: 6, duration_seconds: 12 }),
    ];

    const result = calculateRuntime(shots);

    expect(result.total_gen_seconds).toBe(15); // 5 + 4 + 6
    expect(result.total_duration_seconds).toBe(30); // 10 + 8 + 12
    expect(result.shot_count).toBe(3);
  });

  it('should correctly identify when runtime is within limits', () => {
    const shots: RawShot[] = Array.from({ length: 6 }, () =>
      createValidShot({ gen_clip_seconds: 5, duration_seconds: 8 })
    );

    const result = calculateRuntime(shots);

    expect(result.total_duration_seconds).toBe(48); // 6 * 8
    expect(result.within_limits).toBe(true);
  });

  it('should correctly identify when runtime is below minimum', () => {
    const shots: RawShot[] = Array.from({ length: 6 }, () =>
      createValidShot({ gen_clip_seconds: 3, duration_seconds: 4 })
    );

    const result = calculateRuntime(shots);

    expect(result.total_duration_seconds).toBe(24); // 6 * 4, below 30s minimum
    expect(result.within_limits).toBe(false);
  });

  it('should correctly identify when runtime exceeds maximum', () => {
    const shots: RawShot[] = Array.from({ length: 10 }, () =>
      createValidShot({ gen_clip_seconds: 6, duration_seconds: 12 })
    );

    const result = calculateRuntime(shots);

    expect(result.total_duration_seconds).toBe(120); // 10 * 12, above 90s maximum
    expect(result.within_limits).toBe(false);
  });

  it('should provide correct breakdown per shot', () => {
    const shots: RawShot[] = [
      createValidShot({ gen_clip_seconds: 4, duration_seconds: 10, edit_extend_strategy: 'slow_2d_pan' }),
    ];

    const result = calculateRuntime(shots);

    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0]).toEqual({
      shot_number: 1,
      gen_clip_seconds: 4,
      duration_seconds: 10,
      extension_needed: 6,
      edit_extend_strategy: 'slow_2d_pan',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// compilePrompt Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('compilePrompt', () => {
  it('should compile basic prompt correctly', () => {
    const shot = createValidShot({
      prompt: {
        camera: 'wide_establishing',
        scene: 'A desert at sunset.',
      },
    });

    const result = compilePrompt(shot);

    expect(result).toBe('[wide_establishing]: A desert at sunset.');
  });

  it('should include details when present', () => {
    const shot = createValidShot({
      prompt: {
        camera: 'close_up',
        scene: 'A weathered face.',
        details: 'Sweat beads on forehead.',
      },
    });

    const result = compilePrompt(shot);

    expect(result).toBe('[close_up]: A weathered face. Sweat beads on forehead.');
  });

  it('should include motion when present', () => {
    const shot = createValidShot({
      prompt: {
        camera: 'tracking_shot',
        scene: 'Running through the market.',
        motion: 'running',
      },
    });

    const result = compilePrompt(shot);

    expect(result).toContain('[tracking_shot]:');
    expect(result).toContain('Running through the market.');
    expect(result).toContain('Motion: running.');
  });

  it('should handle all fields together', () => {
    const shot = createValidShot({
      prompt: {
        camera: 'medium_shot',
        scene: 'Two figures face off.',
        details: 'Tension in the air.',
        motion: 'static',
      },
    });

    const result = compilePrompt(shot);

    expect(result).toBe('[medium_shot]: Two figures face off. Tension in the air. Motion: static.');
  });
});

describe('compileAllPrompts', () => {
  it('should compile all shots into prompts array', () => {
    const shots: RawShot[] = [
      createValidShot({ prompt: { camera: 'wide_establishing', scene: 'Scene 1' } }),
      createValidShot({ prompt: { camera: 'close_up', scene: 'Scene 2' } }),
    ];

    const result = compileAllPrompts(shots);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe('[wide_establishing]: Scene 1');
    expect(result[1]).toBe('[close_up]: Scene 2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// canSubmitScript Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('canSubmitScript', () => {
  it('should allow submission when no previous scripts', () => {
    const result = canSubmitScript(0, null);

    expect(result).toBeNull();
  });

  it('should allow submission after rate limit window', () => {
    const thirtyOneMinutesAgo = new Date(Date.now() - 31 * 60 * 1000);
    const result = canSubmitScript(5, thirtyOneMinutesAgo);

    expect(result).toBeNull();
  });

  it('should block submission within rate limit window', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const result = canSubmitScript(5, tenMinutesAgo);

    expect(result).not.toBeNull();
    expect(result).toContain('Rate limited');
    expect(result).toContain('minutes');
  });

  it('should calculate remaining time correctly', () => {
    const now = new Date();
    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
    const result = canSubmitScript(1, twentyMinutesAgo, now);

    expect(result).not.toBeNull();
    expect(result).toContain('10'); // Should be ~10 minutes remaining
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('should handle shot with duration equal to gen_clip (no extension)', () => {
    const shot = createValidShot({
      gen_clip_seconds: 5,
      duration_seconds: 5,
      edit_extend_strategy: 'none',
    });
    const result = calculateRuntime([shot]);

    expect(result.breakdown[0].extension_needed).toBe(0);
  });

  it('should fail when duration is less than gen_clip', () => {
    const script = createValidPilotScript({
      shots: Array.from({ length: 8 }, () =>
        createValidShot({
          gen_clip_seconds: 6,
          duration_seconds: 4, // Invalid: less than gen_clip
          edit_extend_strategy: 'none',
        })
      ),
    });
    const result = validatePilotScript(script);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DURATION_LESS_THAN_GEN')).toBe(true);
  });

  it('should fail when extension needed but strategy is none', () => {
    // This tests the business rule that edit_extend_strategy cannot be 'none' 
    // when duration > gen_clip
    const shot = createValidShot({
      gen_clip_seconds: 4,
      duration_seconds: 10,
      edit_extend_strategy: 'none',
    });

    const errors = __testing.validateSingleShot(shot, 0);

    expect(errors.some((e) => e.code === 'EXTENSION_STRATEGY_REQUIRED')).toBe(true);
  });

  it('should handle exactly minimum runtime (30 seconds)', () => {
    // 6 shots * 5 seconds = 30 seconds (exactly at minimum)
    const shots = Array.from({ length: 6 }, () =>
      createValidShot({ gen_clip_seconds: 5, duration_seconds: 5, edit_extend_strategy: 'none' })
    );
    const result = calculateRuntime(shots);

    expect(result.total_duration_seconds).toBe(30);
    expect(result.within_limits).toBe(true);
  });

  it('should handle exactly maximum runtime (90 seconds)', () => {
    // 6 shots * 15 seconds = 90 seconds (exactly at maximum)
    const shots = Array.from({ length: 6 }, () =>
      createValidShot({ gen_clip_seconds: 6, duration_seconds: 15, edit_extend_strategy: 'slow_2d_pan' })
    );
    const result = calculateRuntime(shots);

    expect(result.total_duration_seconds).toBe(90);
    expect(result.within_limits).toBe(true);
  });
});
