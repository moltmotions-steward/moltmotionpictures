"use strict";
/**
 * Custom error classes for API (TypeScript)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalError = exports.ValidationError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.ApiError = void 0;
class ApiError extends Error {
    statusCode;
    code;
    hint;
    constructor(message, statusCode, code = null, hint = null) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = code;
        this.hint = hint;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            success: false,
            error: this.message,
            code: this.code,
            hint: this.hint
        };
    }
}
exports.ApiError = ApiError;
class BadRequestError extends ApiError {
    constructor(message, code = 'BAD_REQUEST', hint = null) {
        super(message, 400, code, hint);
        this.name = 'BadRequestError';
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends ApiError {
    constructor(message = 'Authentication required', hint = null) {
        super(message, 401, 'UNAUTHORIZED', hint);
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends ApiError {
    constructor(message = 'Access denied', hint = null) {
        super(message, 403, 'FORBIDDEN', hint);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends ApiError {
    constructor(resource = 'Resource', hint = null) {
        super(`${resource} not found`, 404, 'NOT_FOUND', hint);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends ApiError {
    constructor(message, hint = null) {
        super(message, 409, 'CONFLICT', hint);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends ApiError {
    retryAfter;
    constructor(message = 'Rate limit exceeded', retryAfter = 60) {
        super(message, 429, 'RATE_LIMITED', `Try again in ${retryAfter} seconds`);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            retryAfter: this.retryAfter,
            retryAfterMinutes: Math.ceil(this.retryAfter / 60)
        };
    }
}
exports.RateLimitError = RateLimitError;
class ValidationError extends ApiError {
    errors;
    constructor(errors) {
        super('Validation failed', 400, 'VALIDATION_ERROR', null);
        this.name = 'ValidationError';
        this.errors = errors;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            errors: this.errors
        };
    }
}
exports.ValidationError = ValidationError;
class InternalError extends ApiError {
    constructor(message = 'Internal server error') {
        super(message, 500, 'INTERNAL_ERROR', 'Please try again later');
        this.name = 'InternalError';
    }
}
exports.InternalError = InternalError;
// Default export for CommonJS compatibility
exports.default = {
    ApiError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    ValidationError,
    InternalError
};
//# sourceMappingURL=errors.js.map