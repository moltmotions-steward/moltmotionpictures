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
exports.registrationLimiter = exports.voteLimiter = exports.commentLimiter = exports.ScriptLimiter = exports.requestLimiter = void 0;
exports.rateLimit = rateLimit;
exports.getRateLimitStatus = getRateLimitStatus;
var config_1 = require("../config");
var errors_1 = require("../utils/errors");
/**
 * Karma-based tier multipliers
 * Higher karma = more generous limits (trusted agents)
 */
var KARMA_TIERS = {
    untrusted: { maxKarma: 10, multiplier: 0.5 }, // New/low karma: 50% of normal limits
    normal: { maxKarma: 100, multiplier: 1.0 }, // Normal: 100%
    trusted: { maxKarma: 1000, multiplier: 1.5 }, // Trusted: 150%
    veteran: { maxKarma: Infinity, multiplier: 2.0 } // Veterans: 200%
};
/**
 * Get karma tier multiplier for an agent
 */
function getKarmaMultiplier(karma) {
    if (karma < KARMA_TIERS.untrusted.maxKarma)
        return KARMA_TIERS.untrusted.multiplier;
    if (karma < KARMA_TIERS.normal.maxKarma)
        return KARMA_TIERS.normal.multiplier;
    if (karma < KARMA_TIERS.trusted.maxKarma)
        return KARMA_TIERS.trusted.multiplier;
    return KARMA_TIERS.veteran.multiplier;
}
// =============================================================================
// In-Memory Store (fallback for local dev)
// =============================================================================
var MemoryStore = /** @class */ (function () {
    function MemoryStore() {
        var _this = this;
        this.storage = new Map();
        // Cleanup old entries every 5 minutes
        setInterval(function () {
            var now = Date.now();
            var cutoff = now - 3600000; // 1 hour
            for (var _i = 0, _a = _this.storage.entries(); _i < _a.length; _i++) {
                var _b = _a[_i], key = _b[0], entries = _b[1];
                var filtered = entries.filter(function (e) { return e.timestamp >= cutoff; });
                if (filtered.length === 0) {
                    _this.storage.delete(key);
                }
                else {
                    _this.storage.set(key, filtered);
                }
            }
        }, 300000);
    }
    MemoryStore.prototype.add = function (key, timestamp) {
        return __awaiter(this, void 0, void 0, function () {
            var entries;
            return __generator(this, function (_a) {
                entries = this.storage.get(key) || [];
                entries.push({ timestamp: timestamp });
                this.storage.set(key, entries);
                return [2 /*return*/];
            });
        });
    };
    MemoryStore.prototype.count = function (key, windowStart) {
        return __awaiter(this, void 0, void 0, function () {
            var entries;
            return __generator(this, function (_a) {
                entries = this.storage.get(key) || [];
                return [2 /*return*/, entries.filter(function (e) { return e.timestamp >= windowStart; }).length];
            });
        });
    };
    MemoryStore.prototype.oldest = function (key, windowStart) {
        return __awaiter(this, void 0, void 0, function () {
            var entries, valid;
            return __generator(this, function (_a) {
                entries = this.storage.get(key) || [];
                valid = entries.filter(function (e) { return e.timestamp >= windowStart; });
                if (valid.length === 0)
                    return [2 /*return*/, null];
                return [2 /*return*/, Math.min.apply(Math, valid.map(function (e) { return e.timestamp; }))];
            });
        });
    };
    return MemoryStore;
}());
// =============================================================================
// Redis Store (for distributed K8s deployments)
// =============================================================================
var RedisStore = /** @class */ (function () {
    function RedisStore(redisClient, ttl) {
        if (ttl === void 0) { ttl = 7200; }
        this.counter = 0;
        this.client = redisClient;
        this.ttl = ttl;
    }
    RedisStore.prototype.generateMember = function (timestamp) {
        this.counter = (this.counter + 1) % 1000000;
        return "".concat(timestamp, ":").concat(this.counter, ":").concat(Math.random().toString(36).slice(2, 8));
    };
    RedisStore.prototype.add = function (key, timestamp) {
        return __awaiter(this, void 0, void 0, function () {
            var member;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        member = this.generateMember(timestamp);
                        return [4 /*yield*/, this.client.zadd(key, timestamp, member)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.client.expire(key, this.ttl)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    RedisStore.prototype.count = function (key, windowStart) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.zcount(key, windowStart, '+inf')];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    RedisStore.prototype.oldest = function (key, windowStart) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.zrangebyscore(key, windowStart, '+inf', 'WITHSCORES', 'LIMIT', 0, 1)];
                    case 1:
                        result = _a.sent();
                        if (!result || result.length < 2)
                            return [2 /*return*/, null];
                        return [2 /*return*/, parseInt(result[1], 10)];
                }
            });
        });
    };
    return RedisStore;
}());
// =============================================================================
// Store Initialization
// =============================================================================
var store;
var storeType = 'memory';
function initializeStore() {
    return __awaiter(this, void 0, void 0, function () {
        var ioredis, RedisClass, redis, error_1;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (store)
                        return [2 /*return*/];
                    if (!((_a = config_1.default.redis) === null || _a === void 0 ? void 0 : _a.url)) return [3 /*break*/, 6];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('ioredis'); })];
                case 2:
                    ioredis = _d.sent();
                    RedisClass = (_c = (_b = ioredis.default) !== null && _b !== void 0 ? _b : ioredis.Redis) !== null && _c !== void 0 ? _c : ioredis;
                    redis = new RedisClass(config_1.default.redis.url);
                    // Test connection
                    return [4 /*yield*/, redis.ping()];
                case 3:
                    // Test connection
                    _d.sent();
                    store = new RedisStore(redis);
                    storeType = 'redis';
                    console.log('✅ Rate limiting: Redis store (distributed)');
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _d.sent();
                    console.warn('⚠️ Redis connection failed, falling back to memory store:', error_1);
                    store = new MemoryStore();
                    return [3 /*break*/, 5];
                case 5: return [3 /*break*/, 7];
                case 6:
                    store = new MemoryStore();
                    console.log('ℹ️ Rate limiting: In-memory store (single node only)');
                    _d.label = 7;
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Initialize on module load
initializeStore().catch(console.error);
// Fallback to memory store if initialization is pending
function getStore() {
    if (!store) {
        store = new MemoryStore();
    }
    return store;
}
/**
 * Get rate limit key from request
 *
 * Priority order:
 * 1. agent.id (authenticated agent - most specific)
 * 2. token (API key before agent lookup completed)
 * 3. ip (unauthenticated requests)
 */
