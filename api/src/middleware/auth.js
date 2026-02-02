"use strict";
/**
 * Authentication middleware (TypeScript)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireClaimed = requireClaimed;
exports.optionalAuth = optionalAuth;
const auth_1 = require("../utils/auth");
const errors_1 = require("../utils/errors");
const AgentService = __importStar(require("../services/AgentService"));
// Integration: Auth Service Package
let ExternalAuth;
try {
    ExternalAuth = require('@moltstudios/auth');
    console.log('✅ Integrated: @moltstudios/auth');
}
catch {
    // Fallback to internal
}
/**
 * Require authentication
 * Validates token and attaches agent to req.agent
 */
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = (0, auth_1.extractToken)(authHeader);
        if (!token) {
            throw new errors_1.UnauthorizedError('No authorization token provided', "Add 'Authorization: Bearer YOUR_API_KEY' header");
        }
        if (!(0, auth_1.validateApiKey)(token)) {
            throw new errors_1.UnauthorizedError('Invalid token format', 'Token should start with "moltmotionpictures_" followed by 64 hex characters');
        }
        const agent = await AgentService.findByApiKey(token);
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
    }
    catch (error) {
        next(error);
    }
}
/**
 * Require claimed status
 * Must be used after requireAuth
 */
async function requireClaimed(req, res, next) {
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
}
/**
 * Optional authentication
 * Attaches agent if token provided, but doesn't fail otherwise
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = (0, auth_1.extractToken)(authHeader);
        if (!token || !(0, auth_1.validateApiKey)(token)) {
            req.agent = null;
            req.token = null;
            return next();
        }
        const agent = await AgentService.findByApiKey(token);
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
    }
    catch (error) {
        // On error, continue without auth
        req.agent = null;
        req.token = null;
        next();
    }
}
// Default export for CommonJS compatibility
exports.default = {
    requireAuth,
    requireClaimed,
    optionalAuth
};
//# sourceMappingURL=auth.js.map