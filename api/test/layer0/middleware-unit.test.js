/**
 * Layer 0 - Middleware Unit Tests
 * Tests for auth and error handler middleware logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Middleware
import { requireAuth } from '../../src/middleware/auth';
import { asyncHandler, errorHandler } from '../../src/middleware/errorHandler';

// Errors
import { BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from '../../src/utils/errors';

describe('Layer 0 - Middleware Logic', () => {
  describe('Auth Middleware - requireAuth', () => {
    it('exports requireAuth function', () => {
      expect(typeof requireAuth).toBe('function');
    });

    it('requireAuth is a function that accepts req, res, next', () => {
      expect(requireAuth.length).toBeGreaterThanOrEqual(3);
    });

    it('handles missing authorization header', async () => {
      const req = { headers: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await requireAuth(req, res, next);

      // Should either call next with error or send 401 response
      const calledWithError = next.mock.calls.some(call => call[0] instanceof Error);
      const sentUnauthorized = res.status.mock.calls.some(call => call[0] === 401);
      
      expect(calledWithError || sentUnauthorized).toBe(true);
    });

    it('handles malformed authorization header', async () => {
      const req = { headers: { authorization: 'InvalidFormat' } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await requireAuth(req, res, next);

      const calledWithError = next.mock.calls.some(call => call[0] instanceof Error);
      const sentUnauthorized = res.status.mock.calls.some(call => call[0] === 401);
      
      expect(calledWithError || sentUnauthorized).toBe(true);
    });

    it('extracts Bearer token from authorization header', async () => {
      const req = { headers: { authorization: 'Bearer testtoken123' } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await requireAuth(req, res, next);

      // Middleware should attempt to process the token
      expect(next.mock.calls.length + res.status.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handler Middleware - asyncHandler', () => {
    it('exports asyncHandler function', () => {
      expect(typeof asyncHandler).toBe('function');
    });

    it('asyncHandler wraps async route handlers', () => {
      const handler = async (req, res) => {
        return { success: true };
      };

      const wrapped = asyncHandler(handler);
      expect(typeof wrapped).toBe('function');
      expect(wrapped.length).toBe(3); // req, res, next
    });

    it('asyncHandler catches errors from async functions', async () => {
      const handler = async () => {
        throw new Error('Test error');
      };

      const wrapped = asyncHandler(handler);
      const req = {};
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await wrapped(req, res, next);

      // Should call next with error
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('asyncHandler passes successful results through', async () => {
      const handler = async (req, res) => {
        res.status(200).json({ success: true });
      };

      const wrapped = asyncHandler(handler);
      const req = {};
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await wrapped(req, res, next);

      // Should not call next with error for successful handler
      const calledWithError = next.mock.calls.some(call => call[0] instanceof Error);
      expect(calledWithError).toBe(false);
    });
  });

  describe('Error Handler Middleware - errorHandler', () => {
    it('exports errorHandler function', () => {
      expect(typeof errorHandler).toBe('function');
    });

    it('errorHandler accepts err, req, res, next', () => {
      expect(errorHandler.length).toBe(4);
    });

    it('handles BadRequestError with 400 status', () => {
      const err = new BadRequestError('Invalid input');
      const req = {};
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it('handles NotFoundError with 404 status', () => {
      const err = new NotFoundError('Resource');
      const req = {};
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();
    });

    it('handles UnauthorizedError with 401 status', () => {
      const err = new UnauthorizedError('Not authorized');
      const req = {};
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
    });

    it('handles ForbiddenError with 403 status', () => {
      const err = new ForbiddenError('Access denied');
      const req = {};
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalled();
    });

    it('handles generic Error with 500 status', () => {
      const err = new Error('Something went wrong');
      const req = {};
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });

    it('includes error message in response', () => {
      const err = new BadRequestError('Test message');
      const req = {};
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      errorHandler(err, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.error).toBeDefined();
    });
  });

  describe('Middleware Integration', () => {
    it('auth and error handler work together', async () => {
      const req = { headers: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn((err) => {
        if (err) {
          errorHandler(err, req, res, () => {});
        }
      });

      await requireAuth(req, res, next);

      // Should have sent unauthorized response
      const sentUnauthorized = res.status.mock.calls.some(call => call[0] === 401);
      expect(sentUnauthorized).toBe(true);
    });
  });
});
