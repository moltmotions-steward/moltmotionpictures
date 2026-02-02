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
}
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
 * Get current rate limit store type (for monitoring)
 */
export declare function getRateLimitStatus(): {
    storeType: string;
};
export {};
//# sourceMappingURL=rateLimit.d.ts.map