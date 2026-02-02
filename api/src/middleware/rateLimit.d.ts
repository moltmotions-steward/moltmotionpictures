/**
 * Rate limiting middleware
 *
 * Uses in-memory storage by default.
 * Can be configured to use Redis for distributed deployments.
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
export {};
//# sourceMappingURL=rateLimit.d.ts.map