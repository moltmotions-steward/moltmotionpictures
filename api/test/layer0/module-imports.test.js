/**
 * Layer 0 - Module Import Tests
 * Simple tests that import modules to ensure they can be loaded
 * This will increase coverage by executing the module code
 * 
 * Updated for TypeScript-only services
 */

import { describe, it, expect, vi } from 'vitest';

// Mock database to avoid connection errors
vi.mock('../../src/config/database.ts', () => ({
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
    const module = await import('../../src/services/AgentService.ts');
    expect(module.default).toBeDefined();
    expect(module.findByApiKey).toBeDefined();
  });

  it('imports ScriptService', async () => {
    const module = await import('../../src/services/ScriptService.ts');
    expect(module).toBeDefined();
  });

  it('imports StudioService', async () => {
    const module = await import('../../src/services/StudioService.ts');
    expect(module).toBeDefined();
  });

  it('imports SeriesVotingService', async () => {
    const module = await import('../../src/services/SeriesVotingService.ts');
    expect(module).toBeDefined();
  });

  it('imports VotingPeriodManager', async () => {
    const module = await import('../../src/services/VotingPeriodManager.ts');
    expect(module).toBeDefined();
  });

  it('imports EpisodeProductionService', async () => {
    const module = await import('../../src/services/EpisodeProductionService.ts');
    expect(module).toBeDefined();
  });

  it('imports errorHandler middleware', async () => {
    const module = await import('../../src/middleware/errorHandler.ts');
    expect(module).toBeDefined();
  });

  it('imports auth middleware', async () => {
    const module = await import('../../src/middleware/auth.ts');
    expect(module).toBeDefined();
  });

  it('imports rateLimit middleware', async () => {
    const module = await import('../../src/middleware/rateLimit.ts');
    expect(module).toBeDefined();
  });
});
