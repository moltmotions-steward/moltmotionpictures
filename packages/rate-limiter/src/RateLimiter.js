/**
 * @moltmotionpictures/rate-limiter
 * Main RateLimiter class
 * 
 * Implements sliding window rate limiting algorithm
 * 
 * @author moltmotionpictures <hello@moltmotionpictures.com>
 * @license MIT
 */

const MemoryStore = require('./stores/MemoryStore');

/**
 * Default rate limits for moltmotionpictures
 * Based on https://www.moltmotionpictures.com/skill.md
 */
const DEFAULT_LIMITS = {
  // 300 requests per minute
  requests: {
    max: 300,
    window: 60,
    message: 'Too many requests'
  },
  // 10 scripts per 5 minutes
  Scripts: {
    max: 10,
    window: 300, // 5 * 60
    message: 'Script limit reached. Increase karma to post more frequently.'
  },
  // 100 comments per 5 minutes
  comments: {
    max: 100,
    window: 300, // 5 * 60
    message: 'Too many comments'
  }
};

/**
 * RateLimiter class
 * 
 * @example
 * const limiter = new RateLimiter();
 * const result = await limiter.consume('agent_123', 'requests');
 */
class RateLimiter {
  /**
   * Create a new RateLimiter
   * 
   * @param {Object} options - Configuration options
   * @param {Store} options.store - Storage backend (default: MemoryStore)
   * @param {Object} options.limits - Rate limit configurations
   * @param {string} options.keyPrefix - Key prefix for storage
   */
  constructor(options = {}) {
    this.store = options.store || new MemoryStore();
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.keyPrefix = options.keyPrefix || 'rl:';
  }

  /**
   * Build storage key
   * 
   * @private
   * @param {string} key - User/agent identifier
   * @param {string} limitType - Type of limit
   * @returns {string} Full storage key
   */
  _buildKey(key, limitType) {
    return `${this.keyPrefix}${limitType}:${key}`;
  }

  /**
   * Get limit configuration
   * 
   * @private
   * @param {string} limitType - Type of limit
   * @returns {Object} Limit configuration
   */
  _getLimit(limitType) {
    const limit = this.limits[limitType];
    if (!limit) {
      throw new Error(`Unknown limit type: ${limitType}`);
    }
    return limit;
  }

  /**
   * Check if action is allowed without consuming
   * 
   * @param {string} key - User/agent identifier
   * @param {string} limitType - Type of limit (default: 'requests')
   * @returns {Promise<Object>} Rate limit status
   * 
   * @example
   * const result = await limiter.check('agent_123', 'Scripts');
   * if (result.allowed) {
   *   // Can proceed
   * }
   */
  async check(key, limitType = 'requests') {
    const limit = this._getLimit(limitType);
    const storageKey = this._buildKey(key, limitType);
    const now = Date.now();
    const windowStart = now - (limit.window * 1000);

    // Get current count within window
    const count = await this.store.count(storageKey, windowStart);
    const remaining = Math.max(0, limit.max - count);
    const allowed = count < limit.max;

    // Calculate reset time
    const oldestTimestamp = await this.store.oldest(storageKey, windowStart);
    const resetAt = oldestTimestamp 
      ? new Date(oldestTimestamp + (limit.window * 1000))
      : new Date(now + (limit.window * 1000));

    return {
      allowed,
      remaining,
      limit: limit.max,
      resetAt,
      retryAfter: allowed ? 0 : Math.ceil((resetAt.getTime() - now) / 1000)
    };
  }

  /**
   * Consume rate limit tokens
   * 
   * @param {string} key - User/agent identifier
   * @param {string} limitType - Type of limit (default: 'requests')
   * @param {number} cost - Number of tokens to consume (default: 1)
   * @returns {Promise<Object>} Rate limit result
   * 
   * @example
   * const result = await limiter.consume('agent_123', 'Scripts');
   * if (!result.allowed) {
   *   console.log(`Try again in ${result.retryAfter} seconds`);
   * }
   */
  async consume(key, limitType = 'requests', cost = 1) {
    const limit = this._getLimit(limitType);
    const storageKey = this._buildKey(key, limitType);
    const now = Date.now();
    const windowStart = now - (limit.window * 1000);

    // Clean old entries and get current count
    await this.store.cleanup(storageKey, windowStart);
    const count = await this.store.count(storageKey, windowStart);

    // Check if allowed
    if (count + cost > limit.max) {
      const oldestTimestamp = await this.store.oldest(storageKey, windowStart);
      const resetAt = oldestTimestamp 
        ? new Date(oldestTimestamp + (limit.window * 1000))
        : new Date(now + (limit.window * 1000));
      
      const retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        limit: limit.max,
        resetAt,
        retryAfter,
        retryAfterMinutes: Math.ceil(retryAfter / 60),
        message: limit.message
      };
    }

    // Add entry
    await this.store.add(storageKey, now, cost);

    const newCount = count + cost;
    const remaining = Math.max(0, limit.max - newCount);
    const resetAt = new Date(now + (limit.window * 1000));

    return {
      allowed: true,
      remaining,
      limit: limit.max,
      resetAt,
      retryAfter: 0
    };
  }

  /**
   * Reset rate limit for a key
   * 
   * @param {string} key - User/agent identifier
   * @param {string} limitType - Type of limit
   * @returns {Promise<void>}
   */
  async reset(key, limitType = 'requests') {
    const storageKey = this._buildKey(key, limitType);
    await this.store.clear(storageKey);
  }

  /**
   * Reset all rate limits for a key
   * 
   * @param {string} key - User/agent identifier
   * @returns {Promise<void>}
   */
  async resetAll(key) {
    for (const limitType of Object.keys(this.limits)) {
      await this.reset(key, limitType);
    }
  }

  /**
   * Get current rate limit status
   * 
   * @param {string} key - User/agent identifier
   * @param {string} limitType - Type of limit
   * @returns {Promise<Object>} Current status
   */
  async getStatus(key, limitType = 'requests') {
    const limit = this._getLimit(limitType);
    const storageKey = this._buildKey(key, limitType);
    const now = Date.now();
    const windowStart = now - (limit.window * 1000);

    const count = await this.store.count(storageKey, windowStart);
    const remaining = Math.max(0, limit.max - count);
    
    const oldestTimestamp = await this.store.oldest(storageKey, windowStart);
    const resetAt = oldestTimestamp 
      ? new Date(oldestTimestamp + (limit.window * 1000))
      : new Date(now + (limit.window * 1000));

    return {
      used: count,
      remaining,
      max: limit.max,
      window: limit.window,
      resetAt
    };
  }

  /**
   * Get all rate limit statuses for a key
   * 
   * @param {string} key - User/agent identifier
   * @returns {Promise<Object>} All statuses
   */
  async getAllStatuses(key) {
    const statuses = {};
    for (const limitType of Object.keys(this.limits)) {
      statuses[limitType] = await this.getStatus(key, limitType);
    }
    return statuses;
  }

  /**
   * Add a custom limit type
   * 
   * @param {string} name - Limit type name
   * @param {Object} config - Limit configuration
   */
  addLimit(name, config) {
    if (!config.max || !config.window) {
      throw new Error('Limit must have max and window properties');
    }
    this.limits[name] = {
      max: config.max,
      window: config.window,
      message: config.message || 'Rate limit exceeded'
    };
  }
}

module.exports = RateLimiter;
