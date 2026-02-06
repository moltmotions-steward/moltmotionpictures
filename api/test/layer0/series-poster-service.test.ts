import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    limitedSeries: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { SeriesPosterService } from '../../src/services/SeriesPosterService';

const seriesFixture = {
  id: 'series-1',
  title: 'The Quiet Planet',
  logline: 'A scientist hears impossible voices from deep space.',
  genre: 'sci_fi',
  medium: 'audio',
  poster_url: null,
  poster_spec: JSON.stringify({
    style: 'retro futurism',
    key_visual: 'Lone astronaut beneath an impossible sky',
    mood: 'mysterious and haunting',
  }),
  audio_pack: null,
  agent_id: 'agent-1',
};

describe('SeriesPosterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips processing when gradient/spaces are not configured', async () => {
    const service = new SeriesPosterService(null as any, null as any);
    const result = await service.processPendingSeriesPosters();

    expect(result).toEqual({
      processedSeries: 0,
      generatedPosters: 0,
      failedSeries: 0,
      skippedSeries: 0,
      skipped: true,
    });
    expect(prismaMock.limitedSeries.findMany).not.toHaveBeenCalled();
  });

  it('generates poster, uploads image, and stores poster_url', async () => {
    prismaMock.limitedSeries.findMany.mockResolvedValue([seriesFixture]);
    prismaMock.limitedSeries.updateMany.mockResolvedValue({ count: 1 });

    const gradientMock = {
      generateImage: vi.fn().mockResolvedValue({
        images: [
          {
            url: 'https://images.example.com/poster.png',
            content_type: 'image/png',
            width: 1280,
            height: 720,
            seed: 1234,
          },
        ],
      }),
    };
    const spacesMock = {
      upload: vi.fn().mockResolvedValue({
        url: 'https://cdn.example.com/series-1-poster.png',
        key: 'series/series-1/poster.png',
        bucket: 'test',
        etag: 'etag',
        size: 3,
      }),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('image/png'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
      })
    );

    const service = new SeriesPosterService(gradientMock as any, spacesMock as any);
    const result = await service.processPendingSeriesPosters({ limit: 1 });

    expect(prismaMock.limitedSeries.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
      })
    );
    expect(gradientMock.generateImage).toHaveBeenCalledTimes(1);
    const imageRequest = gradientMock.generateImage.mock.calls[0][0];
    expect(imageRequest.model).toBe('openai-gpt-image-1');
    expect(imageRequest.width).toBe(1536);
    expect(imageRequest.height).toBe(1024);
    expect(imageRequest.prompt).toContain('Include clear, legible title text');
    expect(imageRequest.prompt).toContain('"The Quiet Planet"');

    expect(spacesMock.upload).toHaveBeenCalledTimes(1);
    expect(prismaMock.limitedSeries.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'series-1',
        OR: [{ poster_url: null }, { poster_url: '' }],
      },
      data: {
        poster_url: 'https://cdn.example.com/series-1-poster.png',
      },
    });

    expect(result).toEqual({
      processedSeries: 1,
      generatedPosters: 1,
      failedSeries: 0,
      skippedSeries: 0,
      skipped: false,
    });
  });

  it('uses base64 image payload when provider returns data[].b64_json', async () => {
    prismaMock.limitedSeries.findMany.mockResolvedValue([seriesFixture]);
    prismaMock.limitedSeries.updateMany.mockResolvedValue({ count: 1 });

    const gradientMock = {
      generateImage: vi.fn().mockResolvedValue({
        data: [{ b64_json: Buffer.from('abc').toString('base64') }],
        images: [],
      }),
    };
    const spacesMock = {
      upload: vi.fn().mockResolvedValue({
        url: 'https://cdn.example.com/series-1-poster.png',
        key: 'series/series-1/poster.png',
        bucket: 'test',
        etag: 'etag',
        size: 3,
      }),
    };

    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const service = new SeriesPosterService(gradientMock as any, spacesMock as any);
    const result = await service.processPendingSeriesPosters({ limit: 1 });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(spacesMock.upload).toHaveBeenCalledTimes(1);
    expect(result.generatedPosters).toBe(1);
  });

  it('continues when one series poster generation fails', async () => {
    prismaMock.limitedSeries.findMany.mockResolvedValue([
      seriesFixture,
      {
        ...seriesFixture,
        id: 'series-2',
        title: 'Static Echo',
      },
    ]);
    prismaMock.limitedSeries.updateMany.mockResolvedValue({ count: 1 });

    const gradientMock = {
      generateImage: vi
        .fn()
        .mockResolvedValueOnce({
          images: [
            {
              url: 'https://images.example.com/poster-1.png',
              content_type: 'image/png',
              width: 1280,
              height: 720,
              seed: 1,
            },
          ],
        })
        .mockResolvedValueOnce({ images: [] }),
    };
    const spacesMock = {
      upload: vi.fn().mockResolvedValue({
        url: 'https://cdn.example.com/series-1-poster.png',
        key: 'series/series-1/poster.png',
        bucket: 'test',
        etag: 'etag',
        size: 3,
      }),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('image/png'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
      })
    );

    const service = new SeriesPosterService(gradientMock as any, spacesMock as any);
    const result = await service.processPendingSeriesPosters({ limit: 2 });

    expect(gradientMock.generateImage).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      processedSeries: 2,
      generatedPosters: 1,
      failedSeries: 1,
      skippedSeries: 0,
      skipped: false,
    });
  });
});
