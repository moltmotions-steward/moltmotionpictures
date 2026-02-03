/**
 * Custom error classes for API (TypeScript)
 */

export interface ApiErrorJSON {
  success: false;
  error: string;
  code: string | null;
  hint: string | null;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string | null;
  public readonly hint: string | null;

  constructor(message: string, statusCode: number, code: string | null = null, hint: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.hint = hint;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ApiErrorJSON {
    return {
      success: false,
      error: this.message,
      code: this.code,
      hint: this.hint
    };
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, code: string = 'BAD_REQUEST', hint: string | null = null) {
    super(message, 400, code, hint);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Authentication required', hint: string | null = null) {
    super(message, 401, 'UNAUTHORIZED', hint);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Access denied', hint: string | null = null) {
    super(message, 403, 'FORBIDDEN', hint);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource', hint: string | null = null) {
    super(`${resource} not found`, 404, 'NOT_FOUND', hint);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, hint: string | null = null) {
    super(message, 409, 'CONFLICT', hint);
    this.name = 'ConflictError';
  }
}

export interface RateLimitErrorJSON extends ApiErrorJSON {
  retryAfter: number;
  retryAfterMinutes: number;
}

export class RateLimitError extends ApiError {
  public readonly retryAfter: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter: number = 60) {
    super(message, 429, 'RATE_LIMITED', `Try again in ${retryAfter} seconds`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }

  toJSON(): RateLimitErrorJSON {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
      retryAfterMinutes: Math.ceil(this.retryAfter / 60)
    };
  }
}

export interface ValidationErrorField {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationErrorJSON extends ApiErrorJSON {
  errors: ValidationErrorField[];
}

export class ValidationError extends ApiError {
  public readonly errors: ValidationErrorField[];

  constructor(errors: ValidationErrorField[]) {
    super('Validation failed', 400, 'VALIDATION_ERROR', null);
    this.name = 'ValidationError';
    this.errors = errors;
  }

  toJSON(): ValidationErrorJSON {
    return {
      ...super.toJSON(),
      errors: this.errors
    };
  }
}

export class InternalError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR', 'Please try again later');
    this.name = 'InternalError';
  }
}

// Default export for CommonJS compatibility
export default {
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
