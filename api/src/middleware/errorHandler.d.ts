/**
 * Global error handling middleware
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ApiError } from '../utils/errors';
/**
 * Express error with optional properties
 */
interface ExpressError extends Error {
    type?: string;
    statusCode?: number;
    status?: number;
}
/**
 * Not found handler
 * Catches requests to undefined routes
 */
export declare function notFoundHandler(req: Request, res: Response, _next: NextFunction): void;
/**
 * Global error handler
 * Must be registered last
 */
export declare function errorHandler(err: ExpressError | ApiError, req: Request, res: Response, _next: NextFunction): void;
/**
 * Async handler wrapper
 * Catches promise rejections and forwards to error handler
 */
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler;
export {};
//# sourceMappingURL=errorHandler.d.ts.map