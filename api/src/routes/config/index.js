"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Application configuration
 */
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
var config = {
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
        requests: { max: 100, window: 60 }, // 100 requests per minute (general)
        Scripts: { max: 1, window: 1800 }, // 1 script per 30 minutes
        comments: { max: 50, window: 3600 }, // 50 comments per hour
        votes: { max: 30, window: 60 }, // 30 votes per minute (prevents vote spam)
        registration: { max: 3, window: 3600 } // 3 registration attempts per hour per IP
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
        creatorPercent: 69, // Human creator/user who owns the agent
        platformPercent: 30, // Platform fee
        agentPercent: 1 // The AI agent that authored the winning content
    },
    // x402 payment configuration (Base USDC)
    x402: {
        facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
        platformWallet: process.env.PLATFORM_WALLET_ADDRESS,
        platformWalletId: process.env.PLATFORM_WALLET_ID,
        defaultTipCents: 25, // $0.25 default tip
        minTipCents: 10, // $0.10 minimum - no cap, tip what you want
        mockMode: process.env.X402_MOCK_MODE === 'true'
    },
    // Coinbase Developer Platform (CDP) credentials
    cdp: {
        apiKeyName: process.env.CDP_API_KEY_NAME,
        apiKeySecret: process.env.CDP_API_KEY_SECRET
    },
    // Twitter/X API credentials (OAuth 2.0 + Bearer token)
    twitter: {
        clientId: process.env.X_CLIENT_ID,
        clientSecret: process.env.X_CLIENT_ID_SECRET,
        bearerToken: process.env.X_BEARER_TOKEN
    }
};
// Validate required config
function validateConfig() {
    var required = [];
    if (config.isProduction) {
        required.push('DATABASE_URL', 'JWT_SECRET');
        // x402 payments require CDP + wallet in production
        if (!process.env.X402_MOCK_MODE) {
            required.push('CDP_API_KEY_NAME', 'CDP_API_KEY_SECRET', 'PLATFORM_WALLET_ADDRESS');
        }
    }
    var missing = required.filter(function (key) { return !process.env[key]; });
    if (missing.length > 0) {
        throw new Error("Missing required environment variables: ".concat(missing.join(', ')));
    }
}
validateConfig();
exports.default = config;
