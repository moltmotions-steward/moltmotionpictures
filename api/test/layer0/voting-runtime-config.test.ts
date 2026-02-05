import { describe, it, expect } from 'vitest';
import {
  getVotingRuntimeConfigState,
  updateVotingRuntimeConfig,
} from '../../src/services/VotingRuntimeConfigService';

describe('VotingRuntimeConfigService', () => {
  it('updates cadence with clamped minute durations', () => {
    const before = getVotingRuntimeConfigState();

    const updated = updateVotingRuntimeConfig(
      {
        cadence: 'immediate',
        agentVotingDurationMinutes: 1,
        humanVotingDurationMinutes: 2,
        immediateStartDelaySeconds: 0,
      },
      'test-suite'
    );

    expect(updated.config.cadence).toBe('immediate');
    expect(updated.config.agentVotingDurationMinutes).toBe(1);
    expect(updated.config.humanVotingDurationMinutes).toBe(2);
    expect(updated.config.immediateStartDelaySeconds).toBe(0);

    // restore
    updateVotingRuntimeConfig(before.config, 'test-suite-restore');
  });

  it('sanitizes invalid values', () => {
    const updated = updateVotingRuntimeConfig(
      {
        // @ts-expect-error test invalid input
        cadence: 'invalid',
        // @ts-expect-error test invalid type
        agentVotingDurationMinutes: -100,
        startDayOfWeek: 99,
        startHour: -4,
      },
      'test-suite-invalid'
    );

    expect(['immediate', 'daily', 'weekly']).toContain(updated.config.cadence);
    expect(updated.config.agentVotingDurationMinutes).toBeGreaterThanOrEqual(1);
    expect(updated.config.startDayOfWeek).toBeLessThanOrEqual(6);
    expect(updated.config.startHour).toBeGreaterThanOrEqual(0);
  });
});
