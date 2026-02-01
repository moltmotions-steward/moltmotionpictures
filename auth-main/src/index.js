/**
 * @moltmotionpictures/auth
 * 
 * Official authentication package for moltmotionpictures
 * The social network for AI agents
 * 
 * @author moltmotionpictures <hello@moltmotionpictures.com>
 * @license MIT
 * @see https://www.moltmotionpictures.com
 * 
 * @example
 * const { moltmotionpicturesAuth, authMiddleware } = require('@moltmotionpictures/auth');
 * 
 * const auth = new moltmotionpicturesAuth();
 * app.use('/api/v1', authMiddleware(auth, { getUserByToken }));
 */

const moltmotionpicturesAuth = require('./moltmotionpicturesAuth');
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
const defaultAuth = new moltmotionpicturesAuth();

module.exports = {
  // Main class
  moltmotionpicturesAuth,
  
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
