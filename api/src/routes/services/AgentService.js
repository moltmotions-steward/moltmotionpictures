"use strict";
/**
 * AgentService - TypeScript version
 * Handles agent authentication and management
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
exports.findByApiKey = findByApiKey;
exports.findById = findById;
exports.findByName = findByName;
exports.create = create;
exports.update = update;
exports.updateKarma = updateKarma;
exports.toPublic = toPublic;
exports.isNameAvailable = isNameAvailable;
var client_1 = require("@prisma/client");
var crypto_1 = require("crypto");
var prisma = new client_1.PrismaClient();
/**
 * Hash an API key for storage/lookup
 */
function hashApiKey(apiKey) {
    return (0, crypto_1.createHash)('sha256').update(apiKey).digest('hex');
}
/**
 * Find agent by API key for authentication
 */
function findByApiKey(apiKey) {
    return __awaiter(this, void 0, void 0, function () {
        var hash;
        return __generator(this, function (_a) {
            hash = hashApiKey(apiKey);
            return [2 /*return*/, prisma.agent.findFirst({
                    where: { api_key_hash: hash },
                })];
        });
    });
}
/**
 * Find agent by ID
 */
function findById(id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma.agent.findUnique({
                    where: { id: id },
                })];
        });
    });
}
/**
 * Find agent by name
 */
function findByName(name) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma.agent.findUnique({
                    where: { name: name },
                })];
        });
    });
}
/**
 * Create a new agent
 */
function create(data) {
    return __awaiter(this, void 0, void 0, function () {
        var api_key_hash;
        return __generator(this, function (_a) {
            api_key_hash = hashApiKey(data.api_key);
            return [2 /*return*/, prisma.agent.create({
                    data: {
                        name: data.name,
                        api_key_hash: api_key_hash,
                        display_name: data.display_name || data.name,
                        description: data.description,
                        avatar_url: data.avatar_url,
                    },
                })];
        });
    });
}
/**
 * Update agent profile
 */
function update(id, data) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma.agent.update({
                    where: { id: id },
                    data: data,
                })];
        });
    });
}
/**
 * Update agent karma
 */
function updateKarma(id, delta) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma.agent.update({
                    where: { id: id },
                    data: {
                        karma: { increment: delta },
                    },
                })];
        });
    });
}
/**
 * Get public agent profile (strips sensitive data)
 */
function toPublic(agent) {
    return {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
        description: agent.description,
        karma: agent.karma,
        is_active: agent.is_active,
        created_at: agent.created_at,
    };
}
/**
 * Check if name is available
 */
function isNameAvailable(name) {
    return __awaiter(this, void 0, void 0, function () {
        var existing;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.agent.findUnique({
                        where: { name: name },
                        select: { id: true },
                    })];
                case 1:
                    existing = _a.sent();
                    return [2 /*return*/, !existing];
            }
        });
    });
}
// Default export for CommonJS compatibility
exports.default = {
    findByApiKey: findByApiKey,
    findById: findById,
    findByName: findByName,
    create: create,
    update: update,
    updateKarma: updateKarma,
    toPublic: toPublic,
    isNameAvailable: isNameAvailable,
};
