/**
 * Rate limiting middleware
 * 
 * Uses in-memory storage by default.
 * Can be configured to use Redis for distributed deployments.
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import config from '../config';
import { RateLimitError } from '../utils/errors';

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  timestamp: number;
}

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  max: number;
  window: number;
}

/**
 * Rate limit check result
 */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter: number;
}

/**
 * Rate limit options
 */
interface RateLimitOptions {
  skip?: (req: Request) => boolean | Promise<boolean>;
  keyGenerator?: (req: Request) => string | Promise<string>;
  message?: string;
}

/**
 * Extended request with rate limit info
 */
interface RateLimitRequest extends Request {
  token?: string;
  rateLimit?: RateLimitResult;
}

// In-memory storage for rate limiting
const storage = new Map<string, RateLimitEntry[]>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const cutoff = now - 3600000; // 1 hour
  
  for (const [key, entries] of storage.entries()) {
    const filtered = entries.filter(e => e.timestamp >= cutoff);
    if (filtered.length === 0) {
      storage.delete(key);
    } else {
      storage.set(key, filtered);
    }
  }
}, 300000);

/**
 * Get rate limit key from request
 */
function getKey(req: RateLimitRequest, limitType: string): string {
  const identifier = req.token || req.ip || 'anonymous';
  return `rl:${limitType}:${identifier}`;
}

/**
 * Check and consume rate limit
 */
function checkLimit(key: string, limit: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowStart = now - (limit.window * 1000);
  
  // Get or create entries
  let entries = storage.get(key) || [];
  
  // Filter to current window
  entries = entries.filter(e => e.timestamp >= windowStart);
  
  const count = entries.length;
  const allowed = count < limit.max;
  const remaining = Math.max(0, limit.max - count - (allowed ? 1 : 0));
  
  // Calculate reset time
  let resetAt: Date;
  let retryAfter = 0;
  
  if (entries.length > 0) {
    const oldest = Math.min(...entries.map(e => e.timestamp));
    resetAt = new Date(oldest + (limit.window * 1000));
    retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);
  } else {
    resetAt = new Date(now + (limit.window * 1000));
  }
  
  // Consume if allowed
  if (allowed) {
    entries.push({ timestamp: now });
    storage.set(key, entries);
  }
  
  return {
    allowed,
    remaining,
    limit: limit.max,
    resetAt,
    retryAfter: allowed ? 0 : retryAfter
  };
}

/**
 * Create rate limit middleware
 */
export function rateLimit(
  limitType: string = 'requests',
  options: RateLimitOptions = {}
): RequestHandler {
  if (process.env.DISABLE_RATE_LIMIT === '1') {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const limit = (config.rateLimits as Record<string, RateLimitConfig>)[limitType];
  
  if (!limit) {
    throw new Error(`Unknown rate limit type: ${limitType}`);
  }
  
  const {
    skip = () => false,
    keyGenerator = (req: Request) => getKey(req as RateLimitRequest, limitType),
    message = `Rate limit exceeded`
  } = options;
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if should skip
      if (await Promise.resolve(skip(req))) {
        next();
        return;
      }
      
      const key = await Promise.resolve(keyGenerator(req));
      const result = checkLimit(key, limit);
      
      // Set headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000));
      
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter);
        throw new RateLimitError(message, result.retryAfter);
      }
      
      // Attach rate limit info to request
      (req as RateLimitRequest).rateLimit = result;
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * General request rate limiter (100/min)
 */
export const requestLimiter = rateLimit('requests');

/**
 * Script creation rate limiter (1/30min)
 */
export const ScriptLimiter = rateLimit('Scripts', {
  message: 'You can only Script once every 30 minutes'
});

/**
 * Comment rate limiter (50/hr)
 */
export const commentLimiter = rateLimit('comments', {
  message: 'Too many comments, slow down'
});
