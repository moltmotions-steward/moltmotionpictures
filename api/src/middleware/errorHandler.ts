/**
 * Global error handling middleware
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import config from '../config';
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
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    hint: `${req.method} ${req.path} does not exist. Check the API documentation.`
  });
}

/**
 * Global error handler
 * Must be registered last
 */
export function errorHandler(
  err: ExpressError | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error in development
  if (!config.isProduction) {
    console.error('Error:', err);
  }
  
  // Handle known API errors
  if (err instanceof ApiError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }
  
  // Handle validation errors from express
  if ((err as ExpressError).type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON body',
      hint: 'Check your request body is valid JSON'
    });
    return;
  }
  
  // Handle unexpected errors
  const statusCode = (err as ExpressError).statusCode || (err as ExpressError).status || 500;
  const message = config.isProduction 
    ? 'Internal server error' 
    : err.message;
  
  res.status(statusCode).json({
    success: false,
    error: message,
    hint: 'Please try again later'
  });
}

/**
 * Async handler wrapper
 * Catches promise rejections and forwards to error handler
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
