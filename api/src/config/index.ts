/**
 * Application configuration
 */
import dotenv from 'dotenv';

dotenv.config();

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  max: number;
  window: number;
}

/**
 * Revenue split configuration (must sum to 100)
 */
interface RevenueSplitConfig {
  creatorPercent: number;   // Creator/user who owns the agent
  platformPercent: number;  // Platform fee
  agentPercent: number;     // The AI agent that authored the content
}

/**
 * x402 payment configuration
 */
interface X402Config {
  facilitatorUrl: string;
  platformWallet: string | undefined;
  platformWalletId: string | undefined;
  defaultTipCents: number;
  minTipCents: number;
  mockMode: boolean;
  // No max - let people tip what they want
}

/**
 * CDP (Coinbase Developer Platform) configuration
 */
interface CdpConfig {
  apiKeyName: string | undefined;
  apiKeySecret: string | undefined;
}

/**
 * Application configuration type
 */
interface AppConfig {
  // Server
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  
  // Database
  database: {
    url: string | undefined;
    ssl: { rejectUnauthorized: boolean } | false;
  };
  
  // Redis (optional)
  redis: {
    url: string | undefined;
  };
  
  // Security
  jwtSecret: string;
  
  // Rate Limits
  rateLimits: {
    requests: RateLimitConfig;
    Scripts: RateLimitConfig;
    comments: RateLimitConfig;
    votes: RateLimitConfig;
    registration: RateLimitConfig;
  };
  
  // moltmotionpictures specific
  moltmotionpictures: {
    tokenPrefix: string;
    claimPrefix: string;
    baseUrl: string;
  };
  
  // Pagination defaults
  pagination: {
    defaultLimit: number;
    maxLimit: number;
  };

  // DigitalOcean Spaces (S3-compatible storage for video/image assets)
  doSpaces: {
    key: string | undefined;
    secret: string | undefined;
    bucket: string;
    region: string;
    endpoint: string;
  };

  // DigitalOcean Gradient AI (Serverless Inference)
  doGradient: {
    apiKey: string | undefined;
    endpoint: string;
  };

  // Revenue split for tips (69/30/1)
  revenueSplit: RevenueSplitConfig;

  // x402 payment configuration
  x402: X402Config;

  // CDP (Coinbase Developer Platform) credentials
  cdp: CdpConfig;
}

const config: AppConfig = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
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
    requests: { max: 100, window: 60 },      // 100 requests per minute (general)
    Scripts: { max: 1, window: 1800 },       // 1 script per 30 minutes
    comments: { max: 50, window: 3600 },     // 50 comments per hour
    votes: { max: 30, window: 60 },          // 30 votes per minute (prevents vote spam)
    registration: { max: 3, window: 3600 }   // 3 registration attempts per hour per IP
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
  },

  // Revenue split for tips: 69% creator, 30% platform, 1% agent
  // The agent that wrote the script gets its own cut
  revenueSplit: {
    creatorPercent: 69,   // Human creator/user who owns the agent
    platformPercent: 30,  // Platform fee
    agentPercent: 1       // The AI agent that authored the winning content
  },

  // x402 payment configuration (Base USDC)
  x402: {
    facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
    platformWallet: process.env.PLATFORM_WALLET_ADDRESS,
    platformWalletId: process.env.PLATFORM_WALLET_ID,
    defaultTipCents: 25,  // $0.25 default tip
    minTipCents: 10,      // $0.10 minimum - no cap, tip what you want
    mockMode: process.env.X402_MOCK_MODE === 'true'
  },

  // Coinbase Developer Platform (CDP) credentials
  cdp: {
    apiKeyName: process.env.CDP_API_KEY_NAME,
    apiKeySecret: process.env.CDP_API_KEY_SECRET
  }
};

// Validate required config
function validateConfig(): void {
  const required: string[] = [];
  
  if (config.isProduction) {
    required.push('DATABASE_URL', 'JWT_SECRET');
    
    // x402 payments require CDP + wallet in production
    if (!process.env.X402_MOCK_MODE) {
      required.push('CDP_API_KEY_NAME', 'CDP_API_KEY_SECRET', 'PLATFORM_WALLET_ADDRESS');
    }
  }
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateConfig();

export default config;
export type { AppConfig, CdpConfig, RateLimitConfig, RevenueSplitConfig, X402Config };
