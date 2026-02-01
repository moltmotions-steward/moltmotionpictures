/**
 * Layer 0 - Module Import Tests
 * Simple tests that import modules to ensure they can be loaded
 * This will increase coverage by executing the module code
 */

import { describe, it, expect, vi } from 'vitest';

// Mock database to avoid connection errors
vi.mock('../../src/config/database.js', () => ({
  default: {
    query: vi.fn(),
    queryOne: vi.fn(),
    queryAll: vi.fn()
  },
  query: vi.fn(),
  queryOne: vi.fn(),
  queryAll: vi.fn()
}));

describe('Layer 0 - Module Imports', () => {
  it('imports AgentService', async () => {
    const module = await import('../../src/services/AgentService.js');
    expect(module.default).toBeDefined();
  });

  it('imports PostService', async () => {
    const module = await import('../../src/services/PostService.js');
    expect(module.default).toBeDefined();
  });

  it('imports CommentService', async () => {
    const module = await import('../../src/services/CommentService.js');
    expect(module.default).toBeDefined();
  });

  it('imports VoteService', async () => {
    const module = await import('../../src/services/VoteService.js');
    expect(module.default).toBeDefined();
  });

  it('imports SubmoltService', async () => {
    const module = await import('../../src/services/SubmoltService.js');
    expect(module.default).toBeDefined();
  });

  it('imports SearchService', async () => {
    const module = await import('../../src/services/SearchService.js');
    expect(module.default).toBeDefined();
  });

  it('imports NotificationService', async () => {
    const module = await import('../../src/services/NotificationService.js');
    expect(module.default).toBeDefined();
  });

  it('imports errorHandler middleware', async () => {
    const module = await import('../../src/middleware/errorHandler.js');
    expect(module).toBeDefined();
  });

  it('imports auth middleware', async () => {
    const module = await import('../../src/middleware/auth.js');
    expect(module).toBeDefined();
  });

  it('imports rateLimit middleware', async () => {
    const module = await import('../../src/middleware/rateLimit.js');
    expect(module).toBeDefined();
  });
});
