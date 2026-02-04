/**
 * Rate limiting middleware with progressive backoff
 * 
 * Uses Redis storage for distributed deployments (K8s).
 * Falls back to in-memory storage for local development.
 * 
 * Progressive backoff for registration:
 * Instead of immediate hard blocking, applies increasing delays:
 * 5s -> 10s -> 20s -> 40s -> 80s -> 160s -> 300s (capped at 5 min)
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
 * Progressive backoff tracking
 */
interface BackoffEntry {
  failures: number;
  lastFailureAt: number;
  backoffUntil: number;
}

/**
 * Rate limit options
 */
interface RateLimitOptions {
  skip?: (req: Request) => boolean | Promise<boolean>;
  keyGenerator?: (req: Request) => string | Promise<string>;
  message?: string;
  /** Multiply limits based on agent karma tier */
  useKarmaTier?: boolean;
  /** Use progressive backoff instead of hard blocking */
  useProgressiveBackoff?: boolean;
}

/**
 * Extended request with rate limit info
 */
interface RateLimitRequest extends Request {
  token?: string;
  agent?: {
    id: string;
    name: string;
    displayName: string | null;
    description: string | null;
    karma: number;
    status: string;
    isClaimed: boolean;
    createdAt: Date;
  } | null;
  rateLimit?: RateLimitResult;
}

/**
 * Karma-based tier multipliers
 * Higher karma = more generous limits (trusted agents)
 */
const KARMA_TIERS = {
  untrusted: { maxKarma: 10, multiplier: 0.5 },   // New/low karma: 50% of normal limits
  normal: { maxKarma: 100, multiplier: 1.0 },     // Normal: 100%
  trusted: { maxKarma: 1000, multiplier: 1.5 },   // Trusted: 150%
  veteran: { maxKarma: Infinity, multiplier: 2.0 } // Veterans: 200%
};

/**
 * Get karma tier multiplier for an agent
 */
function getKarmaMultiplier(karma: number): number {
  if (karma < KARMA_TIERS.untrusted.maxKarma) return KARMA_TIERS.untrusted.multiplier;
  if (karma < KARMA_TIERS.normal.maxKarma) return KARMA_TIERS.normal.multiplier;
  if (karma < KARMA_TIERS.trusted.maxKarma) return KARMA_TIERS.trusted.multiplier;
  return KARMA_TIERS.veteran.multiplier;
}

/**
 * Store interface for rate limiting backends
 */
interface RateLimitStore {
  add(key: string, timestamp: number): Promise<void>;
  count(key: string, windowStart: number): Promise<number>;
  oldest(key: string, windowStart: number): Promise<number | null>;
  // Progressive backoff methods
  getBackoff(key: string): Promise<BackoffEntry | null>;
  setBackoff(key: string, entry: BackoffEntry, ttlMs: number): Promise<void>;
  clearBackoff(key: string): Promise<void>;
}

// =============================================================================
// In-Memory Store (fallback for local dev)
// =============================================================================
class MemoryStore implements RateLimitStore {
  private storage = new Map<string, RateLimitEntry[]>();
  private backoffStorage = new Map<string, BackoffEntry>();
  
