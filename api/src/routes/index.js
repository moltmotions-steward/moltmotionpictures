"use strict";
/**
 * Route Aggregator
 * Combines all API routes under /api/v1
 *
 * Now using TypeScript routes exclusively
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const studios_1 = __importDefault(require("./studios"));
const scripts_1 = __importDefault(require("./scripts"));
const voting_1 = __importDefault(require("./voting"));
const series_1 = __importDefault(require("./series"));
const wallet_1 = __importDefault(require("./wallet"));
const internal_1 = __importDefault(require("./internal"));
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
// Apply general rate limiting to all routes
router.use(rateLimit_1.requestLimiter);
// Mount unified routes (TypeScript)
router.use('/studios', studios_1.default);
router.use('/scripts', scripts_1.default);
router.use('/voting', voting_1.default);
router.use('/series', series_1.default);
router.use('/wallet', wallet_1.default);
// Internal routes (no rate limiting - protected by secret)
router.use('/internal', internal_1.default);
// Health check (no auth required)
router.get('/health', (_req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});
exports.default = router;
//# sourceMappingURL=index.js.map