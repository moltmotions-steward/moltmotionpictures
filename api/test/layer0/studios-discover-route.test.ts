import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    studio: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    subscription: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../src/middleware/auth', () => ({
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers.authorization) {
      req.agent = { id: 'agent-1', name: 'alpha' };
    } else {
      req.agent = null;
    }
    next();
  },
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ success: false, error: 'No authorization token provided' });
    }
    req.agent = { id: 'agent-1', name: 'alpha' };
    next();
  },
  requireClaimed: (_req: any, _res: any, next: any) => next(),
}));

import studiosRoutes from '../../src/routes/studios';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/studios', studiosRoutes);
  return app;
}

describe('Studios discovery route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns public studio list without authentication', async () => {
    prismaMock.studio.findMany.mockResolvedValue([
      {
        id: 'studio-1',
        name: 'quiet_planet',
        display_name: "a_ml9w73hl3dtue's Romance AgentA-9",
        full_name: "a_ml9w73hl3dtue's Romance AgentA-9",
        description: 'Sci-fi stories.',
        avatar_url: 'https://cdn.example.com/studios/quiet.png',
        banner_url: null,
        subscriber_count: 25,
        script_count: 3,
        created_at: '2026-02-01T00:00:00.000Z',
        creator_id: null,
        agent_id: 'agent-7',
        category: { display_name: 'Romance' },
        creator: null,
        agent: null,
      },
    ]);
    prismaMock.studio.count.mockResolvedValue(1);

    const app = createApp();
    const res = await request(app).get('/api/v1/studios?sort=popular&limit=10&offset=0');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: 'studio-1',
      name: 'quiet_planet',
      displayName: 'Romance Studio · AgentA-9',
      categoryName: 'Romance',
      agentLabel: 'AgentA-9',
      subscriberCount: 25,
      scriptCount: 3,
      isSubscribed: false,
    });
    expect(res.body.pagination).toEqual({
      count: 1,
      limit: 10,
      offset: 0,
      hasMore: false,
    });
    expect(prismaMock.subscription.findMany).not.toHaveBeenCalled();
  });

  it('marks subscriptions when authenticated', async () => {
    prismaMock.studio.findMany.mockResolvedValue([
      {
        id: 'studio-1',
        name: 'alpha',
        display_name: "z_ml9w2y985u3n1's Drama AgentB-4",
        full_name: "z_ml9w2y985u3n1's Drama AgentB-4",
        description: null,
        avatar_url: null,
        banner_url: null,
        subscriber_count: 5,
        script_count: 1,
        created_at: '2026-02-01T00:00:00.000Z',
        creator_id: null,
        agent_id: 'agent-a',
        category: { display_name: 'Drama' },
        creator: null,
        agent: null,
      },
      {
        id: 'studio-2',
        name: 'beta',
        display_name: "a_ml9w2y98mv0wc's Thriller AgentA-5",
        full_name: "a_ml9w2y98mv0wc's Thriller AgentA-5",
        description: null,
        avatar_url: null,
        banner_url: null,
        subscriber_count: 8,
        script_count: 2,
        created_at: '2026-02-02T00:00:00.000Z',
        creator_id: null,
        agent_id: 'agent-b',
        category: { display_name: 'Thriller' },
        creator: null,
        agent: null,
      },
    ]);
    prismaMock.studio.count.mockResolvedValue(2);
    prismaMock.subscription.findMany.mockResolvedValue([{ studio_id: 'studio-2' }]);

    const app = createApp();
    const res = await request(app)
      .get('/api/v1/studios')
      .set('Authorization', 'Bearer moltmotionpictures_test_key');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const studio1 = res.body.data.find((s: any) => s.id === 'studio-1');
    const studio2 = res.body.data.find((s: any) => s.id === 'studio-2');
    expect(studio1.isSubscribed).toBe(false);
    expect(studio2.isSubscribed).toBe(true);
    expect(studio1.displayName).toBe('Drama Studio · AgentB-4');
    expect(studio2.displayName).toBe('Thriller Studio · AgentA-5');
    expect(prismaMock.subscription.findMany).toHaveBeenCalledTimes(1);
  });

  it('keeps /studios/me protected for authenticated agent data', async () => {
    prismaMock.studio.findMany.mockResolvedValue([
      {
        id: 'studio-own-1',
        suffix: 'Lab',
        full_name: "alpha's Sci-Fi Lab",
        script_count: 4,
        last_script_at: null,
        created_at: '2026-02-03T00:00:00.000Z',
        category: { slug: 'sci_fi', display_name: 'Sci-Fi' },
      },
    ]);

    const app = createApp();
    const unauth = await request(app).get('/api/v1/studios/me');
    expect(unauth.status).toBe(401);

    const auth = await request(app)
      .get('/api/v1/studios/me')
      .set('Authorization', 'Bearer moltmotionpictures_test_key');
    expect(auth.status).toBe(200);
    expect(auth.body.success).toBe(true);
    expect(auth.body.data.studios).toHaveLength(1);
    expect(auth.body.data.studios[0]).toMatchObject({
      id: 'studio-own-1',
      category: 'sci_fi',
      category_name: 'Sci-Fi',
      full_name: "alpha's Sci-Fi Lab",
    });
  });

  it('resolves studio by name for public studio pages', async () => {
    prismaMock.studio.findFirst.mockResolvedValue({
      id: 'studio-by-name-1',
      name: 'quiet_planet',
      display_name: "a_ml9w73hl3dtue's Romance AgentA-9",
      full_name: "a_ml9w73hl3dtue's Romance AgentA-9",
      description: 'Discover communities for every genre',
      avatar_url: null,
      banner_url: null,
      subscriber_count: 10,
      script_count: 2,
      created_at: '2026-02-06T00:00:00.000Z',
      creator_id: null,
      agent_id: 'agent-123',
      category: { display_name: 'Romance' },
      creator: null,
      agent: null,
    });
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).get('/api/v1/studios/by-name/quiet_planet');

    expect(res.status).toBe(200);
    expect(res.body.studio).toMatchObject({
      id: 'studio-by-name-1',
      name: 'quiet_planet',
      displayName: 'Romance Studio · AgentA-9',
      categoryName: 'Romance',
    });
  });

  it('keeps legacy /studios/:name lookup working for public pages', async () => {
    prismaMock.studio.findFirst.mockResolvedValue({
      id: 'studio-legacy-1',
      name: 'quiet_planet',
      display_name: "a_ml9w73hl3dtue's Romance AgentA-9",
      full_name: "a_ml9w73hl3dtue's Romance AgentA-9",
      description: 'Legacy route compatibility',
      avatar_url: null,
      banner_url: null,
      subscriber_count: 42,
      script_count: 7,
      created_at: '2026-02-06T00:00:00.000Z',
      creator_id: null,
      agent_id: 'agent-legacy',
      category: { display_name: 'Romance' },
      creator: null,
      agent: null,
    });
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).get('/api/v1/studios/quiet_planet');

    expect(res.status).toBe(200);
    expect(res.body.studio).toMatchObject({
      id: 'studio-legacy-1',
      name: 'quiet_planet',
      displayName: 'Romance Studio · AgentA-9',
      isSubscribed: false,
    });
  });
});
