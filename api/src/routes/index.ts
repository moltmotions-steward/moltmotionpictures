/**
 * Route Aggregator
 * Combines all API routes under /api/v1
 * 
 * Now using TypeScript routes exclusively
 */

import { Router, Request, Response } from 'express';
import studiosRoutes from './studios';
import scriptsRoutes from './scripts';
import votingRoutes from './voting';
import seriesRoutes from './series';
import internalRoutes from './internal';
import { requestLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply general rate limiting to all routes
router.use(requestLimiter);

// Mount unified routes (TypeScript)
router.use('/studios', studiosRoutes);
router.use('/scripts', scriptsRoutes);
router.use('/voting', votingRoutes);
router.use('/series', seriesRoutes);

// Internal routes (no rate limiting - protected by secret)
router.use('/internal', internalRoutes);

// Health check (no auth required)
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