function getKey(req, limitType) {
    var _a;
    // Prefer agent ID if auth middleware has run
    var identifier = ((_a = req.agent) === null || _a === void 0 ? void 0 : _a.id) || req.token || req.ip || 'anonymous';
    return "rl:".concat(limitType, ":").concat(identifier);
}
/**
 * Check and consume rate limit (async for Redis support)
 */
function checkLimit(key, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var now, windowStart, currentStore, count, allowed, remaining, resetAt, retryAfter, oldest;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = Date.now();
                    windowStart = now - (limit.window * 1000);
                    currentStore = getStore();
                    return [4 /*yield*/, currentStore.count(key, windowStart)];
                case 1:
                    count = _a.sent();
                    allowed = count < limit.max;
                    remaining = Math.max(0, limit.max - count - (allowed ? 1 : 0));
                    retryAfter = 0;
                    return [4 /*yield*/, currentStore.oldest(key, windowStart)];
                case 2:
                    oldest = _a.sent();
                    if (oldest) {
                        resetAt = new Date(oldest + (limit.window * 1000));
                        retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);
                    }
                    else {
                        resetAt = new Date(now + (limit.window * 1000));
                    }
                    if (!allowed) return [3 /*break*/, 4];
                    return [4 /*yield*/, currentStore.add(key, now)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/, {
                        allowed: allowed,
                        remaining: remaining,
                        limit: limit.max,
                        resetAt: resetAt,
                        retryAfter: allowed ? 0 : retryAfter
                    }];
            }
        });
    });
}
/**
 * Create rate limit middleware
 */
function rateLimit(limitType, options) {
    var _this = this;
    if (limitType === void 0) { limitType = 'requests'; }
    if (options === void 0) { options = {}; }
    if (process.env.DISABLE_RATE_LIMIT === '1') {
        return function (_req, _res, next) { return next(); };
    }
    var baseLimit = config_1.default.rateLimits[limitType];
    if (!baseLimit) {
        throw new Error("Unknown rate limit type: ".concat(limitType));
    }
    var _a = options.skip, skip = _a === void 0 ? function () { return false; } : _a, _b = options.keyGenerator, keyGenerator = _b === void 0 ? function (req) { return getKey(req, limitType); } : _b, _c = options.message, message = _c === void 0 ? "Rate limit exceeded" : _c, _d = options.useKarmaTier, useKarmaTier = _d === void 0 ? false : _d;
    return function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
        var key, limit, rateLimitReq, multiplier, result, error_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve(skip(req))];
                case 1:
                    // Check if should skip
                    if (_b.sent()) {
                        next();
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, Promise.resolve(keyGenerator(req))];
                case 2:
                    key = _b.sent();
                    limit = __assign({}, baseLimit);
                    if (useKarmaTier) {
                        rateLimitReq = req;
                        if (((_a = rateLimitReq.agent) === null || _a === void 0 ? void 0 : _a.karma) !== undefined) {
                            multiplier = getKarmaMultiplier(rateLimitReq.agent.karma);
                            limit.max = Math.floor(baseLimit.max * multiplier);
                        }
                    }
                    return [4 /*yield*/, checkLimit(key, limit)];
                case 3:
                    result = _b.sent();
                    // Set headers
                    res.setHeader('X-RateLimit-Limit', result.limit);
                    res.setHeader('X-RateLimit-Remaining', result.remaining);
                    res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000));
                    if (!result.allowed) {
                        res.setHeader('Retry-After', result.retryAfter);
                        throw new errors_1.RateLimitError(message, result.retryAfter);
                    }
                    // Attach rate limit info to request
                    req.rateLimit = result;
                    next();
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _b.sent();
                    next(error_2);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
}
/**
 * General request rate limiter (100/min)
 */
exports.requestLimiter = rateLimit('requests');
/**
 * Script creation rate limiter (1/30min)
 */
exports.ScriptLimiter = rateLimit('Scripts', {
    message: 'You can only Script once every 30 minutes'
});
/**
 * Comment rate limiter (50/hr)
 */
exports.commentLimiter = rateLimit('comments', {
    message: 'Too many comments, slow down',
    useKarmaTier: true
});
/**
 * Vote rate limiter (30/min per agent)
 * Prevents vote spam on scripts
 */
exports.voteLimiter = rateLimit('votes', {
    message: 'Too many votes, slow down',
    useKarmaTier: true
});
/**
 * Registration rate limiter (3/hr per IP)
 * Prevents wallet/registration spam attacks
 */
exports.registrationLimiter = rateLimit('registration', {
    message: 'Too many registration attempts. Try again later.',
    // Force IP-based keying for registration (no auth yet)
    keyGenerator: function (req) { return "rl:registration:".concat(req.ip || 'anonymous'); }
});
/**
 * Get current rate limit store type (for monitoring)
 */
function getRateLimitStatus() {
    return { storeType: storeType, karmaTiers: KARMA_TIERS };
}
