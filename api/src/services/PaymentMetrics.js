"use strict";
/**
 * PaymentMetrics - Observability for x402 payment system
 *
 * This service tracks payment-related metrics for:
 * - Monitoring dashboards
 * - Alerting on failures
 * - Revenue reporting
 * - Debugging payment issues
 *
 * In production, these metrics would be exported to:
 * - Prometheus/Grafana for visualization
 * - CloudWatch/Datadog for alerting
 * - Internal dashboards for business intelligence
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPaymentReceived = recordPaymentReceived;
exports.recordPaymentSettled = recordPaymentSettled;
exports.recordPaymentFailed = recordPaymentFailed;
exports.recordPayoutCreated = recordPayoutCreated;
exports.recordPayoutCompleted = recordPayoutCompleted;
exports.recordPayoutFailed = recordPayoutFailed;
exports.recordRefundCreated = recordRefundCreated;
exports.recordRefundCompleted = recordRefundCompleted;
exports.recordRefundFailed = recordRefundFailed;
exports.getMetricsSnapshot = getMetricsSnapshot;
exports.getPrometheusMetrics = getPrometheusMetrics;
exports.refreshGauges = refreshGauges;
exports.getDailyRevenue = getDailyRevenue;
exports.getWeeklyRevenue = getWeeklyRevenue;
exports.getPayoutStats = getPayoutStats;
exports.getPaymentHealth = getPaymentHealth;
const client_1 = require("@prisma/client");
const index_js_1 = __importDefault(require("../config/index.js"));
const prisma = new client_1.PrismaClient();
// Payment flow metrics
const metrics = {
    // Counters (monotonically increasing)
    paymentsReceived: { value: 0, lastUpdated: new Date() },
    paymentsSettled: { value: 0, lastUpdated: new Date() },
    paymentsFailed: { value: 0, lastUpdated: new Date() },
    payoutsCreated: { value: 0, lastUpdated: new Date() },
    payoutsCompleted: { value: 0, lastUpdated: new Date() },
    payoutsFailed: { value: 0, lastUpdated: new Date() },
    refundsCreated: { value: 0, lastUpdated: new Date() },
    refundsCompleted: { value: 0, lastUpdated: new Date() },
    refundsFailed: { value: 0, lastUpdated: new Date() },
    // Gauges (current values)
    pendingPayoutsCents: { value: 0, lastUpdated: new Date() },
    pendingRefundsCents: { value: 0, lastUpdated: new Date() },
    platformBalanceCents: { value: 0, lastUpdated: new Date() },
    // Revenue tracking (in cents)
    totalRevenueCents: { value: 0, lastUpdated: new Date() },
    creatorRevenueCents: { value: 0, lastUpdated: new Date() },
    platformRevenueCents: { value: 0, lastUpdated: new Date() },
    agentRevenueCents: { value: 0, lastUpdated: new Date() },
};
// ============================================================================
// Metric Recording Functions
// ============================================================================
function incrementCounter(counter, amount = 1) {
    counter.value += amount;
    counter.lastUpdated = new Date();
}
function setGauge(gauge, value) {
    gauge.value = value;
    gauge.lastUpdated = new Date();
}
// Payment lifecycle
function recordPaymentReceived(amountCents) {
    incrementCounter(metrics.paymentsReceived);
    console.log(`[Metrics] Payment received: ${amountCents} cents`);
}
function recordPaymentSettled(amountCents) {
    incrementCounter(metrics.paymentsSettled);
    incrementCounter(metrics.totalRevenueCents, amountCents);
    // Calculate revenue split
    const creatorShare = Math.floor(amountCents * index_js_1.default.revenueSplit.creatorPercent / 100);
    const platformShare = Math.floor(amountCents * index_js_1.default.revenueSplit.platformPercent / 100);
    const agentShare = amountCents - creatorShare - platformShare;
    incrementCounter(metrics.creatorRevenueCents, creatorShare);
    incrementCounter(metrics.platformRevenueCents, platformShare);
    incrementCounter(metrics.agentRevenueCents, agentShare);
    console.log(`[Metrics] Payment settled: ${amountCents} cents (creator: ${creatorShare}, platform: ${platformShare}, agent: ${agentShare})`);
}
function recordPaymentFailed(reason) {
    incrementCounter(metrics.paymentsFailed);
    console.log(`[Metrics] Payment failed: ${reason}`);
}
// Payout lifecycle
function recordPayoutCreated(amountCents) {
    incrementCounter(metrics.payoutsCreated);
    console.log(`[Metrics] Payout created: ${amountCents} cents`);
}
function recordPayoutCompleted(amountCents) {
    incrementCounter(metrics.payoutsCompleted);
    console.log(`[Metrics] Payout completed: ${amountCents} cents`);
}
function recordPayoutFailed(amountCents, reason) {
    incrementCounter(metrics.payoutsFailed);
    console.log(`[Metrics] Payout failed: ${amountCents} cents - ${reason}`);
}
// Refund lifecycle
function recordRefundCreated(amountCents) {
    incrementCounter(metrics.refundsCreated);
    console.log(`[Metrics] Refund created: ${amountCents} cents`);
}
function recordRefundCompleted(amountCents) {
    incrementCounter(metrics.refundsCompleted);
    console.log(`[Metrics] Refund completed: ${amountCents} cents`);
}
function recordRefundFailed(amountCents) {
    incrementCounter(metrics.refundsFailed);
    console.log(`[Metrics] Refund failed: ${amountCents} cents`);
}
// ============================================================================
// Metric Queries
// ============================================================================
/**
 * Get current metrics snapshot
 */
