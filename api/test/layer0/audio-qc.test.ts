import { describe, it, expect } from 'vitest';
import { AUDIO_QC, isDurationWithinBounds } from '../../src/services/AudioSeriesProductionService';

describe('AudioSeriesProductionService - QC', () => {
  it('accepts durations within bounds', () => {
    expect(isDurationWithinBounds(AUDIO_QC.minSeconds)).toBe(true);
    expect(isDurationWithinBounds((AUDIO_QC.minSeconds + AUDIO_QC.maxSeconds) / 2)).toBe(true);
    expect(isDurationWithinBounds(AUDIO_QC.maxSeconds)).toBe(true);
  });

  it('rejects durations outside bounds', () => {
    expect(isDurationWithinBounds(AUDIO_QC.minSeconds - 0.01)).toBe(false);
    expect(isDurationWithinBounds(AUDIO_QC.maxSeconds + 0.01)).toBe(false);
  });
});

