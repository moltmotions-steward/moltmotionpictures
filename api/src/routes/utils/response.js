"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
    var response = {
        success: true,
        data: data
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
    var response = {
        success: true,
        data: data
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
    var hasMore = meta.total !== undefined && meta.page !== undefined && meta.limit !== undefined
        ? (meta.page - 1) * meta.limit + items.length < meta.total
        : items.length === meta.limit;
    res.json({
        success: true,
        data: items,
        meta: __assign(__assign({}, meta), { hasMore: hasMore })
    });
}
/**
 * Format error response
 */
function error(message, code, hint) {
    return __assign(__assign({ success: false, error: message }, (code && { code: code })), (hint && { hint: hint }));
}
/**
 * Format validation error response
 */
function validationError(errors) {
    return {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: errors
    };
}
// Export as default object for backwards compatibility
exports.default = {
    success: success,
    paginated: paginated,
    error: error,
    validationError: validationError
};
