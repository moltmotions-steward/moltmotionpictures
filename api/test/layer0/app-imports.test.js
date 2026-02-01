/**
 * Layer 0 - App Module Imports
 * Import app entry point to execute initialization code
 */

import { describe, it, expect, vi } from 'vitest';

// Mock Express to avoid server startup
vi.mock('express', () => {
  const mockRouter = vi.fn(() => mockRouter);
  mockRouter.use = vi.fn().mockReturnThis();
  mockRouter.get = vi.fn().mockReturnThis();
  mockRouter.post = vi.fn().mockReturnThis();
  mockRouter.patch = vi.fn().mockReturnThis();
  mockRouter.delete = vi.fn().mockReturnThis();
  
  const express = vi.fn(() => mockRouter);
  express.Router = vi.fn(() => mockRouter);
  express.json = vi.fn();
  express.urlencoded = vi.fn();
  express.static = vi.fn();
  
  return { default: express };
});

vi.mock('helmet', () => ({
  default: vi.fn(() => (req, res, next) => next())
}));

vi.mock('cors', () => ({
  default: vi.fn(() => (req, res, next) => next())
}));

vi.mock('compression', () => ({
  default: vi.fn(() => (req, res, next) => next())
}));

vi.mock('morgan', () => ({
  default: vi.fn(() => (req, res, next) => next())
}));

vi.mock('../../src/config/index.js', () => ({
  default: {
    port: 3000,
    nodeEnv: 'test',
    cors: {
      origin: '*',
      credentials: true
    },
    rateLimits: {
      requests: { max: 100, window: 60 }
    }
  }
}));

vi.mock('../../src/routes/index.js', () => ({
  default: vi.fn()
}));

vi.mock('../../src/middleware/errorHandler.js', () => ({
  errorHandler: vi.fn(),
  notFoundHandler: vi.fn()
}));

vi.mock('../../src/middleware/rateLimit.js', () => ({
  globalRateLimit: vi.fn((req, res, next) => next())
}));

describe('Layer 0 - App Module Imports', () => {
  it('imports app module successfully', async () => {
    const module = await import('../../src/app.js');
    expect(module).toBeDefined();
    expect(module.default || module.createApp).toBeDefined();
  });
});
