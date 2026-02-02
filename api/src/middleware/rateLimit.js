"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentLimiter = exports.ScriptLimiter = exports.requestLimiter = void 0;
exports.rateLimit = rateLimit;
const config_1 = __importDefault(require("../config"));
const errors_1 = require("../utils/errors");
// In-memory storage for rate limiting
const storage = new Map();
// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    const cutoff = now - 3600000; // 1 hour
    for (const [key, entries] of storage.entries()) {
        const filtered = entries.filter(e => e.timestamp >= cutoff);
        if (filtered.length === 0) {
            storage.delete(key);
        }
        else {
            storage.set(key, filtered);
        }
    }
}, 300000);
/**
 * Get rate limit key from request
 */
function getKey(req, limitType) {
    const identifier = req.token || req.ip || 'anonymous';
    return `rl:${limitType}:${identifier}`;
}
/**
 * Check and consume rate limit
 */
function checkLimit(key, limit) {
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
    let resetAt;
    let retryAfter = 0;
    if (entries.length > 0) {
        const oldest = Math.min(...entries.map(e => e.timestamp));
        resetAt = new Date(oldest + (limit.window * 1000));
        retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);
    }
    else {
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
            const result = checkLimit(key, limit);
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
//# sourceMappingURL=rateLimit.js.map