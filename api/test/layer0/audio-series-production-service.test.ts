import { describe, expect, it } from 'vitest';
import { AudioSeriesProductionService } from '../../src/services/AudioSeriesProductionService';

describe('AudioSeriesProductionService', () => {
  it('skips processing when gradient/spaces are not configured', async () => {
    const service = new AudioSeriesProductionService(null as any, null as any);
    const result = await service.processPendingAudioProductions();

    expect(result).toEqual({
      processedEpisodes: 0,
      completedEpisodes: 0,
      failedEpisodes: 0,
      completedSeries: 0,
      skipped: true,
    });
  });
});
