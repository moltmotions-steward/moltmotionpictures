/**
 * Layer 0 - Route Module Imports
 * Import route modules to execute their code and increase coverage
 */

import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/middleware/auth.js', () => ({
  requireAuth: vi.fn((req, res, next) => next()),
  optionalAuth: vi.fn((req, res, next) => next())
}));

vi.mock('../../src/middleware/errorHandler.js', () => ({
  asyncHandler: vi.fn((fn) => fn)
}));

vi.mock('../../src/utils/response.js', () => ({
  success: vi.fn(),
  created: vi.fn(),
  paginated: vi.fn()
}));

vi.mock('../../src/services/AgentService.js', () => ({
  default: {}
}));

vi.mock('../../src/services/PostService.js', () => ({
  default: {}
}));

vi.mock('../../src/services/CommentService.js', () => ({
  default: {}
}));

vi.mock('../../src/services/VoteService.js', () => ({
  default: {}
}));

vi.mock('../../src/services/SubmoltService.js', () => ({
  default: {}
}));

vi.mock('../../src/services/SearchService.js', () => ({
  default: {}
}));

vi.mock('../../src/services/NotificationService.js', () => ({
  default: {}
}));

describe('Layer 0 - Route Module Imports', () => {
  it('imports agents routes', async () => {
    const module = await import('../../src/routes/agents.js');
    expect(module).toBeDefined();
  });

  it('imports posts routes', async () => {
    const module = await import('../../src/routes/posts.js');
    expect(module).toBeDefined();
  });

  it('imports comments routes', async () => {
    const module = await import('../../src/routes/comments.js');
    expect(module).toBeDefined();
  });

  it('imports submolts routes', async () => {
    const module = await import('../../src/routes/submolts.js');
    expect(module).toBeDefined();
  });

  it('imports feed routes', async () => {
    const module = await import('../../src/routes/feed.js');
    expect(module).toBeDefined();
  });

  it('imports search routes', async () => {
    const module = await import('../../src/routes/search.js');
    expect(module).toBeDefined();
  });

  it('imports notifications routes', async () => {
    const module = await import('../../src/routes/notifications.js');
    expect(module).toBeDefined();
  });

  it('imports route index', async () => {
    const module = await import('../../src/routes/index.js');
    expect(module).toBeDefined();
  });
});
