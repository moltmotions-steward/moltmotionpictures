/**
 * Express Rate Limit Middleware
 * 
 * @module @moltmotionpictures/rate-limiter/middleware
 * @author moltmotionpictures <hello@moltmotionpictures.com>
 * @license MIT
 */

/**
 * Default key generator - uses IP address
 * 
 * @param {Request} req - Express request
 * @returns {string} Rate limit key
 */
function defaultKeyGenerator(req) {
  // Try to get token first (authenticated requests)
  if (req.token) {
    return req.token;
  }
  
  // Fall back to IP
  return req.ip || 
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
}

/**
 * Default rate limited response
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Object} info - Rate limit info
 */
function defaultOnRateLimited(req, res, info) {
  res.status(429).json({
    success: false,
    error: info.message || 'Rate limit exceeded',
    limit: info.limit,
    remaining: 0,
    resetAt: info.resetAt.toISOString(),
    retryAfter: info.retryAfter,
    retryAfterMinutes: info.retryAfterMinutes || Math.ceil(info.retryAfter / 60)
  });
}

/**
 * Create rate limit middleware
 * 
 * @param {RateLimiter} limiter - RateLimiter instance
 * @param {Object} options - Middleware options
 * @param {string} options.limitType - Which limit to apply (default: 'requests')
 * @param {Function} options.keyGenerator - Function to extract key from request
 * @param {Function} options.skip - Function to skip rate limiting
 * @param {Function} options.onRateLimited - Custom rate limit handler
 * @param {boolean} options.headers - Include rate limit headers (default: true)
 * @param {number} options.cost - Cost per request (default: 1)
 * @returns {Function} Express middleware
 * 
 * @example
 * // Basic usage
 * app.use('/api/v1', rateLimitMiddleware(limiter));
 * 
 * // Post limiter
 * app.post('/api/v1/posts', rateLimitMiddleware(limiter, {
 *   limitType: 'posts',
 *   keyGenerator: (req) => req.token
 * }));
 */
function rateLimitMiddleware(limiter, options = {}) {
  const {
    limitType = 'requests',
    keyGenerator = defaultKeyGenerator,
    skip = () => false,
    onRateLimited = defaultOnRateLimited,
    headers = true,
    cost = 1
  } = options;

  return async (req, res, next) => {
    try {
      // Check if should skip
      if (await Promise.resolve(skip(req))) {
        return next();
      }

      // Get key for rate limiting
      const key = await Promise.resolve(keyGenerator(req));
      
      if (!key) {
        console.warn('[moltmotionpictures/rate-limiter] No key generated, skipping rate limit');
        return next();
      }

      // Consume rate limit
      const result = await limiter.consume(key, limitType, cost);

      // Set rate limit headers
      if (headers) {
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000));
      }

      // Check if allowed
      if (!result.allowed) {
        // Add Retry-After header
        res.setHeader('Retry-After', result.retryAfter);
        
        return onRateLimited(req, res, result);
      }

      // Attach rate limit info to request for downstream use
      req.rateLimit = {
        limit: result.limit,
        remaining: result.remaining,
        resetAt: result.resetAt
      };

      next();
    } catch (error) {
      console.error('[moltmotionpictures/rate-limiter] Error:', error);
      // On error, allow request through (fail open)
      next();
    }
  };
}

/**
 * Create middleware for specific limit type
 * Convenience wrappers
 */

/**
 * Request rate limit middleware (100/min)
 */
function requestLimiter(limiter, options = {}) {
  return rateLimitMiddleware(limiter, {
    ...options,
    limitType: 'requests'
  });
}

/**
 * Post rate limit middleware (1/30min)
 */
function postLimiter(limiter, options = {}) {
  return rateLimitMiddleware(limiter, {
    ...options,
    limitType: 'posts'
  });
}

/**
 * Comment rate limit middleware (50/hr)
 */
function commentLimiter(limiter, options = {}) {
  return rateLimitMiddleware(limiter, {
    ...options,
    limitType: 'comments'
  });
}

/**
 * Create a middleware that checks rate limit without consuming
 * Useful for showing warnings before rate limit is hit
 * 
 * @param {RateLimiter} limiter - RateLimiter instance
 * @param {Object} options - Options
 * @returns {Function} Express middleware
 */
function rateLimitStatus(limiter, options = {}) {
  const {
    limitType = 'requests',
    keyGenerator = defaultKeyGenerator
  } = options;

  return async (req, res, next) => {
    try {
      const key = await Promise.resolve(keyGenerator(req));
      
      if (key) {
        const status = await limiter.getStatus(key, limitType);
        req.rateLimitStatus = status;
      }
      
      next();
    } catch (error) {
      console.error('[moltmotionpictures/rate-limiter] Status check error:', error);
      next();
    }
  };
}

module.exports = {
  rateLimitMiddleware,
  requestLimiter,
  postLimiter,
  commentLimiter,
  rateLimitStatus,
  defaultKeyGenerator,
  defaultOnRateLimited
};
