import { describe, it, expect } from 'vitest';
import { validateAudioMiniseriesPack } from '../../src/services/AudioMiniseriesPackValidationService';

function makePack(overrides: any = {}) {
  return {
    title: 'Neon Echoes',
    logline: 'A rogue signal spreads across a dead city, waking machines that were built to forget.',
    genre: 'sci_fi',
    series_bible: { global_style_bible: 'No humans. Cybernetic noir.' },
    episodes: [
      { episode_number: 1, title: 'Pilot', narration_text: 'A'.repeat(3200) },
      { episode_number: 2, title: 'Ep2', recap: 'Previously...', narration_text: 'B'.repeat(3200) },
      { episode_number: 3, title: 'Ep3', recap: 'Previously...', narration_text: 'C'.repeat(3200) },
      { episode_number: 4, title: 'Ep4', recap: 'Previously...', narration_text: 'D'.repeat(3200) },
      { episode_number: 5, title: 'Finale', recap: 'Previously...', narration_text: 'E'.repeat(3200) },
    ],
    ...overrides,
  };
}

describe('AudioMiniseriesPackValidationService', () => {
  it('accepts a valid 5-episode pack', () => {
    const pack = makePack();
    const result = validateAudioMiniseriesPack(pack);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects wrong episode count', () => {
    const pack = makePack({ episodes: makePack().episodes.slice(0, 4) });
    const result = validateAudioMiniseriesPack(pack);
    expect(result.valid).toBe(false);
  });

  it('rejects duplicate episode numbers', () => {
    const pack = makePack({
      episodes: [
        { episode_number: 1, title: 'Pilot', narration_text: 'A'.repeat(3200) },
        { episode_number: 2, title: 'Ep2', recap: 'Previously...', narration_text: 'B'.repeat(3200) },
        { episode_number: 2, title: 'Ep3', recap: 'Previously...', narration_text: 'C'.repeat(3200) },
        { episode_number: 4, title: 'Ep4', recap: 'Previously...', narration_text: 'D'.repeat(3200) },
        { episode_number: 5, title: 'Finale', recap: 'Previously...', narration_text: 'E'.repeat(3200) },
      ],
    });
    const result = validateAudioMiniseriesPack(pack);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });

  it('requires recap for episodes 2-5', () => {
    const pack = makePack({
      episodes: [
        { episode_number: 1, title: 'Pilot', narration_text: 'A'.repeat(3200) },
        { episode_number: 2, title: 'Ep2', narration_text: 'B'.repeat(3200) },
        { episode_number: 3, title: 'Ep3', narration_text: 'C'.repeat(3200) },
        { episode_number: 4, title: 'Ep4', narration_text: 'D'.repeat(3200) },
        { episode_number: 5, title: 'Finale', narration_text: 'E'.repeat(3200) },
      ],
    });
    const result = validateAudioMiniseriesPack(pack);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('recap is required'))).toBe(true);
  });

  it('enforces max narration length', () => {
    const pack = makePack({
      episodes: [
        { episode_number: 1, title: 'Pilot', narration_text: 'A'.repeat(5000) },
        { episode_number: 2, title: 'Ep2', recap: 'Previously...', narration_text: 'B'.repeat(3200) },
        { episode_number: 3, title: 'Ep3', recap: 'Previously...', narration_text: 'C'.repeat(3200) },
        { episode_number: 4, title: 'Ep4', recap: 'Previously...', narration_text: 'D'.repeat(3200) },
        { episode_number: 5, title: 'Finale', recap: 'Previously...', narration_text: 'E'.repeat(3200) },
      ],
    });
    const result = validateAudioMiniseriesPack(pack);
    expect(result.valid).toBe(false);
  });
});
