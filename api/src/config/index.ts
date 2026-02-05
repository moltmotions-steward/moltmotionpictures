/**
 * Application configuration
 */
import dotenv from 'dotenv';

dotenv.config();

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function composeManagedPostgresUrlFromDoEnv(): string | undefined {
  const user = process.env.DO_PG_USER;
  const password = process.env.DO_PG_PASSWORD;
  const host = process.env.DO_PG_HOST;
  const port = process.env.DO_PG_PORT;
  const dbName = process.env.DO_PG_DB_NAME;

  if (!user || !password || !host || !port || !dbName) return undefined;

  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  const db = encodeURIComponent(dbName);
  const base = `postgresql://${auth}@${host}:${port}/${db}`;

  // DigitalOcean Managed Postgres requires TLS.
  // Prisma/pg will respect sslmode=require embedded in the connection string.
  const params = new URLSearchParams();
  params.set('sslmode', 'require');
  return `${base}?${params.toString()}`;
}

function composeManagedRedisUrlFromDoEnv(): string | undefined {
  const user = process.env.DO_REDIS_USER;
  const password = process.env.DO_REDIS_PASSWORD;
  const host = process.env.DO_REDIS_HOST;
  const port = process.env.DO_REDIS_PORT;

  if (!password || !host || !port) return undefined;

  // DO Managed Redis uses TLS. ioredis supports this via rediss://
  const username = user ?? 'default';
  const auth = `${encodeURIComponent(username)}:${encodeURIComponent(password)}`;
  return `rediss://${auth}@${host}:${port}`;
}

// If you want to use DO managed services without manually crafting DATABASE_URL/REDIS_URL,
// set USE_MANAGED_SERVICES=1 (or MOLT_PREFER_MANAGED_SERVICES=1).
const preferManagedServices =
  isTruthyEnv(process.env.USE_MANAGED_SERVICES) ||
  isTruthyEnv(process.env.MOLT_PREFER_MANAGED_SERVICES);

const managedDatabaseUrl = composeManagedPostgresUrlFromDoEnv();
const managedRedisUrl = composeManagedRedisUrlFromDoEnv();

// Populate process.env early so Prisma (and other modules) can read it.
if (preferManagedServices) {
  if (managedDatabaseUrl) process.env.DATABASE_URL ||= managedDatabaseUrl;
  if (managedRedisUrl) process.env.REDIS_URL ||= managedRedisUrl;
}

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  max: number;
  window: number;
}

/**
 * Progressive backoff configuration
 * Instead of immediate blocking, applies increasing delays:
 * 5s -> 10s -> 20s -> 40s -> 80s -> 160s -> 300s (cap)
 */
interface BackoffConfig {
  baseDelayMs: number;      // Initial delay (5000 = 5 seconds)
  maxDelayMs: number;       // Maximum delay cap (300000 = 5 minutes)
  multiplier: number;       // Exponential factor (2 = double each time)
  resetAfterMs: number;     // Reset failure count after this idle time
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
 * Payout processing configuration
 */
interface PayoutsConfig {
  treasuryWallet: string | undefined;
  unclaimedExpiryDays: number;
}

/**
 * CDP (Coinbase Developer Platform) configuration
 * Server Wallet v2 requires all three credentials:
 * - apiKeyName: CDP API Key ID (from CDP Portal)
 * - apiKeySecret: CDP API Key Secret (EC private key)
 * - walletSecret: Wallet Secret for signing (from CDP Portal)
 */
interface CdpConfig {
  apiKeyName: string | undefined;
  apiKeySecret: string | undefined;
  walletSecret: string | undefined;
}



/**
 * Twitter/X API configuration (OAuth 2.0)
 * Reference: https://docs.x.com/overview
 */
interface TwitterConfig {
  clientId: string | undefined;       // X_CLIENT_ID
  clientSecret: string | undefined;   // X_CLIENT_ID_SECRET
  bearerToken: string | undefined;    // X_BEARER_TOKEN (for read/verification)
}

/**
 * PostHog server-side analytics configuration
 */
interface PosthogConfig {
  apiKey: string | undefined;
  host: string;
  disabled: boolean;
  flushAt: number;
  flushIntervalMs: number;
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

  // Progressive backoff for registration (instead of hard blocking)
  backoff: BackoffConfig;
  
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

  // Google Cloud Vertex AI
  googleCloud: {
    projectId: string | undefined;
    location: string;
  };

  // Revenue split for tips (69/30/1)
  revenueSplit: RevenueSplitConfig;

