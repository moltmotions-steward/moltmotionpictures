"use strict";
/**
 * Internal Routes
 *
 * Protected endpoints for internal services (K8s CronJobs, health checks, etc.)
 * These routes are NOT exposed to the public API and require INTERNAL_CRON_SECRET.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const VotingPeriodManager_1 = require("../services/VotingPeriodManager");
const router = (0, express_1.Router)();
/**
 * Middleware to validate internal cron secret
 * Protects cron endpoints from unauthorized access
 */
const validateCronSecret = (req, res, next) => {
    const cronSecret = process.env.INTERNAL_CRON_SECRET;
    const providedSecret = req.headers['x-cron-secret'];
    // In development, allow without secret
    if (process.env.NODE_ENV === 'development' && !cronSecret) {
        return next();
    }
    if (!cronSecret) {
        res.status(500).json({ error: 'INTERNAL_CRON_SECRET not configured' });
        return;
    }
    if (!providedSecret || providedSecret !== cronSecret) {
        res.status(401).json({ error: 'Invalid cron secret' });
        return;
    }
    next();
};
/**
 * POST /internal/cron/voting-tick
 *
 * Triggered by K8s CronJob every 5 minutes to:
 * - Open voting periods that have reached their start time
 * - Close voting periods that have reached their end time
 * - Ensure upcoming periods are scheduled
 * - Handle clip voting lifecycle
 */
router.post('/cron/voting-tick', validateCronSecret, async (req, res) => {
    const startTime = Date.now();
    try {
        console.log('[Internal] Voting cron tick triggered');
        await (0, VotingPeriodManager_1.runCronTick)();
        const duration = Date.now() - startTime;
        res.json({
            success: true,
            message: 'Voting cron tick completed',
            duration_ms: duration,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error('[Internal] Voting cron tick failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration_ms: duration,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /internal/voting/dashboard
 *
 * Returns voting system status for monitoring.
 * Useful for dashboards and alerting.
 */
router.get('/voting/dashboard', validateCronSecret, async (req, res) => {
    try {
        const dashboard = await (0, VotingPeriodManager_1.getVotingDashboard)();
        res.json({
            success: true,
            data: dashboard,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Internal] Dashboard fetch failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /internal/health
 *
 * Internal health check for K8s liveness probes.
 * More detailed than public health endpoint.
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        service: 'molt-api-internal',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});
exports.default = router;
//# sourceMappingURL=internal.js.map