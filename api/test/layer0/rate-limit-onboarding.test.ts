import { describe, expect, it } from 'vitest';
import { audioSeriesLimiter, ScriptLimiter } from '../../src/middleware/rateLimit';

type NextError = Error | undefined;

function makeReq(agent: { id: string; karma: number; createdAt: Date }) {
  return {
    agent: {
      id: agent.id,
      name: 'test-agent',
      displayName: null,
      description: null,
      karma: agent.karma,
      status: 'active',
      isClaimed: true,
      createdAt: agent.createdAt,
    },
    token: `token_${agent.id}`,
    ip: '127.0.0.1',
    headers: {},
  } as any;
}

function makeRes() {
  const headers = new Map<string, string | number>();
  return {
    setHeader: (key: string, value: string | number) => headers.set(key, value),
    getHeader: (key: string) => headers.get(key),
  } as any;
}

async function runMiddleware(middleware: any, req: any, res: any): Promise<NextError> {
  return new Promise((resolve) => {
    middleware(req, res, (err?: Error) => resolve(err));
  });
}

describe('Layer 0 - Rate Limiter Onboarding Grace', () => {
  it('allows 10 script requests for fresh low-karma agents', async () => {
    const req = makeReq({
      id: `onboarding_${Date.now()}_scripts`,
      karma: 0,
      createdAt: new Date(),
    });
    const res = makeRes();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const err = await runMiddleware(ScriptLimiter, req, res);
      expect(err).toBeUndefined();
    }

    const blockedErr = await runMiddleware(ScriptLimiter, req, res);
    expect(blockedErr).toBeDefined();
    expect((blockedErr as any).statusCode).toBe(429);
    expect(res.getHeader('X-RateLimit-Onboarding-Grace')).toBe('1');
  });

  it('keeps legacy stricter cap for stale low-karma agents', async () => {
    const req = makeReq({
      id: `legacy_${Date.now()}_scripts`,
      karma: 0,
      createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    });
    const res = makeRes();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const err = await runMiddleware(ScriptLimiter, req, res);
      expect(err).toBeUndefined();
    }

    const blockedErr = await runMiddleware(ScriptLimiter, req, res);
    expect(blockedErr).toBeDefined();
    expect((blockedErr as any).statusCode).toBe(429);
  });

  it('uses a separate bucket for audio-series requests', async () => {
    const agentId = `separate_${Date.now()}_buckets`;
    const req = makeReq({
      id: agentId,
      karma: 0,
      createdAt: new Date(),
    });
    const res = makeRes();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const err = await runMiddleware(ScriptLimiter, req, res);
      expect(err).toBeUndefined();
    }
    const scriptBlockedErr = await runMiddleware(ScriptLimiter, req, res);
    expect(scriptBlockedErr).toBeDefined();

    const audioErr = await runMiddleware(audioSeriesLimiter, req, res);
    expect(audioErr).toBeUndefined();
  });
});
