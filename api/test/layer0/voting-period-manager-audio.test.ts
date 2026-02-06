import { describe, expect, it, vi } from 'vitest';

const { episodeServiceMock, audioServiceMock, posterServiceMock } = vi.hoisted(() => ({
  episodeServiceMock: {
    processPendingProductions: vi.fn().mockResolvedValue({ processed: 2 }),
    checkPendingGenerations: vi.fn().mockResolvedValue({ updated: 1 }),
  },
  audioServiceMock: {
    processPendingAudioProductions: vi.fn().mockResolvedValue({
      processedEpisodes: 5,
      completedEpisodes: 4,
      completedSeries: 1,
      failedEpisodes: 1,
      skipped: false,
    }),
  },
  posterServiceMock: {
    processPendingSeriesPosters: vi.fn().mockResolvedValue({
      processedSeries: 2,
      generatedPosters: 1,
      failedSeries: 1,
      skippedSeries: 0,
      skipped: false,
    }),
  },
}));

vi.mock('../../src/services/EpisodeProductionService', () => ({
  getEpisodeProductionService: () => episodeServiceMock,
}));

vi.mock('../../src/services/AudioSeriesProductionService', () => ({
  getAudioSeriesProductionService: () => audioServiceMock,
}));

vi.mock('../../src/services/SeriesPosterService', () => ({
  getSeriesPosterService: () => posterServiceMock,
}));

vi.mock('../../src/services/SeriesVotingService', () => ({
  getCurrentVotingPeriod: vi.fn().mockResolvedValue(null),
  getNextVotingPeriod: vi.fn().mockResolvedValue({ starts_at: new Date(Date.now() + 1000) }),
  getExpiredActivePeriods: vi.fn().mockResolvedValue([]),
  openPeriod: vi.fn().mockResolvedValue(undefined),
  closePeriod: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/VotingRuntimeConfigService', () => ({
  getVotingRuntimeConfig: () => ({
    cadence: 'weekly',
    agentVotingDurationMinutes: 10080,
    humanVotingDurationMinutes: 2880,
    startDayOfWeek: 1,
    startHour: 0,
    immediateStartDelaySeconds: 5,
  }),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    votingPeriod: { findMany: vi.fn().mockResolvedValue([]) },
    episode: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { runCronTick } from '../../src/services/VotingPeriodManager';

describe('VotingPeriodManager - audio production pass', () => {
  it('includes audio production stats in cron tick result', async () => {
    const result = await runCronTick();

    expect(episodeServiceMock.processPendingProductions).toHaveBeenCalled();
    expect(audioServiceMock.processPendingAudioProductions).toHaveBeenCalled();
    expect(posterServiceMock.processPendingSeriesPosters).toHaveBeenCalledWith({ limit: 2 });
    expect(result.production.processed).toBe(2);
    expect(result.audioProduction).toEqual({
      processedEpisodes: 5,
      completedEpisodes: 4,
      completedSeries: 1,
      failedEpisodes: 1,
    });
    expect(result.posterProduction).toEqual({
      processedSeries: 2,
      generatedPosters: 1,
      failedSeries: 1,
      skippedSeries: 0,
    });
  });
});
