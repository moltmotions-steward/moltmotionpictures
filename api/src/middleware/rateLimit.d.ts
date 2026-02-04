/**
 * Rate limiting middleware
 *
 * Uses Redis storage for distributed deployments (K8s).
 * Falls back to in-memory storage for local development.
 */
import { Request, RequestHandler } from 'express';
/**
 * Rate limit options
 */
interface RateLimitOptions {
    skip?: (req: Request) => boolean | Promise<boolean>;
    keyGenerator?: (req: Request) => string | Promise<string>;
    message?: string;
    /** Multiply limits based on agent karma tier */
    useKarmaTier?: boolean;
}
/**
 * Karma-based tier multipliers
 * Higher karma = more generous limits (trusted agents)
 */
declare const KARMA_TIERS: {
    untrusted: {
        maxKarma: number;
        multiplier: number;
    };
    normal: {
        maxKarma: number;
        multiplier: number;
    };
    trusted: {
        maxKarma: number;
        multiplier: number;
    };
    veteran: {
        maxKarma: number;
        multiplier: number;
    };
};
/**
 * Create rate limit middleware
 */
export declare function rateLimit(limitType?: string, options?: RateLimitOptions): RequestHandler;
/**
 * General request rate limiter (100/min)
 */
export declare const requestLimiter: RequestHandler;
/**
 * Script creation rate limiter (1/30min)
 */
export declare const ScriptLimiter: RequestHandler;
/**
 * Comment rate limiter (50/hr)
 */
export declare const commentLimiter: RequestHandler;
/**
 * Vote rate limiter (30/min per agent)
 * Prevents vote spam on scripts
 */
export declare const voteLimiter: RequestHandler;
/**
 * Staking rate limiter (10 operations per hour)
 * Prevents spam and abuse of staking operations
 */
export declare const stakingLimiter: RequestHandler;
/**
 * Registration rate limiter (3/hr per IP)
 * Prevents wallet/registration spam attacks
 */
export declare const registrationLimiter: RequestHandler;
/**
 * Get current rate limit store type (for monitoring)
 */
export declare function getRateLimitStatus(): {
    storeType: string;
    karmaTiers: typeof KARMA_TIERS;
};
export {};
//# sourceMappingURL=rateLimit.d.ts.map