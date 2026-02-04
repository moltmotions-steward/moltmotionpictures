import { describe, expect, it } from 'vitest';
import { __testing } from '../../src/services/EpisodeMediaFinalizer';

describe('EpisodeMediaFinalizer', () => {
  it('builds stable final key', () => {
    expect(__testing.getFinalKey('ep_123')).toBe('episodes/ep_123/final_with_audio.mp4');
  });

  it('detects audio extension from content-type', () => {
    expect(__testing.detectAudioExtension('audio/wav')).toBe('wav');
    expect(__testing.detectAudioExtension('audio/mpeg')).toBe('mp3');
    expect(__testing.detectAudioExtension('audio/mp4')).toBe('m4a');
    expect(__testing.detectAudioExtension(null)).toBe('mp3');
  });

  it('builds ffmpeg args with faststart and shortest', () => {
    const args = __testing.buildMuxArgs('/tmp/in.mp4', '/tmp/in.mp3', '/tmp/out.mp4');
    expect(args).toContain('+faststart');
    expect(args).toContain('-shortest');
    expect(args[0]).toBe('-y');
  });
});
