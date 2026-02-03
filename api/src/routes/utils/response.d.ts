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
export declare function success<T>(res: Response, data: T, meta?: PaginationMeta): void;
/**
 * Format and send created response (201)
 */
export declare function created<T>(res: Response, data: T, meta?: PaginationMeta): void;
/**
 * Format and send paginated response
 */
export declare function paginated<T>(res: Response, items: T[], meta: PaginationMeta): void;
/**
 * Format error response
 */
export declare function error(message: string, code?: string, hint?: string): ApiErrorResponse;
/**
 * Format validation error response
 */
export declare function validationError(errors: Array<{
    field: string;
    message: string;
}>): ApiErrorResponse;
declare const _default: {
    success: typeof success;
    paginated: typeof paginated;
    error: typeof error;
    validationError: typeof validationError;
};
export default _default;