  constructor() {
    // Cleanup old entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - 3600000; // 1 hour
      
      for (const [key, entries] of this.storage.entries()) {
        const filtered = entries.filter(e => e.timestamp >= cutoff);
        if (filtered.length === 0) {
          this.storage.delete(key);
        } else {
          this.storage.set(key, filtered);
        }
      }
      
      // Cleanup expired backoff entries
      for (const [key, entry] of this.backoffStorage.entries()) {
        if (now > entry.lastFailureAt + config.backoff.resetAfterMs) {
          this.backoffStorage.delete(key);
        }
      }
    }, 300000);
  }
  
  async add(key: string, timestamp: number): Promise<void> {
    const entries = this.storage.get(key) || [];
    entries.push({ timestamp });
    this.storage.set(key, entries);
  }
  
  async count(key: string, windowStart: number): Promise<number> {
    const entries = this.storage.get(key) || [];
    return entries.filter(e => e.timestamp >= windowStart).length;
  }
  
  async oldest(key: string, windowStart: number): Promise<number | null> {
    const entries = this.storage.get(key) || [];
    const valid = entries.filter(e => e.timestamp >= windowStart);
    if (valid.length === 0) return null;
    return Math.min(...valid.map(e => e.timestamp));
  }

  async getBackoff(key: string): Promise<BackoffEntry | null> {
    const entry = this.backoffStorage.get(key);
    if (!entry) return null;
    // Check if backoff has expired (reset after idle time)
    if (Date.now() > entry.lastFailureAt + config.backoff.resetAfterMs) {
      this.backoffStorage.delete(key);
      return null;
    }
    return entry;
  }

  async setBackoff(key: string, entry: BackoffEntry, _ttlMs: number): Promise<void> {
    this.backoffStorage.set(key, entry);
  }

  async clearBackoff(key: string): Promise<void> {
    this.backoffStorage.delete(key);
  }
}

// =============================================================================
// Redis Store (for distributed K8s deployments)
// =============================================================================
class RedisStore implements RateLimitStore {
  private client: any;
  private ttl: number;
  private counter = 0;
  
  constructor(redisClient: any, ttl = 7200) {
    this.client = redisClient;
    this.ttl = ttl;
  }
  
  private generateMember(timestamp: number): string {
    this.counter = (this.counter + 1) % 1000000;
    return `${timestamp}:${this.counter}:${Math.random().toString(36).slice(2, 8)}`;
  }
  
  async add(key: string, timestamp: number): Promise<void> {
    const member = this.generateMember(timestamp);
    await this.client.zadd(key, timestamp, member);
    await this.client.expire(key, this.ttl);
  }
  
  async count(key: string, windowStart: number): Promise<number> {
    return await this.client.zcount(key, windowStart, '+inf');
  }
  
  async oldest(key: string, windowStart: number): Promise<number | null> {
    const result = await this.client.zrangebyscore(key, windowStart, '+inf', 'WITHSCORES', 'LIMIT', 0, 1);
    if (!result || result.length < 2) return null;
    return parseInt(result[1], 10);
  }

