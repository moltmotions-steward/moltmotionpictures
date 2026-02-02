/**
 * Custom error classes for API (TypeScript)
 */
export interface ApiErrorJSON {
    success: false;
    error: string;
    code: string | null;
    hint: string | null;
}
export declare class ApiError extends Error {
    readonly statusCode: number;
    readonly code: string | null;
    readonly hint: string | null;
    constructor(message: string, statusCode: number, code?: string | null, hint?: string | null);
    toJSON(): ApiErrorJSON;
}
export declare class BadRequestError extends ApiError {
    constructor(message: string, code?: string, hint?: string | null);
}
export declare class UnauthorizedError extends ApiError {
    constructor(message?: string, hint?: string | null);
}
export declare class ForbiddenError extends ApiError {
    constructor(message?: string, hint?: string | null);
}
export declare class NotFoundError extends ApiError {
    constructor(resource?: string, hint?: string | null);
}
export declare class ConflictError extends ApiError {
    constructor(message: string, hint?: string | null);
}
export interface RateLimitErrorJSON extends ApiErrorJSON {
    retryAfter: number;
    retryAfterMinutes: number;
}
export declare class RateLimitError extends ApiError {
    readonly retryAfter: number;
    constructor(message?: string, retryAfter?: number);
    toJSON(): RateLimitErrorJSON;
}
export interface ValidationErrorField {
    field: string;
    message: string;
    code?: string;
}
export interface ValidationErrorJSON extends ApiErrorJSON {
    errors: ValidationErrorField[];
}
export declare class ValidationError extends ApiError {
    readonly errors: ValidationErrorField[];
    constructor(errors: ValidationErrorField[]);
    toJSON(): ValidationErrorJSON;
}
export declare class InternalError extends ApiError {
    constructor(message?: string);
}
declare const _default: {
    ApiError: typeof ApiError;
    BadRequestError: typeof BadRequestError;
    UnauthorizedError: typeof UnauthorizedError;
    ForbiddenError: typeof ForbiddenError;
    NotFoundError: typeof NotFoundError;
    ConflictError: typeof ConflictError;
    RateLimitError: typeof RateLimitError;
    ValidationError: typeof ValidationError;
    InternalError: typeof InternalError;
};
export default _default;
//# sourceMappingURL=errors.d.ts.map