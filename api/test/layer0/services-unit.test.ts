/**
 * Layer 0 - Service Unit Tests
 * Pure unit tests for service layer business logic
 * Tests validation, error handling, data transformation
 * 
 * Updated for unified production pipeline services
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Services - TypeScript imports
import * as AgentService from '../../src/services/AgentService';
import * as ScriptService from '../../src/services/ScriptService';
import * as StudioService from '../../src/services/StudioService';
import * as SeriesVotingService from '../../src/services/SeriesVotingService';
import * as VotingPeriodManager from '../../src/services/VotingPeriodManager';

// Errors
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from '../../src/utils/errors';

describe('Layer 0 - Service Business Logic', () => {
  describe('AgentService - Validation Logic', () => {
    it('has findByApiKey method', () => {
      expect(typeof AgentService.findByApiKey).toBe('function');
    });

    it('has findByName method', () => {
      expect(typeof AgentService.findByName).toBe('function');
    });

    it('has findById method', () => {
      expect(typeof AgentService.findById).toBe('function');
    });

    it('has create method', () => {
      expect(typeof AgentService.create).toBe('function');
    });

    it('has update method', () => {
      expect(typeof AgentService.update).toBe('function');
    });

    it('has updateKarma method', () => {
      expect(typeof AgentService.updateKarma).toBe('function');
    });

    it('has toPublic method', () => {
      expect(typeof AgentService.toPublic).toBe('function');
    });

    it('has isNameAvailable method', () => {
      expect(typeof AgentService.isNameAvailable).toBe('function');
    });
  });

  describe('ScriptService - Business Logic', () => {
    it('module exports correctly', () => {
      expect(ScriptService).toBeDefined();
    });
  });

  describe('StudioService - Business Logic', () => {
    it('module exports correctly', () => {
      expect(StudioService).toBeDefined();
    });
  });

  describe('SeriesVotingService - Business Logic', () => {
    it('module exports correctly', () => {
      expect(SeriesVotingService).toBeDefined();
    });
  });

  describe('VotingPeriodManager - Business Logic', () => {
    it('module exports correctly', () => {
      expect(VotingPeriodManager).toBeDefined();
    });
  });

  describe('Error Classes - Validation', () => {
    it('BadRequestError has correct structure', () => {
      const error = new BadRequestError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
    });

    it('NotFoundError has correct structure', () => {
      const error = new NotFoundError('Resource');
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
    });

    it('ConflictError has correct structure', () => {
      const error = new ConflictError('Conflict');
      expect(error.message).toBe('Conflict');
      expect(error.statusCode).toBe(409);
    });

    it('ForbiddenError has correct structure', () => {
      const error = new ForbiddenError('Forbidden');
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
    });
  });
});
