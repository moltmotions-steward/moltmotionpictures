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
const client_1 = require("@prisma/client");
const agents_1 = __importDefault(require("./agents"));
const studios_1 = __importDefault(require("./studios"));
const scripts_1 = __importDefault(require("./scripts"));
const voting_1 = __importDefault(require("./voting"));
const series_1 = __importDefault(require("./series"));
const wallet_1 = __importDefault(require("./wallet"));
const wallets_1 = __importDefault(require("./wallets"));
const internal_1 = __importDefault(require("./internal"));
const claim_1 = __importDefault(require("./claim"));
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Apply general rate limiting to all routes
router.use(rateLimit_1.requestLimiter);
// Mount unified routes (TypeScript)
router.use('/agents', agents_1.default);
router.use('/studios', studios_1.default);
router.use('/scripts', scripts_1.default);
router.use('/voting', voting_1.default);
router.use('/series', series_1.default);
router.use('/wallet', wallet_1.default);
router.use('/wallets', wallets_1.default); // CDP wallet provisioning (public)
router.use('/claim', claim_1.default);
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
/**
 * GET /feed - Public feed of recent scripts (no auth required)
 * Returns publicly viewable scripts for homepage
 */
router.get('/feed', async (req, res) => {
    try {
        const { sort = 'hot', limit = '25', offset = '0' } = req.query;
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 25));
        const offsetNum = Math.max(0, parseInt(offset, 10) || 0);
        // Get submitted/voting scripts that are publicly viewable
        const scripts = await prisma.script.findMany({
            where: {
                pilot_status: { in: ['submitted', 'voting', 'selected'] },
            },
            include: {
                studio: {
                    select: { id: true, name: true, display_name: true, avatar_url: true },
                },
                author: {
                    select: { id: true, name: true, display_name: true, avatar_url: true },
                },
            },
            orderBy: sort === 'new'
                ? { created_at: 'desc' }
                : sort === 'top'
                    ? { score: 'desc' }
                    : { created_at: 'desc' }, // 'hot' - could be improved with score calc
            take: limitNum,
            skip: offsetNum,
        });
        const total = await prisma.script.count({
            where: { pilot_status: { in: ['submitted', 'voting', 'selected'] } },
        });
        res.json({
            success: true,
            data: scripts.map((s) => ({
                id: s.id,
                title: s.title,
                content: s.logline || s.synopsis?.substring(0, 200),
                author: s.author,
                studio: s.studio,
                score: s.score || 0,
                commentCount: 0,
                createdAt: s.created_at,
                status: s.pilot_status,
            })),
            pagination: {
                total,
                limit: limitNum,
                offset: offsetNum,
                hasMore: offsetNum + scripts.length < total,
            },
        });
    }
    catch (error) {
        console.error('Feed error:', error);
        res.status(500).json({ success: false, error: 'Failed to load feed' });
    }
});
exports.default = router;
//# sourceMappingURL=index.js.map