function getMetricsSnapshot() {
    return {
        timestamp: new Date().toISOString(),
        environment: index_js_1.default.nodeEnv,
        counters: {
            payments: {
                received: metrics.paymentsReceived.value,
                settled: metrics.paymentsSettled.value,
                failed: metrics.paymentsFailed.value,
            },
            payouts: {
                created: metrics.payoutsCreated.value,
                completed: metrics.payoutsCompleted.value,
                failed: metrics.payoutsFailed.value,
            },
            refunds: {
                created: metrics.refundsCreated.value,
                completed: metrics.refundsCompleted.value,
                failed: metrics.refundsFailed.value,
            },
        },
        gauges: {
            pendingPayoutsCents: metrics.pendingPayoutsCents.value,
            pendingRefundsCents: metrics.pendingRefundsCents.value,
            platformBalanceCents: metrics.platformBalanceCents.value,
        },
        revenue: {
            totalCents: metrics.totalRevenueCents.value,
            creatorCents: metrics.creatorRevenueCents.value,
            platformCents: metrics.platformRevenueCents.value,
            agentCents: metrics.agentRevenueCents.value,
        },
    };
}
/**
 * Get Prometheus-formatted metrics for scraping
 */
function getPrometheusMetrics() {
    const lines = [
        '# HELP molt_payments_total Total payments by status',
        '# TYPE molt_payments_total counter',
        `molt_payments_total{status="received"} ${metrics.paymentsReceived.value}`,
        `molt_payments_total{status="settled"} ${metrics.paymentsSettled.value}`,
        `molt_payments_total{status="failed"} ${metrics.paymentsFailed.value}`,
        '',
        '# HELP molt_payouts_total Total payouts by status',
        '# TYPE molt_payouts_total counter',
        `molt_payouts_total{status="created"} ${metrics.payoutsCreated.value}`,
        `molt_payouts_total{status="completed"} ${metrics.payoutsCompleted.value}`,
        `molt_payouts_total{status="failed"} ${metrics.payoutsFailed.value}`,
        '',
        '# HELP molt_refunds_total Total refunds by status',
        '# TYPE molt_refunds_total counter',
        `molt_refunds_total{status="created"} ${metrics.refundsCreated.value}`,
        `molt_refunds_total{status="completed"} ${metrics.refundsCompleted.value}`,
        `molt_refunds_total{status="failed"} ${metrics.refundsFailed.value}`,
        '',
        '# HELP molt_revenue_cents Total revenue in cents by recipient',
        '# TYPE molt_revenue_cents counter',
        `molt_revenue_cents{recipient="total"} ${metrics.totalRevenueCents.value}`,
        `molt_revenue_cents{recipient="creator"} ${metrics.creatorRevenueCents.value}`,
        `molt_revenue_cents{recipient="platform"} ${metrics.platformRevenueCents.value}`,
        `molt_revenue_cents{recipient="agent"} ${metrics.agentRevenueCents.value}`,
        '',
        '# HELP molt_pending_cents Current pending amounts in cents',
        '# TYPE molt_pending_cents gauge',
        `molt_pending_cents{type="payouts"} ${metrics.pendingPayoutsCents.value}`,
        `molt_pending_cents{type="refunds"} ${metrics.pendingRefundsCents.value}`,
    ];
    return lines.join('\n');
}
/**
 * Update gauge values from database (called periodically)
 */
