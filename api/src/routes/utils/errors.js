"use strict";
/**
 * Custom error classes for API (TypeScript)
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.InternalError = exports.ValidationError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.ApiError = void 0;
var ApiError = /** @class */ (function (_super) {
    __extends(ApiError, _super);
    function ApiError(message, statusCode, code, hint) {
        if (code === void 0) { code = null; }
        if (hint === void 0) { hint = null; }
        var _this = _super.call(this, message) || this;
        _this.name = 'ApiError';
        _this.statusCode = statusCode;
        _this.code = code;
        _this.hint = hint;
        Error.captureStackTrace(_this, _this.constructor);
        return _this;
    }
    ApiError.prototype.toJSON = function () {
        return {
            success: false,
            error: this.message,
            code: this.code,
            hint: this.hint
        };
    };
    return ApiError;
}(Error));
exports.ApiError = ApiError;
var BadRequestError = /** @class */ (function (_super) {
    __extends(BadRequestError, _super);
    function BadRequestError(message, code, hint) {
        if (code === void 0) { code = 'BAD_REQUEST'; }
        if (hint === void 0) { hint = null; }
        var _this = _super.call(this, message, 400, code, hint) || this;
        _this.name = 'BadRequestError';
        return _this;
    }
    return BadRequestError;
}(ApiError));
exports.BadRequestError = BadRequestError;
var UnauthorizedError = /** @class */ (function (_super) {
    __extends(UnauthorizedError, _super);
    function UnauthorizedError(message, hint) {
        if (message === void 0) { message = 'Authentication required'; }
        if (hint === void 0) { hint = null; }
        var _this = _super.call(this, message, 401, 'UNAUTHORIZED', hint) || this;
        _this.name = 'UnauthorizedError';
        return _this;
    }
    return UnauthorizedError;
}(ApiError));
exports.UnauthorizedError = UnauthorizedError;
var ForbiddenError = /** @class */ (function (_super) {
    __extends(ForbiddenError, _super);
    function ForbiddenError(message, hint) {
        if (message === void 0) { message = 'Access denied'; }
        if (hint === void 0) { hint = null; }
        var _this = _super.call(this, message, 403, 'FORBIDDEN', hint) || this;
        _this.name = 'ForbiddenError';
        return _this;
    }
    return ForbiddenError;
}(ApiError));
exports.ForbiddenError = ForbiddenError;
var NotFoundError = /** @class */ (function (_super) {
    __extends(NotFoundError, _super);
    function NotFoundError(resource, hint) {
        if (resource === void 0) { resource = 'Resource'; }
        if (hint === void 0) { hint = null; }
        var _this = _super.call(this, "".concat(resource, " not found"), 404, 'NOT_FOUND', hint) || this;
        _this.name = 'NotFoundError';
        return _this;
    }
    return NotFoundError;
}(ApiError));
exports.NotFoundError = NotFoundError;
var ConflictError = /** @class */ (function (_super) {
    __extends(ConflictError, _super);
    function ConflictError(message, hint) {
        if (hint === void 0) { hint = null; }
        var _this = _super.call(this, message, 409, 'CONFLICT', hint) || this;
        _this.name = 'ConflictError';
        return _this;
    }
    return ConflictError;
}(ApiError));
exports.ConflictError = ConflictError;
var RateLimitError = /** @class */ (function (_super) {
    __extends(RateLimitError, _super);
    function RateLimitError(message, retryAfter) {
        if (message === void 0) { message = 'Rate limit exceeded'; }
        if (retryAfter === void 0) { retryAfter = 60; }
        var _this = _super.call(this, message, 429, 'RATE_LIMITED', "Try again in ".concat(retryAfter, " seconds")) || this;
        _this.name = 'RateLimitError';
        _this.retryAfter = retryAfter;
        return _this;
    }
    RateLimitError.prototype.toJSON = function () {
        return __assign(__assign({}, _super.prototype.toJSON.call(this)), { retryAfter: this.retryAfter, retryAfterMinutes: Math.ceil(this.retryAfter / 60) });
    };
    return RateLimitError;
}(ApiError));
exports.RateLimitError = RateLimitError;
var ValidationError = /** @class */ (function (_super) {
    __extends(ValidationError, _super);
    function ValidationError(errors) {
        var _this = _super.call(this, 'Validation failed', 400, 'VALIDATION_ERROR', null) || this;
        _this.name = 'ValidationError';
        _this.errors = errors;
        return _this;
    }
    ValidationError.prototype.toJSON = function () {
        return __assign(__assign({}, _super.prototype.toJSON.call(this)), { errors: this.errors });
    };
    return ValidationError;
}(ApiError));
exports.ValidationError = ValidationError;
var InternalError = /** @class */ (function (_super) {
    __extends(InternalError, _super);
    function InternalError(message) {
        if (message === void 0) { message = 'Internal server error'; }
        var _this = _super.call(this, message, 500, 'INTERNAL_ERROR', 'Please try again later') || this;
        _this.name = 'InternalError';
        return _this;
    }
    return InternalError;
}(ApiError));
exports.InternalError = InternalError;
// Default export for CommonJS compatibility
exports.default = {
    ApiError: ApiError,
    BadRequestError: BadRequestError,
    UnauthorizedError: UnauthorizedError,
    ForbiddenError: ForbiddenError,
    NotFoundError: NotFoundError,
    ConflictError: ConflictError,
    RateLimitError: RateLimitError,
    ValidationError: ValidationError,
    InternalError: InternalError
};
