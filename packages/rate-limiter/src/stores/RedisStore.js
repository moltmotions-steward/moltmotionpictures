/**
 * RedisStore
 * Redis storage backend for distributed rate limiting
 * 
 * Uses sorted sets with timestamps as scores for efficient sliding window
 * 
 * @author moltmotionpictures <hello@moltmotionpictures.com>
 * @license MIT
 */

/**
 * Redis store for rate limiting
 * 
 * Data structure:
 * Sorted Set: key -> { score: timestamp, member: `${timestamp}:${uuid}` }
 * 
 * @example
 * const Redis = require('ioredis');
 * const redis = new Redis(process.env.REDIS_URL);
 * const store = new RedisStore(redis);
 */
class RedisStore {
  /**
   * Create a new RedisStore
   * 
   * @param {Redis} client - ioredis client instance
   * @param {Object} options - Configuration options
   * @param {number} options.ttl - Default TTL in seconds (default: 7200 = 2 hours)
   */
  constructor(client, options = {}) {
    if (!client) {
      throw new Error('Redis client is required');
    }
    
    this.client = client;
    this.ttl = options.ttl || 7200; // 2 hours default
    this._counter = 0;
  }

  /**
   * Generate unique member ID
   * 
   * @private
   * @param {number} timestamp - Request timestamp
   * @returns {string} Unique member
   */
  _generateMember(timestamp) {
    this._counter = (this._counter + 1) % 1000000;
    return `${timestamp}:${this._counter}:${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Add a request entry
   * 
   * @param {string} key - Storage key
   * @param {number} timestamp - Request timestamp (ms)
   * @param {number} cost - Cost of request (default: 1)
   * @returns {Promise<void>}
   */
  async add(key, timestamp, cost = 1) {
    const pipeline = this.client.pipeline();
    
    // Add entries for each unit of cost
    for (let i = 0; i < cost; i++) {
      const member = this._generateMember(timestamp);
      pipeline.zadd(key, timestamp, member);
    }
    
    // Set TTL
    pipeline.expire(key, this.ttl);
    
    await pipeline.exec();
  }

  /**
   * Count requests within window
   * 
   * @param {string} key - Storage key
   * @param {number} windowStart - Start of window (ms)
   * @returns {Promise<number>} Count of requests
   */
  async count(key, windowStart) {
    // ZCOUNT key min max - count members with score between min and max
    return await this.client.zcount(key, windowStart, '+inf');
  }

  /**
   * Get oldest timestamp within window
   * 
   * @param {string} key - Storage key
   * @param {number} windowStart - Start of window (ms)
   * @returns {Promise<number|null>} Oldest timestamp or null
   */
  async oldest(key, windowStart) {
    // ZRANGEBYSCORE key min max WITHSCORES LIMIT 0 1
    const result = await this.client.zrangebyscore(
      key,
      windowStart,
      '+inf',
      'WITHSCORES',
      'LIMIT',
      0,
      1
    );
    
    if (result.length < 2) {
      return null;
    }
    
    // result = [member, score, ...]
    return parseInt(result[1], 10);
  }

  /**
   * Cleanup old entries outside window
   * 
   * @param {string} key - Storage key
   * @param {number} windowStart - Start of window (ms)
   * @returns {Promise<void>}
   */
  async cleanup(key, windowStart) {
    // ZREMRANGEBYSCORE key -inf (windowStart-1)
    await this.client.zremrangebyscore(key, '-inf', windowStart - 1);
  }

  /**
   * Clear all entries for a key
   * 
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async clear(key) {
    await this.client.del(key);
  }

  /**
   * Get all entries for a key (for debugging)
   * 
   * @param {string} key - Storage key
   * @returns {Promise<Array>} All entries with scores
   */
  async getEntries(key) {
    const result = await this.client.zrangebyscore(key, '-inf', '+inf', 'WITHSCORES');
    
    const entries = [];
    for (let i = 0; i < result.length; i += 2) {
      entries.push({
        member: result[i],
        timestamp: parseInt(result[i + 1], 10),
        cost: 1
      });
    }
    
    return entries;
  }

  /**
   * Check if Redis connection is healthy
   * 
   * @returns {Promise<boolean>} Connection status
   */
  async ping() {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Cleanup - no-op for Redis (TTL handles it)
   */
  destroy() {
    // Redis handles cleanup via TTL
    // Don't close the client here as it may be shared
  }
}

module.exports = RedisStore;
