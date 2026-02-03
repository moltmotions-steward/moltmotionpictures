"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.created = created;
exports.paginated = paginated;
exports.error = error;
exports.validationError = validationError;
/**
 * Format and send success response
 */
function success(res, data, meta) {
    const response = {
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
function created(res, data, meta) {
    const response = {
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
function paginated(res, items, meta) {
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
function error(message, code, hint) {
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
function validationError(errors) {
    return {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors
    };
}
// Export as default object for backwards compatibility
exports.default = {
    success,
    paginated,
    error,
    validationError
};
//# sourceMappingURL=response.js.map