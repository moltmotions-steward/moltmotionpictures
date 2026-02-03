"use strict";
/**
 * Internal Routes
 *
 * Protected endpoints for internal services (K8s CronJobs, health checks, etc.)
 * These routes are NOT exposed to the public API and require INTERNAL_CRON_SECRET.
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
const express_1 = require("express");
const VotingPeriodManager_1 = require("../services/VotingPeriodManager");
const PaymentMetrics = __importStar(require("../services/PaymentMetrics.js"));
const RefundService = __importStar(require("../services/RefundService.js"));
const PayoutProcessor_js_1 = require("../services/PayoutProcessor.js");
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
// =============================================================================
// Payment Monitoring & Metrics
// =============================================================================
/**
 * GET /internal/metrics
 *
 * Prometheus-format metrics for scraping.
 * Used by monitoring stack (Prometheus/Grafana).
 */
router.get('/metrics', validateCronSecret, (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(PaymentMetrics.getPrometheusMetrics());
});
/**
 * GET /internal/payments/dashboard
 *
 * Payment system dashboard for monitoring.
 * Shows current metrics, health, and revenue.
 */
router.get('/payments/dashboard', validateCronSecret, async (req, res) => {
    try {
        const [metrics, health, payoutStats, dailyRevenue] = await Promise.all([
            PaymentMetrics.getMetricsSnapshot(),
            PaymentMetrics.getPaymentHealth(),
            PaymentMetrics.getPayoutStats(),
            PaymentMetrics.getDailyRevenue(),
        ]);
        res.json({
            success: true,
            data: {
                metrics,
                health,
                payoutStats,
                dailyRevenue,
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Internal] Payment dashboard failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /internal/payments/revenue/weekly
 *
 * Weekly revenue trend for analytics.
 */
router.get('/payments/revenue/weekly', validateCronSecret, async (req, res) => {
    try {
        const weekly = await PaymentMetrics.getWeeklyRevenue();
        res.json({
            success: true,
            data: weekly,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// Cron Job Endpoints
// =============================================================================
/**
 * POST /internal/cron/payouts
 *
 * Triggered by K8s CronJob to process pending payouts.
 * Executes USDC transfers to creators, agents, and platform.
 */
router.post('/cron/payouts', validateCronSecret, async (req, res) => {
    const startTime = Date.now();
    try {
        console.log('[Internal] Payout cron triggered');
        const stats = await (0, PayoutProcessor_js_1.processPayouts)();
        res.json({
            success: true,
            message: 'Payout processing completed',
            stats,
            duration_ms: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Internal] Payout cron failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration_ms: Date.now() - startTime
        });
    }
});
/**
 * POST /internal/cron/refunds
 *
 * Triggered by K8s CronJob to process pending refunds.
 * Refunds USDC to payers when payouts fail.
 */
router.post('/cron/refunds', validateCronSecret, async (req, res) => {
    const startTime = Date.now();
    try {
        console.log('[Internal] Refund cron triggered');
        const stats = await RefundService.processRefunds();
        res.json({
            success: true,
            message: 'Refund processing completed',
            stats,
            duration_ms: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Internal] Refund cron failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration_ms: Date.now() - startTime
        });
    }
});
/**
 * POST /internal/cron/refresh-gauges
 *
 * Refresh metric gauges from database.
 * Called periodically to update pending amounts.
 */
router.post('/cron/refresh-gauges', validateCronSecret, async (req, res) => {
    try {
        await PaymentMetrics.refreshGauges();
        res.json({
            success: true,
            message: 'Gauges refreshed',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=internal.js.map