/**
 * Rate limiting middleware with progressive backoff
 *
 * Uses Redis storage for distributed deployments (K8s).
 * Falls back to in-memory storage for local development.
 *
 * Progressive backoff for registration:
 * Instead of immediate hard blocking, applies increasing delays:
 * 5s -> 10s -> 20s -> 40s -> 80s -> 160s -> 300s (capped at 5 min)
 */
import { Request, RequestHandler } from 'express';
import config from '../config';
/**
 * Rate limit options
 */
interface RateLimitOptions {
    skip?: (req: Request) => boolean | Promise<boolean>;
    keyGenerator?: (req: Request) => string | Promise<string>;
    message?: string;
    /** Multiply limits based on agent karma tier */
    useKarmaTier?: boolean;
    /** Use progressive backoff instead of hard blocking */
    useProgressiveBackoff?: boolean;
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
export declare const requestLimiter: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Script creation rate limiter (1/30min)
 */
export declare const ScriptLimiter: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Comment rate limiter (50/hr)
 */
export declare const commentLimiter: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Vote rate limiter (30/min per agent)
 * Prevents vote spam on scripts
 */
export declare const voteLimiter: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Registration rate limiter with progressive backoff
 *
 * Instead of hard blocking for 1 hour, uses exponential backoff:
 * - 1st excess: wait 5 seconds
 * - 2nd excess: wait 10 seconds
 * - 3rd excess: wait 20 seconds
 * - 4th excess: wait 40 seconds
 * - 5th excess: wait 80 seconds
 * - 6th excess: wait 160 seconds
 * - 7th+ excess: wait 300 seconds (5 min cap)
 *
 * Backoff resets after 1 hour of no failures.
 */
export declare const registrationLimiter: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Get current rate limit store type (for monitoring)
 */
export declare function getRateLimitStatus(): {
    storeType: string;
    karmaTiers: typeof KARMA_TIERS;
    backoffConfig: typeof config.backoff;
};
export {};
//# sourceMappingURL=rateLimit.d.ts.map