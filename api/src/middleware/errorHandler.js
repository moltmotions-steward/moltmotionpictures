"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
exports.asyncHandler = asyncHandler;
const config_1 = __importDefault(require("../config"));
const errors_1 = require("../utils/errors");
/**
 * Not found handler
 * Catches requests to undefined routes
 */
function notFoundHandler(req, res, _next) {
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
    const statusCode = err.statusCode || err.status || 500;
    const message = config_1.default.isProduction
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
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
//# sourceMappingURL=errorHandler.js.map