  // Payout processing settings
  payouts: PayoutsConfig;

  // x402 payment configuration
  x402: X402Config;

  // CDP (Coinbase Developer Platform) credentials
  cdp: CdpConfig;

  // Coinbase Prime (custody) staking/balances


  // Twitter/X API credentials
  twitter: TwitterConfig;

  // PostHog (server-side)
  posthog: PosthogConfig;
}

const posthogFlushAtRaw = parseInt(process.env.POSTHOG_FLUSH_AT || '20', 10);
const posthogFlushIntervalMsRaw = parseInt(process.env.POSTHOG_FLUSH_INTERVAL_MS || '10000', 10);

const config: AppConfig = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
    ssl: (process.env.NODE_ENV === 'production' || preferManagedServices) ? { rejectUnauthorized: false } : false
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
    registration: { max: 10, window: 300 }   // 10 registration attempts per 5 minutes per IP
  },

  // Progressive backoff for registration failures
  // Sequence: 5s -> 10s -> 20s -> 40s -> 80s -> 160s -> 300s (cap at 5 min)
  backoff: {
    baseDelayMs: 5000,         // Start with 5 second delay
    maxDelayMs: 300000,        // Cap at 5 minutes
    multiplier: 2,             // Double each consecutive failure
    resetAfterMs: 3600000      // Reset failure count after 1 hour of no failures
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

  // Google Cloud Vertex AI
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCP_PROJECT_ID,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
  },

  // Revenue split for tips: 80% creator, 19% platform, 1% agent
  // The agent that wrote the winning content gets its own cut
  revenueSplit: {
    creatorPercent: 80,   // Human creator/user who owns the agent
    platformPercent: 19,  // Platform fee
    agentPercent: 1       // The AI agent that authored the winning content
  },

  payouts: {
    // Where expired/unclaimed funds end up (defaults to the platform wallet)
    treasuryWallet: process.env.TREASURY_WALLET_ADDRESS || process.env.PLATFORM_WALLET_ADDRESS,
    unclaimedExpiryDays: parseInt(process.env.UNCLAIMED_EXPIRY_DAYS || '30', 10)
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
  // Server Wallet v2 requires CDP_WALLET_SECRET for account creation
  cdp: {
    apiKeyName: process.env.CDP_API_KEY_PRIVATE_KEY || process.env.CDP_API_KEY_NAME,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET
  },



  // Twitter/X API credentials (OAuth 2.0 + Bearer token)
  twitter: {
    clientId: process.env.X_CLIENT_ID,
    clientSecret: process.env.X_CLIENT_ID_SECRET,
    bearerToken: process.env.X_BEARER_TOKEN
  },

  // PostHog (server-side). Keep secrets server-only; fallback allows current NEXT_PUBLIC_* envs.
  posthog: {
    apiKey: process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    disabled: isTruthyEnv(process.env.POSTHOG_DISABLED),
    flushAt: Number.isFinite(posthogFlushAtRaw) && posthogFlushAtRaw > 0 ? posthogFlushAtRaw : 20,
    flushIntervalMs:
      Number.isFinite(posthogFlushIntervalMsRaw) && posthogFlushIntervalMsRaw > 0
        ? posthogFlushIntervalMsRaw
        : 10000
  }
};

// Validate required config
function validateConfig(): void {
  const required: string[] = [];
  
  if (config.isProduction) {
    // Allow either DATABASE_URL directly, or managed Postgres env vars when opting into managed.
    const hasDatabaseUrl = Boolean(config.database.url);
    const hasManagedPgVars = Boolean(
      process.env.DO_PG_USER &&
        process.env.DO_PG_PASSWORD &&
        process.env.DO_PG_HOST &&
        process.env.DO_PG_PORT &&
        process.env.DO_PG_DB_NAME
    );

    if (!hasDatabaseUrl && !(preferManagedServices && hasManagedPgVars)) {
      required.push('DATABASE_URL');
    }

    required.push('JWT_SECRET');
    
    // Production requires CDP + wallet configuration
    required.push('CDP_API_KEY_NAME', 'CDP_API_KEY_SECRET', 'CDP_WALLET_SECRET', 'PLATFORM_WALLET_ADDRESS');
  }


  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateConfig();

export default config;
export type {
  AppConfig,
  CdpConfig,

  PosthogConfig,
  RateLimitConfig,
  RevenueSplitConfig,
  TwitterConfig,
  X402Config
};
