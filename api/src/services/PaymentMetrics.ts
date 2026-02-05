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

import { prisma } from '../lib/prisma';
import { AgentService } from './AgentService';
import config from '../config/index.js';

// ============================================================================
// In-Memory Metrics (for export to external systems)
// ============================================================================

interface MetricCounter {
  value: number;
  lastUpdated: Date;
}

interface MetricGauge {
  value: number;
  lastUpdated: Date;
}

// Payment flow metrics
const metrics = {
  // Counters (monotonically increasing)
  paymentsReceived: { value: 0, lastUpdated: new Date() } as MetricCounter,
  paymentsSettled: { value: 0, lastUpdated: new Date() } as MetricCounter,
  paymentsFailed: { value: 0, lastUpdated: new Date() } as MetricCounter,
  payoutsCreated: { value: 0, lastUpdated: new Date() } as MetricCounter,
  payoutsCompleted: { value: 0, lastUpdated: new Date() } as MetricCounter,
  payoutsFailed: { value: 0, lastUpdated: new Date() } as MetricCounter,
  refundsCreated: { value: 0, lastUpdated: new Date() } as MetricCounter,
  refundsCompleted: { value: 0, lastUpdated: new Date() } as MetricCounter,
  refundsFailed: { value: 0, lastUpdated: new Date() } as MetricCounter,
  
  // Gauges (current values)
  pendingPayoutsCents: { value: 0, lastUpdated: new Date() } as MetricGauge,
  pendingRefundsCents: { value: 0, lastUpdated: new Date() } as MetricGauge,
  platformBalanceCents: { value: 0, lastUpdated: new Date() } as MetricGauge,
  
  // Revenue tracking (in cents)
  totalRevenueCents: { value: 0, lastUpdated: new Date() } as MetricCounter,
  creatorRevenueCents: { value: 0, lastUpdated: new Date() } as MetricCounter,
  platformRevenueCents: { value: 0, lastUpdated: new Date() } as MetricCounter,
  agentRevenueCents: { value: 0, lastUpdated: new Date() } as MetricCounter,
};

// ============================================================================
// Metric Recording Functions
// ============================================================================

function incrementCounter(counter: MetricCounter, amount: number = 1) {
  counter.value += amount;
  counter.lastUpdated = new Date();
}

function setGauge(gauge: MetricGauge, value: number) {
  gauge.value = value;
  gauge.lastUpdated = new Date();
}

// Payment lifecycle
export function recordPaymentReceived(amountCents: number) {
  incrementCounter(metrics.paymentsReceived);
  console.log(`[Metrics] Payment received: ${amountCents} cents`);
}

export function recordPaymentSettled(amountCents: number) {
  incrementCounter(metrics.paymentsSettled);
  incrementCounter(metrics.totalRevenueCents, amountCents);
  
  // Calculate revenue split
  const creatorShare = Math.floor(amountCents * config.revenueSplit.creatorPercent / 100);
  const platformShare = Math.floor(amountCents * config.revenueSplit.platformPercent / 100);
  const agentShare = amountCents - creatorShare - platformShare;
  
  incrementCounter(metrics.creatorRevenueCents, creatorShare);
  incrementCounter(metrics.platformRevenueCents, platformShare);
  incrementCounter(metrics.agentRevenueCents, agentShare);
  
  console.log(`[Metrics] Payment settled: ${amountCents} cents (creator: ${creatorShare}, platform: ${platformShare}, agent: ${agentShare})`);
}

export function recordPaymentFailed(reason: string) {
  incrementCounter(metrics.paymentsFailed);
  console.log(`[Metrics] Payment failed: ${reason}`);
}

// Payout lifecycle
export function recordPayoutCreated(amountCents: number) {
  incrementCounter(metrics.payoutsCreated);
  console.log(`[Metrics] Payout created: ${amountCents} cents`);
}

export function recordPayoutCompleted(amountCents: number) {
  incrementCounter(metrics.payoutsCompleted);
  console.log(`[Metrics] Payout completed: ${amountCents} cents`);
}

export function recordPayoutFailed(amountCents: number, reason: string) {
  incrementCounter(metrics.payoutsFailed);
  console.log(`[Metrics] Payout failed: ${amountCents} cents - ${reason}`);
}

// Refund lifecycle
export function recordRefundCreated(amountCents: number) {
  incrementCounter(metrics.refundsCreated);
  console.log(`[Metrics] Refund created: ${amountCents} cents`);
}

export function recordRefundCompleted(amountCents: number) {
  incrementCounter(metrics.refundsCompleted);
  console.log(`[Metrics] Refund completed: ${amountCents} cents`);
}

export function recordRefundFailed(amountCents: number) {
  incrementCounter(metrics.refundsFailed);
  console.log(`[Metrics] Refund failed: ${amountCents} cents`);
}

// ============================================================================
// Metric Queries
// ============================================================================

/**
 * Get current metrics snapshot
 */
export function getMetricsSnapshot() {
  return {
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
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
export function getPrometheusMetrics(): string {
  const lines: string[] = [
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
export async function refreshGauges() {
  try {
    // Get pending payouts total
    const pendingPayouts = await prisma.payout.aggregate({
      where: { status: 'pending' },
      _sum: { amount_cents: true },
    });
    setGauge(metrics.pendingPayoutsCents, pendingPayouts._sum.amount_cents || 0);
    
    // Get pending refunds total (if table exists)
    try {
      const pendingRefunds = await (prisma as any).refund.aggregate({
        where: { status: 'pending' },
        _sum: { amount_cents: true },
      });
      setGauge(metrics.pendingRefundsCents, pendingRefunds._sum.amount_cents || 0);
    } catch {
      // Refund table may not exist yet
    }
    
    console.log('[Metrics] Gauges refreshed');
  } catch (error) {
    console.error('[Metrics] Failed to refresh gauges:', error);
  }
}

// ============================================================================
// Revenue Reports
// ============================================================================

/**
 * Get daily revenue summary from database
 */
export async function getDailyRevenue(date: Date = new Date()) {
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
  const creatorCents = Math.floor(totalCents * config.revenueSplit.creatorPercent / 100);
  const platformCents = Math.floor(totalCents * config.revenueSplit.platformPercent / 100);
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
export async function getWeeklyRevenue() {
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
export async function getPayoutStats() {
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
export async function getPaymentHealth() {
  const issues: string[] = [];
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
  if (!config.x402.platformWallet) {
    issues.push('Platform wallet not configured');
    isHealthy = false;
  }
  
  return {
    healthy: isHealthy,
    issues,
    timestamp: new Date().toISOString(),
  };
}
