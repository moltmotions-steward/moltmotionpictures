/**
 * Layer 0 - Response Utils Module Execution Tests
 * Tests that actually import and execute source code modules to increase coverage
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { success, created, paginated } from '../../src/utils/response';

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

      success(mockRes as any, { test: 'data' });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { test: 'data' }
      });
    });

    it('includes meta when provided', () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      success(mockRes as any, { test: 'data' }, { page: 1, limit: 10 });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { test: 'data' },
        meta: { page: 1, limit: 10 }
      });
    });
  });

  describe('created() function', () => {
    it('formats created response with 201 status', () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      created(mockRes as any, { id: '123' });

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: '123' }
      });
    });
  });

  describe('paginated() function', () => {
    it('formats paginated response correctly', () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      paginated(mockRes as any, [{ id: 1 }, { id: 2 }], { page: 1, limit: 10, total: 2 });

      expect(mockRes.json).toHaveBeenCalled();
      const call = mockRes.json.mock.calls[0][0];
      expect(call.success).toBe(true);
      expect(call.data).toHaveLength(2);
      expect(call.meta).toBeDefined();
      expect(call.meta.page).toBe(1);
      expect(call.meta.limit).toBe(10);
      expect(call.meta.total).toBe(2);
    });

    it('calculates hasMore correctly when more items exist', () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      // 10 items per page, total 25, first page
      paginated(mockRes as any, Array(10).fill({ id: 1 }), { page: 1, limit: 10, total: 25 });

      const call = mockRes.json.mock.calls[0][0];
      expect(call.meta.hasMore).toBe(true);
    });

    it('calculates hasMore correctly when no more items', () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      // 5 items returned, 10 limit, total 5 - no more
      paginated(mockRes as any, Array(5).fill({ id: 1 }), { page: 1, limit: 10, total: 5 });

      const call = mockRes.json.mock.calls[0][0];
      expect(call.meta.hasMore).toBe(false);
    });
  });
});
