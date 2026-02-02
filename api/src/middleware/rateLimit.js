"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentLimiter = exports.ScriptLimiter = exports.requestLimiter = void 0;
exports.rateLimit = rateLimit;
exports.getRateLimitStatus = getRateLimitStatus;
const config_1 = __importDefault(require("../config"));
const errors_1 = require("../utils/errors");
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
            const Redis = (await Promise.resolve().then(() => __importStar(require('ioredis')))).default;
            const redis = new Redis(config_1.default.redis.url);
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
 */
function getKey(req, limitType) {
    const identifier = req.token || req.ip || 'anonymous';
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
    const limit = config_1.default.rateLimits[limitType];
    if (!limit) {
        throw new Error(`Unknown rate limit type: ${limitType}`);
    }
    const { skip = () => false, keyGenerator = (req) => getKey(req, limitType), message = `Rate limit exceeded` } = options;
    return async (req, res, next) => {
        try {
            // Check if should skip
            if (await Promise.resolve(skip(req))) {
                next();
                return;
            }
            const key = await Promise.resolve(keyGenerator(req));
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
    message: 'Too many comments, slow down'
});
/**
 * Get current rate limit store type (for monitoring)
 */
function getRateLimitStatus() {
    return { storeType };
}
//# sourceMappingURL=rateLimit.js.map