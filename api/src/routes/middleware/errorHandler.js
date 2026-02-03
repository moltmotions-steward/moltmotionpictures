"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
exports.asyncHandler = asyncHandler;
var config_1 = require("../config");
var errors_1 = require("../utils/errors");
/**
 * Not found handler
 * Catches requests to undefined routes
 */
function notFoundHandler(req, res, _next) {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        hint: "".concat(req.method, " ").concat(req.path, " does not exist. Check the API documentation.")
    });
}
/**
 * Global error handler
 * Must be registered last
 */
function errorHandler(err, req, res, _next) {
    // Log error in development
    if (!config_1.default.isProduction) {
        console.error('Error:', err);
    }
    // Handle known API errors
    if (err instanceof errors_1.ApiError) {
        res.status(err.statusCode).json(err.toJSON());
        return;
    }
    // Handle validation errors from express
    if (err.type === 'entity.parse.failed') {
        res.status(400).json({
            success: false,
            error: 'Invalid JSON body',
            hint: 'Check your request body is valid JSON'
        });
        return;
    }
    // Handle unexpected errors
    var statusCode = err.statusCode || err.status || 500;
    var message = config_1.default.isProduction
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
function asyncHandler(fn) {
    return function (req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
