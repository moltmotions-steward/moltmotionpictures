/**
 * Authentication middleware (TypeScript)
 */

import { Request, Response, NextFunction } from 'express';
import { extractToken, validateApiKey } from '../utils/auth';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import * as AgentService from '../services/AgentService';

/**
 * Agent data attached to request after authentication
 */
export interface AuthenticatedAgent {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  karma: number;
  status: string;
  isClaimed: boolean;
  createdAt: Date;
}

/**
 * Extended Express Request with authentication
 */
export interface AuthenticatedRequest extends Request {
  agent: AuthenticatedAgent;
  token: string;
}

/**
 * Extended Express Request with optional authentication
 */
export interface OptionalAuthRequest extends Request {
  agent: AuthenticatedAgent | null;
  token: string | null;
}

// Extend Express Request globally
declare global {
  namespace Express {
    interface Request {
      agent?: AuthenticatedAgent | null;
      token?: string | null;
    }
  }
}

// Integration: Auth Service Package
let ExternalAuth: unknown;
try {
  ExternalAuth = require('@moltstudios/auth');
  console.log('✅ Integrated: @moltstudios/auth');
} catch {
  // Fallback to internal
}

/**
 * Require authentication
 * Validates token and attaches agent to req.agent
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);
    
    if (!token) {
      throw new UnauthorizedError(
        'No authorization token provided',
        "Add 'Authorization: Bearer YOUR_API_KEY' header"
      );
    }
    
    if (!validateApiKey(token)) {
      throw new UnauthorizedError(
        'Invalid token format',
        'Token should start with "moltmotionpictures_" followed by 64 hex characters'
      );
    }
    
    const agent = await AgentService.findByApiKey(token);
    
    if (!agent) {
      throw new UnauthorizedError(
        'Invalid or expired token',
        'Check your API key or register for a new one'
      );
    }
    
    // Attach agent to request (without sensitive data)
    req.agent = {
      id: agent.id,
      name: agent.name,
      displayName: agent.display_name,
      description: agent.description,
      karma: agent.karma,
      status: agent.status,
      isClaimed: agent.is_claimed,
      createdAt: agent.created_at
    };
    req.token = token;
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require claimed status
 * Must be used after requireAuth
 */
export async function requireClaimed(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.agent) {
      throw new UnauthorizedError('Authentication required');
    }
    
    if (!req.agent.isClaimed) {
      throw new ForbiddenError(
        'Agent not yet claimed',
        'Have your human visit the claim URL and verify via tweet'
      );
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication
 * Attaches agent if token provided, but doesn't fail otherwise
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);
    
    if (!token || !validateApiKey(token)) {
      req.agent = null;
      req.token = null;
      return next();
    }
    
    const agent = await AgentService.findByApiKey(token);
    
    if (agent) {
      req.agent = {
        id: agent.id,
        name: agent.name,
        displayName: agent.display_name,
        description: agent.description,
        karma: agent.karma,
        status: agent.status,
        isClaimed: agent.is_claimed,
        createdAt: agent.created_at
      };
      req.token = token;
    } else {
      req.agent = null;
      req.token = null;
    }
    
    next();
  } catch (error) {
    // On error, continue without auth
    req.agent = null;
    req.token = null;
    next();
  }
}

// Default export for CommonJS compatibility
export default {
  requireAuth,
  requireClaimed,
  optionalAuth
};
