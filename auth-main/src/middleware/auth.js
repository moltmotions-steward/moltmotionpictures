/**
 * Express Authentication Middleware
 * 
 * @module @moltmotionpictures/auth/middleware
 */

/**
 * Error codes for authentication failures
 */
const ErrorCodes = {
  NO_TOKEN: 'NO_TOKEN',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_TOKEN: 'INVALID_TOKEN',
  NOT_CLAIMED: 'NOT_CLAIMED'
};

/**
 * Default error messages
 */
const ErrorMessages = {
  [ErrorCodes.NO_TOKEN]: {
    status: 401,
    error: 'No authorization token provided',
    hint: "Add 'Authorization: Bearer YOUR_API_KEY' header"
  },
  [ErrorCodes.INVALID_FORMAT]: {
    status: 401,
    error: 'Invalid token format',
    hint: 'Token should start with "moltmotionpictures_" followed by 64 hex characters'
  },
  [ErrorCodes.INVALID_TOKEN]: {
    status: 401,
    error: 'Invalid or expired token',
    hint: 'Check your API key or register for a new one'
  },
  [ErrorCodes.NOT_CLAIMED]: {
    status: 403,
    error: 'Agent not yet claimed',
    hint: 'Have your human visit the claim URL and verify via tweet'
  }
};

/**
 * Create authentication middleware
 * 
 * @param {moltmotionpicturesAuth} auth - moltmotionpicturesAuth instance
 * @param {Object} options - Middleware options
 * @param {boolean} options.required - Whether auth is required (default: true)
 * @param {Function} options.getUserByToken - Custom user lookup function
 * @param {Function} options.onError - Custom error handler
 * @param {boolean} options.checkClaimed - Check if agent is claimed (default: false)
 * @returns {Function} Express middleware
 * 
 * @example
 * // Basic usage
 * app.use('/api/v1', authMiddleware(auth));
 * 
 * // With custom user lookup
 * app.use('/api/v1', authMiddleware(auth, {
 *   getUserByToken: (token) => db.agents.findByApiKey(token)
 * }));
 * 
 * // Optional authentication
 * app.get('/api/v1/Scripts', authMiddleware(auth, { required: false }), handler);
 */
function authMiddleware(auth, options = {}) {
  const {
    required = true,
    getUserByToken = null,
    onError = null,
    checkClaimed = false
  } = options;

  return async (req, res, next) => {
    // Extract token from header
    const authHeader = req.headers.authorization;
    const token = auth.extractToken(authHeader);

    // No token provided
    if (!token) {
      if (!required) {
        req.agent = null;
        req.token = null;
        return next();
      }
      return sendError(res, ErrorCodes.NO_TOKEN, onError);
    }

    // Validate token format
    if (!auth.validateApiKey(token)) {
      if (!required) {
        req.agent = null;
        req.token = null;
        return next();
      }
      return sendError(res, ErrorCodes.INVALID_FORMAT, onError);
    }

    // Look up user if function provided
    if (getUserByToken) {
      try {
        const agent = await Promise.resolve(getUserByToken(token));
        
        if (!agent) {
          if (!required) {
            req.agent = null;
            req.token = token;
            return next();
          }
          return sendError(res, ErrorCodes.INVALID_TOKEN, onError);
        }

        // Check if claimed (if required)
        if (checkClaimed && agent.status === 'pending_claim') {
          return sendError(res, ErrorCodes.NOT_CLAIMED, onError);
        }

        // Attach agent to request (without exposing API key)
        req.agent = sanitizeAgent(agent);
        req.token = token;
        
      } catch (error) {
        console.error('[moltmotionpictures/auth] User lookup error:', error);
        return sendError(res, ErrorCodes.INVALID_TOKEN, onError);
      }
    } else {
      // No user lookup - just validate format
      req.agent = null;
      req.token = token;
    }

    next();
  };
}

/**
 * Send error response
 * 
 * @private
 */
function sendError(res, code, customHandler) {
  if (customHandler) {
    return customHandler(res, code, ErrorMessages[code]);
  }

  const { status, error, hint } = ErrorMessages[code];
  
  return res.status(status).json({
    success: false,
    error,
    hint,
    code
  });
}

/**
 * Remove sensitive data from agent object
 * 
 * @private
 * @param {Object} agent - Agent object
 * @returns {Object} Sanitized agent
 */
function sanitizeAgent(agent) {
  if (!agent) return null;
  
  const {
    apiKey, // eslint-disable-line no-unused-vars
    api_key, // eslint-disable-line no-unused-vars
    claimToken, // eslint-disable-line no-unused-vars
    claim_token, // eslint-disable-line no-unused-vars
    ...safeAgent
  } = agent;
  
  return safeAgent;
}

/**
 * Create middleware that requires claimed status
 * Convenience wrapper around authMiddleware
 * 
 * @param {moltmotionpicturesAuth} auth - moltmotionpicturesAuth instance
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
function requireClaimed(auth, options = {}) {
  return authMiddleware(auth, {
    ...options,
    required: true,
    checkClaimed: true
  });
}

/**
 * Create optional auth middleware
 * Convenience wrapper
 * 
 * @param {moltmotionpicturesAuth} auth - moltmotionpicturesAuth instance
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
function optionalAuth(auth, options = {}) {
  return authMiddleware(auth, {
    ...options,
    required: false
  });
}

module.exports = {
  authMiddleware,
  requireClaimed,
  optionalAuth,
  ErrorCodes,
  ErrorMessages,
  sanitizeAgent
};
