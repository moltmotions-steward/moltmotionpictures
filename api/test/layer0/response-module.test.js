/**
 * Layer 0 - Direct Module Execution Tests
 * Tests that actually import and execute source code modules to increase coverage
 * 
 * These tests import modules and call their functions directly (not mocked)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { success, created, error as errorResponse } from '../../src/utils/response.js';

// Mock console to avoid test output noise
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('Layer 0 - Response Utils Module Execution', () => {
  describe('success() function', () => {
    it('formats success response correctly', () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      success(mockRes, { test: 'data' });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        test: 'data'
      });
    });

    it('allows custom status code', () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      success(mockRes, { test: 'data' }, 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('created() function', () => {
    it('formats created response with 201', () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      created(mockRes, { id: '123' });

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        id: '123'
      });
    });
  });

  describe('error() function', () => {
    it('formats error response correctly', () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      const testError = new Error('Test error');
      testError.statusCode = 400;
      testError.code = 'BAD_REQUEST';

      errorResponse(mockRes, testError);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('defaults to 500 for errors without statusCode', () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      errorResponse(mockRes, new Error('Unknown error'));

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
