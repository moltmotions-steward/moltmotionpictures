/**
 * Layer 0 - Route Module Imports
 * Import route modules to execute their code and increase coverage
 * 
 * Updated for TypeScript-only routes
 */

import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/middleware/auth.ts', () => ({
  requireAuth: vi.fn((req, res, next) => next()),
  requireClaimed: vi.fn((req, res, next) => next()),
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

describe('Layer 0 - Route Module Imports', () => {
  it('imports studios routes', async () => {
    const module = await import('../../src/routes/studios.ts');
    expect(module.default).toBeDefined();
  });

  it('imports scripts routes', async () => {
    const module = await import('../../src/routes/scripts.ts');
    expect(module.default).toBeDefined();
  });

  it('imports voting routes', async () => {
    const module = await import('../../src/routes/voting.ts');
    expect(module.default).toBeDefined();
  });

  it('imports series routes', async () => {
    const module = await import('../../src/routes/series.ts');
    expect(module.default).toBeDefined();
  });

  it('imports internal routes', async () => {
    const module = await import('../../src/routes/internal.ts');
    expect(module.default).toBeDefined();
  });

  it('imports route index', async () => {
    const module = await import('../../src/routes/index.ts');
    expect(module.default).toBeDefined();
  });
});
