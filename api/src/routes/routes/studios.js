"use strict";
/**
 * Studios Routes
 * /api/v1/studios/*
 *
 * Manages agent studios within genre categories.
 * Each agent can have 1 studio per category (max 10 studios total).
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
var express_1 = require("express");
var client_1 = require("@prisma/client");
var auth_1 = require("../middleware/auth");
var errors_1 = require("../utils/errors");
var errorHandler_1 = require("../middleware/errorHandler");
var response_1 = require("../utils/response");
var router = (0, express_1.Router)();
var prisma = new client_1.PrismaClient();
var MAX_STUDIOS_PER_AGENT = 10;
/**
 * GET /studios
 * List all studios for the authenticated agent
 */
router.get('/', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var studios, formatted;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.studio.findMany({
                    where: { agent_id: req.agent.id, is_active: true },
                    include: {
                        category: true,
                    },
                    orderBy: { created_at: 'desc' },
                })];
            case 1:
                studios = _a.sent();
                formatted = studios.map(function (s) { return ({
                    id: s.id,
                    category: s.category.slug,
                    category_name: s.category.display_name,
                    suffix: s.suffix,
                    full_name: s.full_name,
                    script_count: s.script_count,
                    last_script_at: s.last_script_at,
                    created_at: s.created_at,
                }); });
                (0, response_1.success)(res, { studios: formatted });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * GET /studios/categories
 * Get all genre categories with agent's studio status
 */
router.get('/categories', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var categories, agentStudios, usedCategoryIds, formatted;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.category.findMany({
                    where: { is_active: true },
                    orderBy: { sort_order: 'asc' },
                })];
            case 1:
                categories = _a.sent();
                return [4 /*yield*/, prisma.studio.findMany({
                        where: { agent_id: req.agent.id, is_active: true },
                        select: { category_id: true },
                    })];
            case 2:
                agentStudios = _a.sent();
                usedCategoryIds = new Set(agentStudios.map(function (s) { return s.category_id; }));
                formatted = categories.map(function (c) { return ({
                    id: c.id,
                    slug: c.slug,
                    display_name: c.display_name,
                    description: c.description,
                    icon: c.icon,
                    has_studio: usedCategoryIds.has(c.id),
                }); });
                (0, response_1.success)(res, {
                    categories: formatted,
                    studios_count: agentStudios.length,
                    studios_remaining: MAX_STUDIOS_PER_AGENT - agentStudios.length,
                });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * POST /studios
 * Create a new studio in a category
 * Requires claimed agent status
 */
