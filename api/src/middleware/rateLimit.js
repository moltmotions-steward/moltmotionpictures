"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrationLimiter = exports.voteLimiter = exports.commentLimiter = exports.ScriptLimiter = exports.requestLimiter = void 0;
exports.rateLimit = rateLimit;
exports.getRateLimitStatus = getRateLimitStatus;
const config_1 = __importDefault(require("../config"));
const errors_1 = require("../utils/errors");
/**
 * Karma-based tier multipliers
 * Higher karma = more generous limits (trusted agents)
 */
const KARMA_TIERS = {
    untrusted: { maxKarma: 10, multiplier: 0.5 }, // New/low karma: 50% of normal limits
    normal: { maxKarma: 100, multiplier: 1.0 }, // Normal: 100%
    trusted: { maxKarma: 1000, multiplier: 1.5 }, // Trusted: 150%
    veteran: { maxKarma: Infinity, multiplier: 2.0 } // Veterans: 200%
};
/**
 * Get karma tier multiplier for an agent
 */
function getKarmaMultiplier(karma) {
    if (karma < KARMA_TIERS.untrusted.maxKarma)
        return KARMA_TIERS.untrusted.multiplier;
    if (karma < KARMA_TIERS.normal.maxKarma)
        return KARMA_TIERS.normal.multiplier;
    if (karma < KARMA_TIERS.trusted.maxKarma)
        return KARMA_TIERS.trusted.multiplier;
    return KARMA_TIERS.veteran.multiplier;
}
// =============================================================================
// In-Memory Store (fallback for local dev)
// =============================================================================
class MemoryStore {
    storage = new Map();
    constructor() {
        // Cleanup old entries every 5 minutes
        setInterval(() => {
            const now = Date.now();
            const cutoff = now - 3600000; // 1 hour
            for (const [key, entries] of this.storage.entries()) {
                const filtered = entries.filter(e => e.timestamp >= cutoff);
                if (filtered.length === 0) {
                    this.storage.delete(key);
                }
                else {
                    this.storage.set(key, filtered);
                }
            }
        }, 300000);
    }
    async add(key, timestamp) {
        const entries = this.storage.get(key) || [];
        entries.push({ timestamp });
        this.storage.set(key, entries);
    }
    async count(key, windowStart) {
        const entries = this.storage.get(key) || [];
        return entries.filter(e => e.timestamp >= windowStart).length;
    }
    async oldest(key, windowStart) {
        const entries = this.storage.get(key) || [];
        const valid = entries.filter(e => e.timestamp >= windowStart);
        if (valid.length === 0)
            return null;
        return Math.min(...valid.map(e => e.timestamp));
    }
}
// =============================================================================
// Redis Store (for distributed K8s deployments)
// =============================================================================
class RedisStore {
    client;
    ttl;
    counter = 0;
    constructor(redisClient, ttl = 7200) {
        this.client = redisClient;
        this.ttl = ttl;
    }
    generateMember(timestamp) {
        this.counter = (this.counter + 1) % 1000000;
        return `${timestamp}:${this.counter}:${Math.random().toString(36).slice(2, 8)}`;
    }
    async add(key, timestamp) {
        const member = this.generateMember(timestamp);
        await this.client.zadd(key, timestamp, member);
        await this.client.expire(key, this.ttl);
    }
    async count(key, windowStart) {
        return await this.client.zcount(key, windowStart, '+inf');
    }
    async oldest(key, windowStart) {
        const result = await this.client.zrangebyscore(key, windowStart, '+inf', 'WITHSCORES', 'LIMIT', 0, 1);
        if (!result || result.length < 2)
            return null;
        return parseInt(result[1], 10);
    }
}
// =============================================================================
// Store Initialization
// =============================================================================
let store;
let storeType = 'memory';
async function initializeStore() {
    if (store)
        return;
    if (config_1.default.redis?.url) {
        try {
            // Dynamic import to avoid requiring ioredis if not used
            const ioredis = await import('ioredis');
            // Handle both ESM and CJS module formats
            const RedisClass = ioredis.default ?? ioredis.Redis ?? ioredis;
            const redis = new RedisClass(config_1.default.redis.url);
            // Test connection
            await redis.ping();
            store = new RedisStore(redis);
            storeType = 'redis';
            console.log('✅ Rate limiting: Redis store (distributed)');
        }
        catch (error) {
            console.warn('⚠️ Redis connection failed, falling back to memory store:', error);
            store = new MemoryStore();
        }
    }
    else {
        store = new MemoryStore();
        console.log('ℹ️ Rate limiting: In-memory store (single node only)');
    }
}
// Initialize on module load
initializeStore().catch(console.error);
// Fallback to memory store if initialization is pending
function getStore() {
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
function getKey(req, limitType) {
    // Prefer agent ID if auth middleware has run
    const identifier = req.agent?.id || req.token || req.ip || 'anonymous';
    return `rl:${limitType}:${identifier}`;
}
/**
 * Check and consume rate limit (async for Redis support)
 */
async function checkLimit(key, limit) {
    const now = Date.now();
    const windowStart = now - (limit.window * 1000);
    const currentStore = getStore();
    // Get current count
    const count = await currentStore.count(key, windowStart);
    const allowed = count < limit.max;
    const remaining = Math.max(0, limit.max - count - (allowed ? 1 : 0));
    // Calculate reset time
    let resetAt;
    let retryAfter = 0;
    const oldest = await currentStore.oldest(key, windowStart);
    if (oldest) {
        resetAt = new Date(oldest + (limit.window * 1000));
        retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);
    }
    else {
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
function rateLimit(limitType = 'requests', options = {}) {
    if (process.env.DISABLE_RATE_LIMIT === '1') {
        return (_req, _res, next) => next();
    }
    const baseLimit = config_1.default.rateLimits[limitType];
    if (!baseLimit) {
        throw new Error(`Unknown rate limit type: ${limitType}`);
    }
    const { skip = () => false, keyGenerator = (req) => getKey(req, limitType), message = `Rate limit exceeded`, useKarmaTier = false } = options;
    return async (req, res, next) => {
        try {
            // Check if should skip
            if (await Promise.resolve(skip(req))) {
                next();
                return;
            }
            const key = await Promise.resolve(keyGenerator(req));
            // Apply karma tier multiplier if enabled and agent exists
            let limit = { ...baseLimit };
            if (useKarmaTier) {
                const rateLimitReq = req;
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
                res.setHeader('Retry-After', result.retryAfter);
                throw new errors_1.RateLimitError(message, result.retryAfter);
            }
            // Attach rate limit info to request
            req.rateLimit = result;
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
/**
 * General request rate limiter (100/min)
 */
exports.requestLimiter = rateLimit('requests');
/**
 * Script creation rate limiter (1/30min)
 */
exports.ScriptLimiter = rateLimit('Scripts', {
    message: 'You can only Script once every 30 minutes'
});
/**
 * Comment rate limiter (50/hr)
 */
exports.commentLimiter = rateLimit('comments', {
    message: 'Too many comments, slow down',
    useKarmaTier: true
});
/**
 * Vote rate limiter (30/min per agent)
 * Prevents vote spam on scripts
 */
exports.voteLimiter = rateLimit('votes', {
    message: 'Too many votes, slow down',
    useKarmaTier: true
});
/**
 * Registration rate limiter (3/hr per IP)
 * Prevents wallet/registration spam attacks
 */
exports.registrationLimiter = rateLimit('registration', {
    message: 'Too many registration attempts. Try again later.',
    // Force IP-based keying for registration (no auth yet)
    keyGenerator: (req) => `rl:registration:${req.ip || 'anonymous'}`
});
/**
 * Get current rate limit store type (for monitoring)
 */
function getRateLimitStatus() {
    return { storeType, karmaTiers: KARMA_TIERS };
}
//# sourceMappingURL=rateLimit.js.map