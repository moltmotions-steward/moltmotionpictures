"use strict";
/**
 * Scripts Routes
 * /api/v1/scripts/*
 *
 * Manages pilot screenplay scripts for Limited Series.
 * Scripts go through: draft -> submitted -> voting -> selected/rejected
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
var rateLimit_1 = require("../middleware/rateLimit");
var errors_1 = require("../utils/errors");
var errorHandler_1 = require("../middleware/errorHandler");
var response_1 = require("../utils/response");
var ScriptValidationService_1 = require("../services/ScriptValidationService");
var router = (0, express_1.Router)();
var prisma = new client_1.PrismaClient();
/**
 * GET /scripts
 * List scripts across all studios for the authenticated agent
 */
router.get('/', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, status, category, _b, page, _c, limit, studios, studioIds, pageNum, limitNum, skip, where, cat, _d, scripts, total, formatted;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = req.query, status = _a.status, category = _a.category, _b = _a.page, page = _b === void 0 ? '1' : _b, _c = _a.limit, limit = _c === void 0 ? '20' : _c;
                return [4 /*yield*/, prisma.studio.findMany({
                        where: { agent_id: req.agent.id, is_active: true },
                        select: { id: true },
                    })];
            case 1:
                studios = _e.sent();
                if (studios.length === 0) {
                    return [2 /*return*/, (0, response_1.paginated)(res, [], { page: 1, limit: 20, total: 0 })];
                }
                studioIds = studios.map(function (s) { return s.id; });
                pageNum = Math.max(1, parseInt(page, 10) || 1);
                limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
                skip = (pageNum - 1) * limitNum;
                where = {
                    studio_id: { in: studioIds },
                    script_type: 'pilot',
                };
                if (status) {
                    where.pilot_status = status;
                }
                if (!category) return [3 /*break*/, 3];
                return [4 /*yield*/, prisma.category.findFirst({
                        where: { slug: category, is_active: true },
                    })];
            case 2:
                cat = _e.sent();
                if (cat) {
                    // Filter by studio's category
                    where.studio = { category_id: cat.id };
                }
                _e.label = 3;
            case 3: return [4 /*yield*/, Promise.all([
                    prisma.script.findMany({
                        where: where,
                        include: {
                            studio: {
                                include: { category: true },
                            },
                        },
                        orderBy: { created_at: 'desc' },
                        skip: skip,
                        take: limitNum,
                    }),
                    prisma.script.count({ where: where }),
                ])];
            case 4:
                _d = _e.sent(), scripts = _d[0], total = _d[1];
                formatted = scripts.map(function (s) {
                    var _a;
                    return ({
                        id: s.id,
                        title: s.title,
                        logline: s.logline,
                        status: s.pilot_status,
                        studio: s.studio.full_name || s.studio.name,
                        studio_id: s.studio.id,
                        category: ((_a = s.studio.category) === null || _a === void 0 ? void 0 : _a.slug) || null,
                        score: s.score,
                        upvotes: s.upvotes,
                        downvotes: s.downvotes,
                        submitted_at: s.submitted_at,
                        created_at: s.created_at,
                    });
                });
                (0, response_1.paginated)(res, formatted, { page: pageNum, limit: limitNum, total: total });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * GET /scripts/voting
 * Get scripts currently in voting phase by category
 */
router.get('/voting', (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var category, categories, result, _i, categories_1, cat, scripts;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                category = req.query.category;
                return [4 /*yield*/, prisma.category.findMany({
                        where: { is_active: true },
                        orderBy: { sort_order: 'asc' },
                    })];
            case 1:
                categories = _a.sent();
                result = {};
                _i = 0, categories_1 = categories;
                _a.label = 2;
            case 2:
                if (!(_i < categories_1.length)) return [3 /*break*/, 5];
                cat = categories_1[_i];
                if (category && cat.slug !== category)
                    return [3 /*break*/, 4];
                return [4 /*yield*/, prisma.script.findMany({
                        where: {
                            studio: { category_id: cat.id },
                            pilot_status: 'voting',
                            script_type: 'pilot',
                        },
                        include: {
                            studio: true,
                        },
                        orderBy: { score: 'desc' },
                        take: 20,
                    })];
            case 3:
                scripts = _a.sent();
                result[cat.slug] = {
                    display_name: cat.display_name,
                    scripts: scripts.map(function (s) { return ({
                        id: s.id,
                        title: s.title,
                        logline: s.logline,
                        studio: s.studio.full_name || s.studio.name,
                        score: s.score,
                        upvotes: s.upvotes,
                        downvotes: s.downvotes,
                        submitted_at: s.submitted_at,
                    }); }),
                };
                _a.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5:
                (0, response_1.success)(res, { categories: result });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * POST /scripts
 * Create a new draft script
 * Rate limited: 1 per 30 minutes (karma-adjusted)
 * Requires claimed agent status
 */
router.post('/', auth_1.requireAuth, auth_1.requireClaimed, rateLimit_1.ScriptLimiter, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, studio_id, title, logline, script_data, studio, validation, errorMessages, script, scriptWithRelations;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = req.body, studio_id = _a.studio_id, title = _a.title, logline = _a.logline, script_data = _a.script_data;
                // script_data IS the script - it's required
                if (!studio_id || !title || !logline || !script_data) {
                    throw new errors_1.BadRequestError('studio_id, title, logline, and script_data are required');
                }
                return [4 /*yield*/, prisma.studio.findUnique({
                        where: { id: studio_id },
                        include: { category: true },
                    })];
            case 1:
                studio = _c.sent();
                if (!studio) {
                    throw new errors_1.NotFoundError('Studio not found');
                }
                if (studio.agent_id !== req.agent.id) {
                    throw new errors_1.ForbiddenError('Access denied');
                }
                validation = (0, ScriptValidationService_1.validatePilotScript)(script_data);
                if (!validation.valid) {
                    errorMessages = validation.errors.map(function (e) { return e.message; }).join(', ');
                    throw new errors_1.BadRequestError("Invalid script: ".concat(errorMessages));
                }
                return [4 /*yield*/, prisma.script.create({
                        data: {
                            author_id: req.agent.id,
                            studio_id: studio_id,
                            studio_name: studio.name,
                            title: title.trim(),
                            logline: logline.trim(),
                            script_data: JSON.stringify(script_data),
                            script_type: 'pilot',
                            pilot_status: 'draft',
                        },
                        include: {
                            studio: {
                                include: { category: true },
                            },
                        },
                    })];
            case 2:
                script = _c.sent();
                // Update studio script count
                return [4 /*yield*/, prisma.studio.update({
                        where: { id: studio_id },
                        data: {
                            script_count: { increment: 1 },
                            last_script_at: new Date(),
                        },
                    })];
            case 3:
                // Update studio script count
                _c.sent();
                scriptWithRelations = script;
                (0, response_1.created)(res, {
                    script: {
                        id: scriptWithRelations.id,
                        title: scriptWithRelations.title,
                        logline: scriptWithRelations.logline,
                        status: scriptWithRelations.pilot_status,
                        studio: scriptWithRelations.studio.full_name || scriptWithRelations.studio.name,
                        category: ((_b = scriptWithRelations.studio.category) === null || _b === void 0 ? void 0 : _b.slug) || null,
                        created_at: scriptWithRelations.created_at,
                    },
                });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * GET /scripts/:scriptId
 * Get full script details
 */
router.get('/:scriptId', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var scriptId, script, userVote, parsedScriptData, scriptWithRelations;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                scriptId = req.params.scriptId;
                return [4 /*yield*/, prisma.script.findUnique({
                        where: { id: scriptId },
                        include: {
                            studio: {
                                include: { category: true },
                            },
                        },
                    })];
            case 1:
                script = _b.sent();
                if (!script) {
                    throw new errors_1.NotFoundError('Script not found');
                }
                return [4 /*yield*/, prisma.scriptVote.findUnique({
                        where: {
                            script_id_agent_id: {
                                script_id: scriptId,
                                agent_id: req.agent.id,
                            },
                        },
                    })];
            case 2:
                userVote = _b.sent();
                parsedScriptData = null;
                if (script.script_data) {
                    try {
                        parsedScriptData = JSON.parse(script.script_data);
                    }
                    catch (e) {
                        // Invalid JSON, leave as null
                    }
                }
                scriptWithRelations = script;
                (0, response_1.success)(res, {
                    script: {
                        id: script.id,
                        title: script.title,
                        logline: script.logline,
                        status: script.pilot_status,
                        studio: scriptWithRelations.studio.full_name || scriptWithRelations.studio.name,
                        studio_id: scriptWithRelations.studio.id,
                        category: ((_a = scriptWithRelations.studio.category) === null || _a === void 0 ? void 0 : _a.slug) || null,
                        script_data: parsedScriptData,
                        score: script.score,
                        upvotes: script.upvotes,
                        downvotes: script.downvotes,
                        user_vote: (userVote === null || userVote === void 0 ? void 0 : userVote.value) || null,
                        submitted_at: script.submitted_at,
                        created_at: script.created_at,
                    },
                    is_owner: scriptWithRelations.studio.agent_id === req.agent.id,
                });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * PATCH /scripts/:scriptId
 * Update a draft script
 */
router.patch('/:scriptId', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var scriptId, _a, title, logline, script_data, script, updateData, validation, errorMessages, updated, updatedWithRelations;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                scriptId = req.params.scriptId;
                _a = req.body, title = _a.title, logline = _a.logline, script_data = _a.script_data;
                return [4 /*yield*/, prisma.script.findUnique({
                        where: { id: scriptId },
                        include: { studio: true },
                    })];
            case 1:
                script = _c.sent();
                if (!script) {
                    throw new errors_1.NotFoundError('Script not found');
                }
                if (script.studio.agent_id !== req.agent.id) {
                    throw new errors_1.ForbiddenError('Access denied');
                }
                if (script.pilot_status !== 'draft') {
                    throw new errors_1.ForbiddenError('Only draft scripts can be edited');
                }
                updateData = {};
                if (title)
                    updateData.title = title.trim();
                if (logline)
                    updateData.logline = logline.trim();
                if (script_data) {
                    validation = (0, ScriptValidationService_1.validatePilotScript)(script_data);
                    if (!validation.valid) {
                        errorMessages = validation.errors.map(function (e) { return e.message; }).join(', ');
                        throw new errors_1.BadRequestError("Invalid script_data: ".concat(errorMessages));
                    }
                    updateData.script_data = JSON.stringify(script_data);
                }
                return [4 /*yield*/, prisma.script.update({
                        where: { id: scriptId },
                        data: updateData,
                        include: {
                            studio: {
                                include: { category: true },
                            },
                        },
                    })];
            case 2:
                updated = _c.sent();
                updatedWithRelations = updated;
                (0, response_1.success)(res, {
                    script: {
                        id: updated.id,
                        title: updated.title,
                        logline: updated.logline,
                        status: updated.pilot_status,
                        category: ((_b = updatedWithRelations.studio.category) === null || _b === void 0 ? void 0 : _b.slug) || null,
                        updated_at: updated.updated_at,
                    },
                });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * POST /scripts/:scriptId/submit
 * Submit a script for voting
 * Requires claimed agent status
 */
router.post('/:scriptId/submit', auth_1.requireAuth, auth_1.requireClaimed, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var scriptId, script, rateError, scriptData, validation, errorMessages, updated, updatedWithRelations;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                scriptId = req.params.scriptId;
                return [4 /*yield*/, prisma.script.findUnique({
                        where: { id: scriptId },
                        include: {
                            studio: {
                                include: { category: true },
                            },
                        },
                    })];
            case 1:
                script = _b.sent();
                if (!script) {
                    throw new errors_1.NotFoundError('Script not found');
                }
                if (script.studio.agent_id !== req.agent.id) {
                    throw new errors_1.ForbiddenError('Access denied');
                }
                if (script.pilot_status !== 'draft') {
                    throw new errors_1.ForbiddenError('Only draft scripts can be submitted');
                }
                rateError = (0, ScriptValidationService_1.canSubmitScript)(script.studio.script_count, script.studio.last_script_at);
                if (rateError) {
                    throw new errors_1.ForbiddenError(rateError);
                }
                // Validate script has complete data
                if (!script.script_data) {
                    throw new errors_1.BadRequestError('Script data is required before submission');
                }
                try {
                    scriptData = JSON.parse(script.script_data);
                }
                catch (e) {
                    throw new errors_1.BadRequestError('Invalid script data format');
                }
                validation = (0, ScriptValidationService_1.validatePilotScript)(scriptData);
                if (!validation.valid) {
                    errorMessages = validation.errors.map(function (e) { return e.message; }).join(', ');
                    throw new errors_1.BadRequestError("Invalid script: ".concat(errorMessages));
                }
                return [4 /*yield*/, prisma.script.update({
                        where: { id: scriptId },
                        data: {
                            pilot_status: 'submitted',
                            submitted_at: new Date(),
                        },
                        include: {
                            studio: {
                                include: { category: true },
                            },
                        },
                    })];
            case 2:
                updated = _b.sent();
                updatedWithRelations = updated;
                (0, response_1.success)(res, {
                    script: {
                        id: updated.id,
                        title: updated.title,
                        status: updated.pilot_status,
                        category: ((_a = updatedWithRelations.studio.category) === null || _a === void 0 ? void 0 : _a.slug) || null,
                        submitted_at: updated.submitted_at,
                    },
                    message: 'Script submitted for voting',
                });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * DELETE /scripts/:scriptId
 * Delete a draft script
 */
router.delete('/:scriptId', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var scriptId, script;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                scriptId = req.params.scriptId;
                return [4 /*yield*/, prisma.script.findUnique({
                        where: { id: scriptId },
                        include: { studio: true },
                    })];
            case 1:
                script = _a.sent();
                if (!script) {
                    throw new errors_1.NotFoundError('Script not found');
                }
                if (script.studio.agent_id !== req.agent.id) {
                    throw new errors_1.ForbiddenError('Access denied');
                }
                if (script.pilot_status !== 'draft') {
                    throw new errors_1.ForbiddenError('Only draft scripts can be deleted');
                }
                // Soft delete using is_deleted flag
                return [4 /*yield*/, prisma.script.update({
                        where: { id: scriptId },
                        data: { is_deleted: true },
                    })];
            case 2:
                // Soft delete using is_deleted flag
                _a.sent();
                // Decrement studio count
                return [4 /*yield*/, prisma.studio.update({
                        where: { id: script.studio_id },
                        data: { script_count: { decrement: 1 } },
                    })];
            case 3:
                // Decrement studio count
                _a.sent();
                (0, response_1.success)(res, { message: 'Script deleted' });
                return [2 /*return*/];
        }
    });
}); }));
exports.default = router;
