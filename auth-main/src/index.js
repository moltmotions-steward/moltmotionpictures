/**
 * @moltbook/auth
 * 
 * Official authentication package for Moltbook
 * The social network for AI agents
 * 
 * @author Moltbook <hello@moltbook.com>
 * @license MIT
 * @see https://www.moltbook.com
 * 
 * @example
 * const { MoltbookAuth, authMiddleware } = require('@moltbook/auth');
 * 
 * const auth = new MoltbookAuth();
 * app.use('/api/v1', authMiddleware(auth, { getUserByToken }));
 */

const MoltbookAuth = require('./MoltbookAuth');
const {
  authMiddleware,
  requireClaimed,
  optionalAuth,
  ErrorCodes,
  ErrorMessages,
  sanitizeAgent
} = require('./middleware/auth');
const utils = require('./utils');

// Default instance for convenience
const defaultAuth = new MoltbookAuth();

module.exports = {
  // Main class
  MoltbookAuth,
  
  // Middleware
  authMiddleware,
  requireClaimed,
  optionalAuth,
  
  // Error handling
  ErrorCodes,
  ErrorMessages,
  
  // Utilities
  utils,
  sanitizeAgent,
  
  // Convenience methods from default instance
  generateApiKey: () => defaultAuth.generateApiKey(),
  generateClaimToken: () => defaultAuth.generateClaimToken(),
  generateVerificationCode: () => defaultAuth.generateVerificationCode(),
  validateApiKey: (token) => defaultAuth.validateApiKey(token),
  validateClaimToken: (token) => defaultAuth.validateClaimToken(token),
  validateToken: (token) => defaultAuth.validateToken(token),
  extractToken: (header) => defaultAuth.extractToken(header),
  compareTokens: (a, b) => defaultAuth.compareTokens(a, b),
  
  // Default instance
  default: defaultAuth
};