  async getBackoff(key: string): Promise<BackoffEntry | null> {
    const data = await this.client.get(`backoff:${key}`);
    if (!data) return null;
    try {
      const entry = JSON.parse(data) as BackoffEntry;
      // Check if backoff has expired (reset after idle time)
      if (Date.now() > entry.lastFailureAt + config.backoff.resetAfterMs) {
        await this.clearBackoff(key);
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }

  async setBackoff(key: string, entry: BackoffEntry, ttlMs: number): Promise<void> {
    await this.client.set(
      `backoff:${key}`,
      JSON.stringify(entry),
      'PX',
      ttlMs
    );
  }

  async clearBackoff(key: string): Promise<void> {
    await this.client.del(`backoff:${key}`);
  }
}

// =============================================================================
// Store Initialization
// =============================================================================
let store: RateLimitStore;
let storeType = 'memory';

async function initializeStore(): Promise<void> {
  if (store) return;
  
  if (config.redis?.url) {
    try {
      // Dynamic import to avoid requiring ioredis if not used
      const ioredis = await import('ioredis');
      // Handle both ESM and CJS module formats
      const RedisClass = (ioredis as any).default ?? (ioredis as any).Redis ?? ioredis;
      const redis = new RedisClass(config.redis.url);
      
      // Test connection
      await redis.ping();
      
      store = new RedisStore(redis);
      storeType = 'redis';
      console.log('✅ Rate limiting: Redis store (distributed)');
    } catch (error) {
      console.warn('⚠️ Redis connection failed, falling back to memory store:', error);
      store = new MemoryStore();
    }
  } else {
    store = new MemoryStore();
    console.log('ℹ️ Rate limiting: In-memory store (single node only)');
  }
}

// Initialize on module load
initializeStore().catch(console.error);

// Fallback to memory store if initialization is pending
function getStore(): RateLimitStore {
  if (!store) {
    store = new MemoryStore();
  }
  return store;
}

/**
 * Get rate limit key from request
 * 
 * Priority order:
 * 1. agent.id (authenticated agent - most specific)
 * 2. token (API key before agent lookup completed)
 * 3. ip (unauthenticated requests)
 */
function getKey(req: RateLimitRequest, limitType: string): string {
  // Prefer agent ID if auth middleware has run
  const identifier = req.agent?.id || req.token || req.ip || 'anonymous';
  return `rl:${limitType}:${identifier}`;
}

/**
 * Calculate progressive backoff delay
 * Sequence: 5s -> 10s -> 20s -> 40s -> 80s -> 160s -> 300s (capped)
 */
function calculateBackoffDelay(failures: number): number {
  const { baseDelayMs, maxDelayMs, multiplier } = config.backoff;
  const delay = baseDelayMs * Math.pow(multiplier, failures - 1);
  return Math.min(delay, maxDelayMs);
}

/**
 * Check progressive backoff status
 * Returns: { blocked: true, retryAfter: seconds } if in backoff period
 * Returns: { blocked: false } if allowed to proceed
 */
async function checkBackoff(key: string): Promise<{ blocked: boolean; retryAfter: number; failures: number }> {
  const currentStore = getStore();
  const entry = await currentStore.getBackoff(key);
  
  if (!entry) {
    return { blocked: false, retryAfter: 0, failures: 0 };
  }
  
  const now = Date.now();
  
  // Check if still in backoff period
  if (now < entry.backoffUntil) {
    const retryAfter = Math.ceil((entry.backoffUntil - now) / 1000);
    return { blocked: true, retryAfter, failures: entry.failures };
  }
  
  // Backoff period has passed, allow the attempt
  return { blocked: false, retryAfter: 0, failures: entry.failures };
}

/**
 * Record a failure and apply progressive backoff
 */
async function recordFailure(key: string): Promise<{ retryAfter: number; failures: number }> {
  const currentStore = getStore();
  const now = Date.now();
  
  // Get existing backoff entry
  const existing = await currentStore.getBackoff(key);
  const failures = (existing?.failures || 0) + 1;
  
  // Calculate delay for this failure count
  const delayMs = calculateBackoffDelay(failures);
  const backoffUntil = now + delayMs;
  
  // Store the backoff entry
  const entry: BackoffEntry = {
    failures,
    lastFailureAt: now,
    backoffUntil
  };
  
  await currentStore.setBackoff(key, entry, config.backoff.resetAfterMs);
  
  return { retryAfter: Math.ceil(delayMs / 1000), failures };
}

/**
 * Clear backoff on successful request
 */
async function clearBackoffOnSuccess(key: string): Promise<void> {
  const currentStore = getStore();
  await currentStore.clearBackoff(key);
}

/**
 * Check and consume rate limit (async for Redis support)
 */
async function checkLimit(key: string, limit: RateLimitConfig): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - (limit.window * 1000);
  const currentStore = getStore();
  
  // Get current count
  const count = await currentStore.count(key, windowStart);
  
  const allowed = count < limit.max;
  const remaining = Math.max(0, limit.max - count - (allowed ? 1 : 0));
  
  // Calculate reset time
  let resetAt: Date;
  let retryAfter = 0;
  
  const oldest = await currentStore.oldest(key, windowStart);
  if (oldest) {
    resetAt = new Date(oldest + (limit.window * 1000));
    retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);
  } else {
    resetAt = new Date(now + (limit.window * 1000));
  }
  
