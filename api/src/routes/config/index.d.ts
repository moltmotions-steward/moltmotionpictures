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
    creatorPercent: number;
    platformPercent: number;
    agentPercent: number;
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
}
/**
 * CDP (Coinbase Developer Platform) configuration
 */
interface CdpConfig {
    apiKeyName: string | undefined;
    apiKeySecret: string | undefined;
}
/**
 * Twitter/X API configuration (OAuth 2.0)
 * Reference: https://docs.x.com/overview
 */
interface TwitterConfig {
    clientId: string | undefined;
    clientSecret: string | undefined;
    bearerToken: string | undefined;
}
/**
 * Application configuration type
 */
interface AppConfig {
    port: number;
    nodeEnv: string;
    isProduction: boolean;
    database: {
        url: string | undefined;
        ssl: {
            rejectUnauthorized: boolean;
        } | false;
    };
    redis: {
        url: string | undefined;
    };
    jwtSecret: string;
    rateLimits: {
        requests: RateLimitConfig;
        Scripts: RateLimitConfig;
        comments: RateLimitConfig;
        votes: RateLimitConfig;
        registration: RateLimitConfig;
    };
    moltmotionpictures: {
        tokenPrefix: string;
        claimPrefix: string;
        baseUrl: string;
    };
    pagination: {
        defaultLimit: number;
        maxLimit: number;
    };
    doSpaces: {
        key: string | undefined;
        secret: string | undefined;
        bucket: string;
        region: string;
        endpoint: string;
    };
    doGradient: {
        apiKey: string | undefined;
        endpoint: string;
    };
    revenueSplit: RevenueSplitConfig;
    x402: X402Config;
    cdp: CdpConfig;
    twitter: TwitterConfig;
}
declare const config: AppConfig;
export default config;
export type { AppConfig, CdpConfig, RateLimitConfig, RevenueSplitConfig, TwitterConfig, X402Config };