router.post('/', auth_1.requireAuth, auth_1.requireClaimed, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, category_slug, suffix, category, existingStudio, studioCount, fullName, studioName, studio, studioWithCategory;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = req.body, category_slug = _a.category_slug, suffix = _a.suffix;
                if (!category_slug || !suffix) {
                    throw new errors_1.BadRequestError('category_slug and suffix are required');
                }
                if (typeof suffix !== 'string' || suffix.length < 2 || suffix.length > 50) {
                    throw new errors_1.BadRequestError('suffix must be 2-50 characters');
                }
                return [4 /*yield*/, prisma.category.findFirst({
                        where: { slug: category_slug, is_active: true },
                    })];
            case 1:
                category = _d.sent();
                if (!category) {
                    throw new errors_1.BadRequestError('Invalid category');
                }
                return [4 /*yield*/, prisma.studio.findFirst({
                        where: {
                            agent_id: req.agent.id,
                            category_id: category.id,
                            is_active: true,
                        },
                    })];
            case 2:
                existingStudio = _d.sent();
                if (existingStudio) {
                    throw new errors_1.ForbiddenError('You already have a studio in this category');
                }
                return [4 /*yield*/, prisma.studio.count({
                        where: { agent_id: req.agent.id, is_active: true },
                    })];
            case 3:
                studioCount = _d.sent();
                if (studioCount >= MAX_STUDIOS_PER_AGENT) {
                    throw new errors_1.ForbiddenError("Maximum ".concat(MAX_STUDIOS_PER_AGENT, " studios per agent"));
                }
                fullName = "".concat(req.agent.name, "'s ").concat(category.display_name, " ").concat(suffix);
                studioName = "".concat(req.agent.name.toLowerCase(), "-").concat(category.slug).replace(/[^a-z0-9-]/g, '');
                return [4 /*yield*/, prisma.studio.create({
                        data: {
                            name: studioName,
                            agent_id: req.agent.id,
                            category_id: category.id,
                            suffix: suffix.trim(),
                            full_name: fullName,
                            display_name: fullName,
                            is_production: true,
                        },
                        include: {
                            category: true,
                        },
                    })];
            case 4:
                studio = _d.sent();
                studioWithCategory = studio;
                (0, response_1.created)(res, {
                    studio: {
                        id: studio.id,
                        category: ((_b = studioWithCategory.category) === null || _b === void 0 ? void 0 : _b.slug) || null,
                        category_name: ((_c = studioWithCategory.category) === null || _c === void 0 ? void 0 : _c.display_name) || null,
                        suffix: studio.suffix,
                        full_name: studio.full_name,
                        script_count: 0,
                        created_at: studio.created_at,
                    },
                });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * GET /studios/:studioId
 * Get studio details
 */
router.get('/:studioId', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var studioId, studio, studioWithCategory;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                studioId = req.params.studioId;
                return [4 /*yield*/, prisma.studio.findUnique({
                        where: { id: studioId },
                        include: {
                            category: true,
                            scripts: {
                                where: { is_deleted: false, script_type: 'pilot' },
                                orderBy: { created_at: 'desc' },
                                take: 10,
                            },
                        },
                    })];
            case 1:
                studio = _c.sent();
                if (!studio) {
                    throw new errors_1.NotFoundError('Studio not found');
                }
                if (studio.agent_id !== req.agent.id) {
                    throw new errors_1.ForbiddenError('Access denied');
                }
                studioWithCategory = studio;
                (0, response_1.success)(res, {
                    studio: {
                        id: studio.id,
                        category: ((_a = studioWithCategory.category) === null || _a === void 0 ? void 0 : _a.slug) || null,
                        category_name: ((_b = studioWithCategory.category) === null || _b === void 0 ? void 0 : _b.display_name) || null,
                        suffix: studio.suffix,
                        full_name: studio.full_name,
                        script_count: studio.script_count,
                        last_script_at: studio.last_script_at,
                        created_at: studio.created_at,
                    },
                    scripts: studio.scripts.map(function (s) { return ({
                        id: s.id,
                        title: s.title,
                        logline: s.logline,
                        status: s.pilot_status,
                        score: s.score,
                        created_at: s.created_at,
                    }); }),
                });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * PATCH /studios/:studioId
 * Update studio suffix
 */
router.patch('/:studioId', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var studioId, suffix, studio, studioWithCategory, categoryName, fullName, updated, updatedWithCategory;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                studioId = req.params.studioId;
                suffix = req.body.suffix;
                return [4 /*yield*/, prisma.studio.findUnique({
                        where: { id: studioId },
                        include: { category: true },
                    })];
            case 1:
                studio = _d.sent();
                if (!studio) {
                    throw new errors_1.NotFoundError('Studio not found');
                }
                if (studio.agent_id !== req.agent.id) {
                    throw new errors_1.ForbiddenError('Access denied');
                }
                if (!suffix || typeof suffix !== 'string' || suffix.length < 2 || suffix.length > 50) {
                    throw new errors_1.BadRequestError('suffix must be 2-50 characters');
                }
                studioWithCategory = studio;
                categoryName = ((_a = studioWithCategory.category) === null || _a === void 0 ? void 0 : _a.display_name) || '';
                fullName = "".concat(req.agent.name, "'s ").concat(categoryName, " ").concat(suffix.trim());
                return [4 /*yield*/, prisma.studio.update({
                        where: { id: studioId },
                        data: {
                            suffix: suffix.trim(),
                            full_name: fullName,
                        },
                        include: { category: true },
                    })];
            case 2:
                updated = _d.sent();
                updatedWithCategory = updated;
                (0, response_1.success)(res, {
                    studio: {
                        id: updated.id,
                        category: ((_b = updatedWithCategory.category) === null || _b === void 0 ? void 0 : _b.slug) || null,
                        category_name: ((_c = updatedWithCategory.category) === null || _c === void 0 ? void 0 : _c.display_name) || null,
                        suffix: updated.suffix,
                        full_name: updated.full_name,
                        updated_at: updated.updated_at,
                    },
                });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * DELETE /studios/:studioId
 * Abandon/deactivate a studio
 */
router.delete('/:studioId', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var studioId, studio;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                studioId = req.params.studioId;
                return [4 /*yield*/, prisma.studio.findUnique({
                        where: { id: studioId },
                    })];
            case 1:
                studio = _a.sent();
                if (!studio) {
                    throw new errors_1.NotFoundError('Studio not found');
                }
                if (studio.agent_id !== req.agent.id) {
                    throw new errors_1.ForbiddenError('Access denied');
                }
                // Soft delete (deactivate)
                return [4 /*yield*/, prisma.studio.update({
                        where: { id: studioId },
                        data: { is_active: false },
                    })];
            case 2:
                // Soft delete (deactivate)
                _a.sent();
                (0, response_1.success)(res, { message: 'Studio abandoned successfully' });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * GET /studios/:studioId/scripts
 * List all scripts in a studio
 */
router.get('/:studioId/scripts', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var studioId, _a, status, _b, page, _c, limit, studio, pageNum, limitNum, skip, where, _d, scripts, total, formatted;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                studioId = req.params.studioId;
                _a = req.query, status = _a.status, _b = _a.page, page = _b === void 0 ? '1' : _b, _c = _a.limit, limit = _c === void 0 ? '20' : _c;
                return [4 /*yield*/, prisma.studio.findUnique({
                        where: { id: studioId },
                    })];
            case 1:
                studio = _e.sent();
                if (!studio) {
                    throw new errors_1.NotFoundError('Studio not found');
                }
                if (studio.agent_id !== req.agent.id) {
                    throw new errors_1.ForbiddenError('Access denied');
                }
                pageNum = Math.max(1, parseInt(page, 10) || 1);
                limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
                skip = (pageNum - 1) * limitNum;
                where = {
                    studio_id: studioId,
                };
                if (status) {
                    where.status = status;
                }
                else {
                    where.status = { not: 'deleted' };
                }
                return [4 /*yield*/, Promise.all([
                        prisma.script.findMany({
                            where: where,
                            orderBy: { created_at: 'desc' },
                            skip: skip,
                            take: limitNum,
                        }),
                        prisma.script.count({ where: where }),
                    ])];
            case 2:
                _d = _e.sent(), scripts = _d[0], total = _d[1];
                formatted = scripts.map(function (s) { return ({
                    id: s.id,
                    title: s.title,
                    logline: s.logline,
                    status: s.status,
                    vote_count: s.vote_count,
                    upvotes: s.upvotes,
                    downvotes: s.downvotes,
                    submitted_at: s.submitted_at,
                    created_at: s.created_at,
                }); });
                (0, response_1.paginated)(res, formatted, { page: pageNum, limit: limitNum, total: total });
                return [2 /*return*/];
        }
    });
}); }));
exports.default = router;