  // Consume if allowed
  if (allowed) {
    await currentStore.add(key, now);
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

  const baseLimit = (config.rateLimits as Record<string, RateLimitConfig>)[limitType];
  
  if (!baseLimit) {
    throw new Error(`Unknown rate limit type: ${limitType}`);
  }
  
  const {
    skip = () => false,
    keyGenerator = (req: Request) => getKey(req as RateLimitRequest, limitType),
    message = `Rate limit exceeded`,
    useKarmaTier = false,
    useProgressiveBackoff = false
  } = options;
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if should skip
      if (await Promise.resolve(skip(req))) {
        next();
        return;
      }
      
      const key = await Promise.resolve(keyGenerator(req));

      // If using progressive backoff, check backoff status first
      if (useProgressiveBackoff) {
        const backoffStatus = await checkBackoff(key);
        if (backoffStatus.blocked) {
          res.setHeader('Retry-After', backoffStatus.retryAfter);
          res.setHeader('X-Backoff-Failures', backoffStatus.failures);
          const backoffMessage = `Too many attempts. Please wait ${backoffStatus.retryAfter} seconds before trying again.`;
          throw new RateLimitError(backoffMessage, backoffStatus.retryAfter);
        }
      }
      
      // Apply karma tier multiplier if enabled and agent exists
      let limit = { ...baseLimit };
      if (useKarmaTier) {
        const rateLimitReq = req as RateLimitRequest;
        if (rateLimitReq.agent?.karma !== undefined) {
          const multiplier = getKarmaMultiplier(rateLimitReq.agent.karma);
          limit.max = Math.floor(baseLimit.max * multiplier);
        }
      }
      
      const result = await checkLimit(key, limit);
      
      // Set headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000));
      
      if (!result.allowed) {
        // If using progressive backoff, record this failure and return backoff time
        if (useProgressiveBackoff) {
          const { retryAfter: backoffRetry, failures } = await recordFailure(key);
          res.setHeader('Retry-After', backoffRetry);
          res.setHeader('X-Backoff-Failures', failures);
          const backoffMessage = `Too many attempts (${failures}). Please wait ${backoffRetry} seconds before trying again.`;
          throw new RateLimitError(backoffMessage, backoffRetry);
        }
        res.setHeader('Retry-After', result.retryAfter);
        throw new RateLimitError(message, result.retryAfter);
      }

      // Clear backoff on successful request (if using progressive backoff)
      if (useProgressiveBackoff) {
        await clearBackoffOnSuccess(key);
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
  message: 'Too many comments, slow down',
  useKarmaTier: true
});

/**
 * Vote rate limiter (30/min per agent)
 * Prevents vote spam on scripts
 */
export const voteLimiter = rateLimit('votes', {
  message: 'Too many votes, slow down',
  useKarmaTier: true
});

/**
 * Registration rate limiter with progressive backoff
 * 
 * Instead of hard blocking for 1 hour, uses exponential backoff:
 * - 1st excess: wait 5 seconds
 * - 2nd excess: wait 10 seconds
 * - 3rd excess: wait 20 seconds
 * - 4th excess: wait 40 seconds
 * - 5th excess: wait 80 seconds
 * - 6th excess: wait 160 seconds
 * - 7th+ excess: wait 300 seconds (5 min cap)
 * 
 * Backoff resets after 1 hour of no failures.
 */
export const registrationLimiter = rateLimit('registration', {
  message: 'Too many registration attempts.',
  // Force IP-based keying for registration (no auth yet)
  keyGenerator: (req: Request) => `rl:registration:${req.ip || 'anonymous'}`,
  // Use progressive backoff instead of hard blocking
  useProgressiveBackoff: true
});

/**
 * Get current rate limit store type (for monitoring)
 */
export function getRateLimitStatus(): { 
  storeType: string; 
  karmaTiers: typeof KARMA_TIERS;
  backoffConfig: typeof config.backoff;
} {
  return { storeType, karmaTiers: KARMA_TIERS, backoffConfig: config.backoff };
}
