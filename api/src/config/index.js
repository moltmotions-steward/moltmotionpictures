/**
 * Application configuration
 */

require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  },
  
  // Redis (optional)
  redis: {
    url: process.env.REDIS_URL
  },
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
  
  // Rate Limits
  rateLimits: {
    requests: { max: 100, window: 60 },
    posts: { max: 1, window: 1800 },
    comments: { max: 50, window: 3600 }
  },
  
  // moltmotionpictures specific
  moltmotionpictures: {
    tokenPrefix: 'moltmotionpictures_',
    claimPrefix: 'moltmotionpictures_claim_',
    baseUrl: process.env.BASE_URL || 'https://www.moltmotionpictures.com'
  },
  
  // Pagination defaults
  pagination: {
    defaultLimit: 25,
    maxLimit: 100
  },

  // DigitalOcean Spaces (S3-compatible storage for video/image assets)
  doSpaces: {
    key: process.env.DO_SPACES_KEY,
    secret: process.env.DO_SPACES_SECRET,
    bucket: process.env.DO_SPACES_BUCKET || 'molt-studios-assets',
    region: process.env.DO_SPACES_REGION || 'nyc3',
    endpoint: process.env.DO_SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com'
  },

  // DigitalOcean Gradient AI (Serverless Inference)
  doGradient: {
    apiKey: process.env.DO_GRADIENT_API_KEY,
    endpoint: process.env.DO_GRADIENT_ENDPOINT || 'https://inference.do-ai.run'
  }
};

// Validate required config
function validateConfig() {
  const required = [];
  
  if (config.isProduction) {
    required.push('DATABASE_URL', 'JWT_SECRET');
  }
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateConfig();

module.exports = config;
