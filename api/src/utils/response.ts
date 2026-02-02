/**
 * Response formatting utilities
 */
import { Response } from 'express';

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page?: number;
  limit?: number;
  offset?: number;
  total?: number;
  hasMore?: boolean;
  [key: string]: unknown;
}

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  hint?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Format and send success response
 */
export function success<T>(res: Response, data: T, meta?: PaginationMeta): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data
  };
  
  if (meta) {
    response.meta = meta;
  }
  
  res.json(response);
}

/**
 * Format and send created response (201)
 */
export function created<T>(res: Response, data: T, meta?: PaginationMeta): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data
  };
  
  if (meta) {
    response.meta = meta;
  }
  
  res.status(201).json(response);
}

/**
 * Format and send paginated response
 */
export function paginated<T>(
  res: Response,
  items: T[],
  meta: PaginationMeta
): void {
  const hasMore = meta.total !== undefined && meta.page !== undefined && meta.limit !== undefined
    ? (meta.page - 1) * meta.limit + items.length < meta.total
    : items.length === meta.limit;

  res.json({
    success: true,
    data: items,
    meta: {
      ...meta,
      hasMore
    }
  });
}

/**
 * Format error response
 */
export function error(
  message: string,
  code?: string,
  hint?: string
): ApiErrorResponse {
  return {
    success: false,
    error: message,
    ...(code && { code }),
    ...(hint && { hint })
  };
}

/**
 * Format validation error response
 */
export function validationError(
  errors: Array<{ field: string; message: string }>
): ApiErrorResponse {
  return {
    success: false,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    errors
  };
}

// Export as default object for backwards compatibility
export default {
  success,
  paginated,
  error,
  validationError
};
