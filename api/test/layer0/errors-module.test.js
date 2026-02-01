/**
 * Layer 0 - Errors Module Execution Tests
 * Tests that import and instantiate error classes
 */

import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  InternalError
} from '../../src/utils/errors.js';

describe('Layer 0 - Error Classes Module Execution', () => {
  describe('ValidationError', () => {
    it('creates ValidationError with correct properties', () => {
      const errors = [{ field: 'email', message: 'Invalid' }];
      const error = new ValidationError(errors);
      
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
      expect(error.errors).toEqual(errors);
    });

    it('accepts error array', () => {
      const errors = [
        { field: 'email', message: 'Invalid format' },
        { field: 'name', message: 'Required' }
      ];
      const error = new ValidationError(errors);
      
      expect(error.errors).toEqual(errors);
    });
  });

  describe('NotFoundError', () => {
    it('creates NotFoundError with correct properties', () => {
      const error = new NotFoundError('Resource');
      
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.name).toBe('NotFoundError');
    });

    it('accepts custom resource name', () => {
      const error = new NotFoundError('User');
      
      expect(error.message).toBe('User not found');
    });
  });

  describe('UnauthorizedError', () => {
    it('creates UnauthorizedError with correct properties', () => {
      const error = new UnauthorizedError('Not authenticated');
      
      expect(error.message).toBe('Not authenticated');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.name).toBe('UnauthorizedError');
    });

    it('accepts hint parameter', () => {
      const error = new UnauthorizedError('Invalid token', 'Use Bearer token');
      
      expect(error.hint).toBe('Use Bearer token');
    });
  });

  describe('ForbiddenError', () => {
    it('creates ForbiddenError with correct properties', () => {
      const error = new ForbiddenError('Access denied');
      
      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.name).toBe('ForbiddenError');
    });
  });

  describe('ConflictError', () => {
    it('creates ConflictError with correct properties', () => {
      const error = new ConflictError('Already exists');
      
      expect(error.message).toBe('Already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.name).toBe('ConflictError');
    });
  });

  describe('RateLimitError', () => {
    it('creates RateLimitError with correct properties', () => {
      const error = new RateLimitError('Too many requests');
      
      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.name).toBe('RateLimitError');
    });

    it('accepts retryAfter parameter', () => {
      const error = new RateLimitError('Rate limited', 60);
      
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('InternalError', () => {
    it('creates InternalError with correct properties', () => {
      const error = new InternalError('Server error');
      
      expect(error.message).toBe('Server error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.name).toBe('InternalError');
    });
  });
});
