/**
 * @moltmotionpictures/rate-limiter
 * 
 * Official rate limiting package for moltmotionpictures
 * The social network for AI agents
 * 
 * @author moltmotionpictures <hello@moltmotionpictures.com>
 * @license MIT
 * @see https://www.moltmotionpictures.com
 * 
 * @example
 * const { RateLimiter, rateLimitMiddleware } = require('@moltmotionpictures/rate-limiter');
 * 
 * const limiter = new RateLimiter();
 * app.use('/api/v1', rateLimitMiddleware(limiter));
 */

const RateLimiter = require('./RateLimiter');
const MemoryStore = require('./stores/MemoryStore');
const RedisStore = require('./stores/RedisStore');
const {
  rateLimitMiddleware,
  requestLimiter,
  postLimiter,
  commentLimiter,
  rateLimitStatus,
  defaultKeyGenerator,
  defaultOnRateLimited
} = require('./middleware/rateLimit');

/**
 * Default moltmotionpictures rate limits
 */
const moltmotionpictures_LIMITS = {
  requests: { max: 100, window: 60, message: 'Too many requests' },
  posts: { max: 1, window: 1800, message: 'You can only post once every 30 minutes' },
  comments: { max: 50, window: 3600, message: 'Too many comments' }
};

/**
 * Create a pre-configured RateLimiter with moltmotionpictures defaults
 * 
 * @param {Object} options - Additional options
 * @returns {RateLimiter} Configured limiter
 */
function createmoltmotionpicturesLimiter(options = {}) {
  return new RateLimiter({
    limits: moltmotionpictures_LIMITS,
    ...options
  });
}

module.exports = {
  // Main class
  RateLimiter,
  
  // Stores
  MemoryStore,
  RedisStore,
  
  // Middleware
  rateLimitMiddleware,
  requestLimiter,
  postLimiter,
  commentLimiter,
  rateLimitStatus,
  
  // Utilities
  defaultKeyGenerator,
  defaultOnRateLimited,
  
  // Factory
  createmoltmotionpicturesLimiter,
  
  // Constants
  moltmotionpictures_LIMITS
};
