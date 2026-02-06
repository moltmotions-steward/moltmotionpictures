import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GradientClient } from '../../src/services/GradientClient';

function mockJsonResponse(body: any, init?: { ok?: boolean; status?: number }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? 200;
  return {
    ok,
    status,
    json: async () => body,
  } as any;
}

describe('GradientClient - TTS async-invoke normalization', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('polls until completed and returns normalized audio_url + content_type', async () => {
    const client = new GradientClient({ apiKey: 'test-key', endpoint: 'https://example.test' });

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;

    fetchMock
      // POST /v1/async-invoke
      .mockResolvedValueOnce(
        mockJsonResponse({ request_id: 'req_1', status: 'QUEUED' })
      )
      // GET /v1/async-invoke/req_1/status
      .mockResolvedValueOnce(
        mockJsonResponse({
          request_id: 'req_1',
          status: 'COMPLETED',
          output: {
            audio: { url: 'https://cdn.test/out.mp3', content_type: 'audio/mpeg' },
          },
        })
      )
      // GET /v1/async-invoke/req_1
      .mockResolvedValueOnce(
        mockJsonResponse({
          request_id: 'req_1',
          status: 'COMPLETED',
          output: {
            audio: { url: 'https://cdn.test/out.mp3', content_type: 'audio/mpeg' },
          },
        })
      );

    const promise = client.generateTTSAndWait('hello', { pollIntervalMs: 1, timeoutMs: 5000 });
    const resultPromise = promise.then((r) => r);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({
      audio_url: 'https://cdn.test/out.mp3',
      content_type: 'audio/mpeg',
      duration_seconds: undefined,
    });
  });

  it('throws when completed result does not include output audio url', async () => {
    const client = new GradientClient({ apiKey: 'test-key', endpoint: 'https://example.test' });

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;

    fetchMock
      .mockResolvedValueOnce(mockJsonResponse({ request_id: 'req_2', status: 'QUEUED' }))
      .mockResolvedValueOnce(mockJsonResponse({ request_id: 'req_2', status: 'COMPLETED' }))
      .mockResolvedValueOnce(mockJsonResponse({ request_id: 'req_2', status: 'COMPLETED' }));

    const promise = client.generateTTSAndWait('hello', { pollIntervalMs: 1, timeoutMs: 5000 });
    const expectation = expect(promise).rejects.toThrow(/Unexpected async job result shape/);
    await vi.runAllTimersAsync();
    await expectation;
  });
});
