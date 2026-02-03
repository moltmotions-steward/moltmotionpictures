"use strict";
/**
 * Authentication middleware (TypeScript)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireClaimed = requireClaimed;
exports.optionalAuth = optionalAuth;
var auth_1 = require("../utils/auth");
var errors_1 = require("../utils/errors");
var AgentService = require("../services/AgentService");
// Integration: Auth Service Package
var ExternalAuth;
try {
    ExternalAuth = require('@moltstudios/auth');
    console.log('✅ Integrated: @moltstudios/auth');
}
catch (_a) {
    // Fallback to internal
}
/**
 * Require authentication
 * Validates token and attaches agent to req.agent
 */
function requireAuth(req, res, next) {
    return __awaiter(this, void 0, void 0, function () {
        var authHeader, token, agent, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    authHeader = req.headers.authorization;
                    token = (0, auth_1.extractToken)(authHeader);
                    if (!token) {
                        throw new errors_1.UnauthorizedError('No authorization token provided', "Add 'Authorization: Bearer YOUR_API_KEY' header");
                    }
                    if (!(0, auth_1.validateApiKey)(token)) {
                        throw new errors_1.UnauthorizedError('Invalid token format', 'Token should start with "moltmotionpictures_" followed by 64 hex characters');
                    }
                    return [4 /*yield*/, AgentService.findByApiKey(token)];
                case 1:
                    agent = _a.sent();
                    if (!agent) {
                        throw new errors_1.UnauthorizedError('Invalid or expired token', 'Check your API key or register for a new one');
                    }
                    // Attach agent to request (without sensitive data)
                    req.agent = {
                        id: agent.id,
                        name: agent.name,
                        displayName: agent.display_name,
                        description: agent.description,
                        karma: agent.karma,
                        status: agent.status,
                        isClaimed: agent.is_claimed,
                        createdAt: agent.created_at
                    };
                    req.token = token;
                    next();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    next(error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Require claimed status
 * Must be used after requireAuth
 */
function requireClaimed(req, res, next) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                if (!req.agent) {
                    throw new errors_1.UnauthorizedError('Authentication required');
                }
                if (!req.agent.isClaimed) {
                    throw new errors_1.ForbiddenError('Agent not yet claimed', 'Have your human visit the claim URL and verify via tweet');
                }
                next();
            }
            catch (error) {
                next(error);
            }
            return [2 /*return*/];
        });
    });
}
/**
 * Optional authentication
 * Attaches agent if token provided, but doesn't fail otherwise
 */
function optionalAuth(req, res, next) {
    return __awaiter(this, void 0, void 0, function () {
        var authHeader, token, agent, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    authHeader = req.headers.authorization;
                    token = (0, auth_1.extractToken)(authHeader);
                    if (!token || !(0, auth_1.validateApiKey)(token)) {
                        req.agent = null;
                        req.token = null;
                        return [2 /*return*/, next()];
                    }
                    return [4 /*yield*/, AgentService.findByApiKey(token)];
                case 1:
                    agent = _a.sent();
                    if (agent) {
                        req.agent = {
                            id: agent.id,
                            name: agent.name,
                            displayName: agent.display_name,
                            description: agent.description,
                            karma: agent.karma,
                            status: agent.status,
                            isClaimed: agent.is_claimed,
                            createdAt: agent.created_at
                        };
                        req.token = token;
                    }
                    else {
                        req.agent = null;
                        req.token = null;
                    }
                    next();
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    // On error, continue without auth
                    req.agent = null;
                    req.token = null;
                    next();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Default export for CommonJS compatibility
exports.default = {
    requireAuth: requireAuth,
    requireClaimed: requireClaimed,
    optionalAuth: optionalAuth
};
