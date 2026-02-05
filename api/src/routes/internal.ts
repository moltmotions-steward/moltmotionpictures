/**
 * Internal Routes
 * 
 * Protected endpoints for internal services (K8s CronJobs, health checks, etc.)
 * These routes are NOT exposed to the public API and require INTERNAL_CRON_SECRET.
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { runCronTick, getVotingDashboard } from '../services/VotingPeriodManager';
import * as PaymentMetrics from '../services/PaymentMetrics.js';
import * as RefundService from '../services/RefundService.js';
import { processPayouts } from '../services/PayoutProcessor.js';
import { sweepExpiredUnclaimedFunds } from '../services/UnclaimedFundProcessor.js';
import { getVotingRuntimeConfigState, updateVotingRuntimeConfig } from '../services/VotingRuntimeConfigService.js';


const router = Router();

/**
 * Middleware to validate internal cron secret
 * Protects cron endpoints from unauthorized access
 */
const validateCronSecret = (req: Request, res: Response, next: NextFunction): void => {
  const cronSecret = process.env.INTERNAL_CRON_SECRET;
  const providedSecretRaw = req.headers['x-cron-secret'];
  const providedSecret = typeof providedSecretRaw === 'string' ? providedSecretRaw : '';

  // In development, allow without secret
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    return next();
  }

  if (!cronSecret) {
    res.status(500).json({ error: 'INTERNAL_CRON_SECRET not configured' });
    return;
  }

  if (!providedSecret || !cronSecret) {
    res.status(401).json({ error: 'Invalid cron secret' });
    return;
  }

  const a = Buffer.from(providedSecret);
  const b = Buffer.from(cronSecret);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    res.status(401).json({ error: 'Invalid cron secret' });
    return;
  }

  next();
};

/**
 * Middleware to validate internal admin secret
 * Protects admin-only internal endpoints (e.g., Prime bindings)
 */
const validateAdminSecret = (req: Request, res: Response, next: NextFunction): void => {
  const adminSecret = process.env.INTERNAL_ADMIN_SECRET;
  const providedSecretRaw = req.headers['x-internal-admin-secret'];
  const providedSecret = typeof providedSecretRaw === 'string' ? providedSecretRaw : '';

  // In development, allow without secret
  if (process.env.NODE_ENV === 'development' && !adminSecret) {
    return next();
  }

  if (!adminSecret) {
    res.status(500).json({ error: 'INTERNAL_ADMIN_SECRET not configured' });
    return;
  }

  if (!providedSecret) {
    res.status(401).json({ error: 'Invalid admin secret' });
    return;
  }

  const a = Buffer.from(providedSecret);
  const b = Buffer.from(adminSecret);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    res.status(401).json({ error: 'Invalid admin secret' });
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
router.post('/cron/voting-tick', validateCronSecret, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log('[Internal] Voting cron tick triggered');
    
    await runCronTick();
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Voting cron tick completed',
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
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
router.get('/voting/dashboard', validateCronSecret, async (req: Request, res: Response) => {
  try {
    const dashboard = await getVotingDashboard();
    
    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
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
router.get('/health', validateCronSecret, (req: Request, res: Response) => {
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
router.get('/metrics', validateCronSecret, (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(PaymentMetrics.getPrometheusMetrics());
});

/**
 * GET /internal/payments/dashboard
 * 
 * Payment system dashboard for monitoring.
 * Shows current metrics, health, and revenue.
 */
router.get('/payments/dashboard', validateCronSecret, async (req: Request, res: Response) => {
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
  } catch (error) {
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
router.get('/payments/revenue/weekly', validateCronSecret, async (req: Request, res: Response) => {
  try {
    const weekly = await PaymentMetrics.getWeeklyRevenue();
    
    res.json({
      success: true,
      data: weekly,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
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
router.post('/cron/payouts', validateCronSecret, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log('[Internal] Payout cron triggered');
    
    const stats = await processPayouts();
    
    res.json({
      success: true,
      message: 'Payout processing completed',
      stats,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
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
router.post('/cron/refunds', validateCronSecret, async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('[Internal] Refund cron failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - startTime
    });
  }
});

/**
 * POST /internal/cron/unclaimed-funds
 *
 * Sweeps expired unclaimed funds to the platform treasury.
 */
router.post('/cron/unclaimed-funds', validateCronSecret, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log('[Internal] Unclaimed funds sweep cron triggered');

    const stats = await sweepExpiredUnclaimedFunds();

    res.json({
      success: true,
      message: 'Unclaimed funds sweep completed',
      stats,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Internal] Unclaimed funds sweep cron failed:', error);
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
router.post('/cron/refresh-gauges', validateCronSecret, async (req: Request, res: Response) => {
  try {
    await PaymentMetrics.refreshGauges();
    
    res.json({
      success: true,
      message: 'Gauges refreshed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// Admin Runtime Configuration
// =============================================================================

/**
 * GET /internal/admin/voting/config
 *
 * Returns current runtime voting cadence configuration.
 */
router.get('/admin/voting/config', validateAdminSecret, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: getVotingRuntimeConfigState(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * PUT /internal/admin/voting/config
 *
 * Updates runtime voting cadence configuration.
 * Protected by INTERNAL_ADMIN_SECRET.
 */
router.put('/admin/voting/config', validateAdminSecret, (req: Request, res: Response) => {
  try {
    const actor = req.headers['x-admin-actor'];
    const actorLabel = typeof actor === 'string' && actor.trim() ? actor.trim() : 'internal-admin';

    const next = updateVotingRuntimeConfig(req.body || {}, actorLabel);
    res.json({
      success: true,
      data: next,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid configuration update',
    });
  }
});



export default router;
