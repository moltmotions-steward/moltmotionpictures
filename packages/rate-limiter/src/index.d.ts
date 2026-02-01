/**
 * TypeScript definitions for @moltmotionpictures/rate-limiter
 */

import { Request, Response, NextFunction } from 'express';

// Limit configuration
export interface LimitConfig {
  max: number;
  window: number;
  message?: string;
}

export interface LimitsConfig {
  requests?: LimitConfig;
  posts?: LimitConfig;
  comments?: LimitConfig;
  [key: string]: LimitConfig | undefined;
}

// Store interface
export interface Store {
  add(key: string, timestamp: number, cost?: number): Promise<void>;
  count(key: string, windowStart: number): Promise<number>;
  oldest(key: string, windowStart: number): Promise<number | null>;
  cleanup(key: string, windowStart: number): Promise<void>;
  clear(key: string): Promise<void>;
  getEntries(key: string): Promise<Array<{ timestamp: number; cost: number }>>;
  destroy(): void;
}

// Rate limit results
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter: number;
  retryAfterMinutes?: number;
  message?: string;
}

export interface RateLimitStatus {
  used: number;
  remaining: number;
  max: number;
  window: number;
  resetAt: Date;
}

// RateLimiter options
export interface RateLimiterOptions {
  store?: Store;
  limits?: LimitsConfig;
  keyPrefix?: string;
}

// Main RateLimiter class
export class RateLimiter {
  constructor(options?: RateLimiterOptions);
  
  readonly store: Store;
  readonly limits: LimitsConfig;
  readonly keyPrefix: string;
  
  check(key: string, limitType?: string): Promise<RateLimitResult>;
  consume(key: string, limitType?: string, cost?: number): Promise<RateLimitResult>;
  reset(key: string, limitType?: string): Promise<void>;
  resetAll(key: string): Promise<void>;
  getStatus(key: string, limitType?: string): Promise<RateLimitStatus>;
  getAllStatuses(key: string): Promise<Record<string, RateLimitStatus>>;
  addLimit(name: string, config: LimitConfig): void;
}

// MemoryStore
export class MemoryStore implements Store {
  constructor();
  
  add(key: string, timestamp: number, cost?: number): Promise<void>;
  count(key: string, windowStart: number): Promise<number>;
  oldest(key: string, windowStart: number): Promise<number | null>;
  cleanup(key: string, windowStart: number): Promise<void>;
  clear(key: string): Promise<void>;
  getEntries(key: string): Promise<Array<{ timestamp: number; cost: number }>>;
  destroy(): void;
  getStats(): { keys: number; totalEntries: number; memoryUsage: number };
}

// RedisStore
export class RedisStore implements Store {
  constructor(client: any, options?: { ttl?: number });
  
  add(key: string, timestamp: number, cost?: number): Promise<void>;
  count(key: string, windowStart: number): Promise<number>;
  oldest(key: string, windowStart: number): Promise<number | null>;
  cleanup(key: string, windowStart: number): Promise<void>;
  clear(key: string): Promise<void>;
  getEntries(key: string): Promise<Array<{ member: string; timestamp: number; cost: number }>>;
  ping(): Promise<boolean>;
  destroy(): void;
}

// Middleware types
export interface RateLimitMiddlewareOptions {
  limitType?: string;
  keyGenerator?: (req: Request) => string | Promise<string>;
  skip?: (req: Request) => boolean | Promise<boolean>;
  onRateLimited?: (req: Request, res: Response, info: RateLimitResult) => void;
  headers?: boolean;
  cost?: number;
}

export interface RateLimitedRequest extends Request {
  rateLimit?: {
    limit: number;
    remaining: number;
    resetAt: Date;
  };
  rateLimitStatus?: RateLimitStatus;
  token?: string;
}

// Middleware functions
export function rateLimitMiddleware(
  limiter: RateLimiter,
  options?: RateLimitMiddlewareOptions
): (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function requestLimiter(
  limiter: RateLimiter,
  options?: Omit<RateLimitMiddlewareOptions, 'limitType'>
): (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function postLimiter(
  limiter: RateLimiter,
  options?: Omit<RateLimitMiddlewareOptions, 'limitType'>
): (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function commentLimiter(
  limiter: RateLimiter,
  options?: Omit<RateLimitMiddlewareOptions, 'limitType'>
): (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function rateLimitStatus(
  limiter: RateLimiter,
  options?: Pick<RateLimitMiddlewareOptions, 'limitType' | 'keyGenerator'>
): (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function defaultKeyGenerator(req: Request): string;

export function defaultOnRateLimited(req: Request, res: Response, info: RateLimitResult): void;

// Factory function
export function createmoltmotionpicturesLimiter(options?: RateLimiterOptions): RateLimiter;

// Constants
export const moltmotionpictures_LIMITS: {
  requests: LimitConfig;
  posts: LimitConfig;
  comments: LimitConfig;
};
