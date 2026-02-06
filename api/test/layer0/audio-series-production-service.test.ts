import { describe, expect, it } from 'vitest';
import {
  AudioSeriesProductionService,
  resolveSeriesAudioLifecycleStatus,
} from '../../src/services/AudioSeriesProductionService';

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

  it('keeps series in production while retryable episodes remain', () => {
    const status = resolveSeriesAudioLifecycleStatus([
      { tts_audio_url: 'https://cdn.example.com/ep-0.mp3', status: 'completed' },
      { tts_audio_url: null, status: 'pending' },
      { tts_audio_url: null, status: 'failed' },
    ]);

    expect(status).toBe('in_production');
  });

  it('marks series failed only when all remaining episodes are terminal failures', () => {
    const status = resolveSeriesAudioLifecycleStatus([
      { tts_audio_url: 'https://cdn.example.com/ep-0.mp3', status: 'completed' },
      { tts_audio_url: null, status: 'failed' },
      { tts_audio_url: null, status: 'failed' },
    ]);

    expect(status).toBe('failed');
  });

  it('marks series completed when all episodes have audio URLs', () => {
    const status = resolveSeriesAudioLifecycleStatus([
      { tts_audio_url: 'https://cdn.example.com/ep-0.mp3', status: 'completed' },
      { tts_audio_url: 'https://cdn.example.com/ep-1.mp3', status: 'completed' },
    ]);

    expect(status).toBe('completed');
  });
});