async function refreshGauges() {
    try {
        // Get pending payouts total
        const pendingPayouts = await prisma.payout.aggregate({
            where: { status: 'pending' },
            _sum: { amount_cents: true },
        });
        setGauge(metrics.pendingPayoutsCents, pendingPayouts._sum.amount_cents || 0);
        // Get pending refunds total (if table exists)
        try {
            const pendingRefunds = await prisma.refund.aggregate({
                where: { status: 'pending' },
                _sum: { amount_cents: true },
            });
            setGauge(metrics.pendingRefundsCents, pendingRefunds._sum.amount_cents || 0);
        }
        catch {
            // Refund table may not exist yet
        }
        console.log('[Metrics] Gauges refreshed');
    }
    catch (error) {
        console.error('[Metrics] Failed to refresh gauges:', error);
    }
}
// ============================================================================
// Revenue Reports
// ============================================================================
/**
 * Get daily revenue summary from database
 */
async function getDailyRevenue(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    const votes = await prisma.clipVote.aggregate({
        where: {
            created_at: {
                gte: startOfDay,
                lte: endOfDay,
            },
            payment_status: 'confirmed',
        },
        _sum: { tip_amount_cents: true },
        _count: true,
    });
    const totalCents = votes._sum.tip_amount_cents || 0;
    const creatorCents = Math.floor(totalCents * index_js_1.default.revenueSplit.creatorPercent / 100);
    const platformCents = Math.floor(totalCents * index_js_1.default.revenueSplit.platformPercent / 100);
    const agentCents = totalCents - creatorCents - platformCents;
    return {
        date: startOfDay.toISOString().split('T')[0],
        voteCount: votes._count,
        totalCents,
        totalUsd: (totalCents / 100).toFixed(2),
        splits: {
            creator: { cents: creatorCents, usd: (creatorCents / 100).toFixed(2) },
            platform: { cents: platformCents, usd: (platformCents / 100).toFixed(2) },
            agent: { cents: agentCents, usd: (agentCents / 100).toFixed(2) },
        },
    };
}
/**
 * Get weekly revenue trend
 */
async function getWeeklyRevenue() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(await getDailyRevenue(date));
    }
    return days;
}
/**
 * Get payout statistics
 */
async function getPayoutStats() {
    const [pending, completed, failed] = await Promise.all([
        prisma.payout.aggregate({
            where: { status: 'pending' },
            _sum: { amount_cents: true },
            _count: true,
        }),
        prisma.payout.aggregate({
            where: { status: 'completed' },
            _sum: { amount_cents: true },
            _count: true,
        }),
        prisma.payout.aggregate({
            where: { status: 'failed' },
            _sum: { amount_cents: true },
            _count: true,
        }),
    ]);
    return {
        pending: {
            count: pending._count,
            totalCents: pending._sum.amount_cents || 0,
        },
        completed: {
            count: completed._count,
            totalCents: completed._sum.amount_cents || 0,
        },
        failed: {
            count: failed._count,
            totalCents: failed._sum.amount_cents || 0,
        },
    };
}
// ============================================================================
// Health Checks
// ============================================================================
/**
 * Check payment system health
 */
async function getPaymentHealth() {
    const issues = [];
    let isHealthy = true;
    // Check for stuck payouts (processing > 30 min)
    const stuckPayouts = await prisma.payout.count({
        where: {
            status: 'processing',
            updated_at: { lt: new Date(Date.now() - 30 * 60 * 1000) },
        },
    });
    if (stuckPayouts > 0) {
        issues.push(`${stuckPayouts} payouts stuck in processing`);
        isHealthy = false;
    }
    // Check for high failure rate (> 10% in last hour)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentPayouts = await prisma.payout.groupBy({
        by: ['status'],
        where: { updated_at: { gte: hourAgo } },
        _count: true,
    });
    const recentTotal = recentPayouts.reduce((sum, p) => sum + p._count, 0);
    const recentFailed = recentPayouts.find(p => p.status === 'failed')?._count || 0;
    if (recentTotal > 10 && recentFailed / recentTotal > 0.1) {
        issues.push(`High failure rate: ${(recentFailed / recentTotal * 100).toFixed(1)}%`);
        isHealthy = false;
    }
    // Check platform wallet configuration
    if (!index_js_1.default.x402.platformWallet) {
        issues.push('Platform wallet not configured');
        isHealthy = false;
    }
    return {
        healthy: isHealthy,
        issues,
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=PaymentMetrics.js.map