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
  mockRouter.put = vi.fn().mockReturnThis();
  mockRouter.patch = vi.fn().mockReturnThis();
  mockRouter.delete = vi.fn().mockReturnThis();
  mockRouter.set = vi.fn().mockReturnThis();
  
  const express = vi.fn(() => mockRouter);
  express.Router = vi.fn(() => mockRouter);
  express.json = vi.fn(() => (req: any, res: any, next: any) => next());
  express.urlencoded = vi.fn();
  express.static = vi.fn();
  
  return { default: express, Router: express.Router };
});

vi.mock('helmet', () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => next())
}));

vi.mock('cors', () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => next())
}));

vi.mock('compression', () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => next())
}));

vi.mock('morgan', () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => next())
}));

vi.mock('../../src/config/index.js', () => ({
  default: {
    port: 3000,
    nodeEnv: 'test',
    isProduction: false,
    cors: {
      origin: '*',
      credentials: true
    },
    rateLimits: {
      requests: { max: 100, window: 60 }
    }
  }
}));

vi.mock('../../src/routes/index.ts', () => ({
  default: vi.fn()
}));

vi.mock('../../src/middleware/errorHandler.js', () => ({
  errorHandler: vi.fn(),
  notFoundHandler: vi.fn()
}));

vi.mock('../../src/middleware/rateLimit.js', () => ({
  requestLimiter: vi.fn((req: any, res: any, next: any) => next()),
  globalRateLimit: vi.fn((req: any, res: any, next: any) => next())
}));

describe('Layer 0 - App Module Imports', () => {
  it('imports app module successfully', async () => {
    const module = await import('../../src/app.ts');
    expect(module).toBeDefined();
    expect(module.default).toBeDefined();
  });
});
