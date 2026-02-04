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
    clientId: string | undefined;
    clientSecret: string | undefined;
    bearerToken: string | undefined;
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
    payouts: PayoutsConfig;
    x402: X402Config;
    cdp: CdpConfig;
    twitter: TwitterConfig;
    posthog: PosthogConfig;
}
declare const config: AppConfig;
export default config;
export type { AppConfig, CdpConfig, PosthogConfig, RateLimitConfig, RevenueSplitConfig, TwitterConfig, X402Config };
//# sourceMappingURL=index.d.ts.map