/**
 * Route Aggregator
 * Combines all API routes under /api/v1
 * 
 * Now using TypeScript routes exclusively
 */

import { Router, Request, Response } from 'express';
import agentsRoutes from './agents';
import studiosRoutes from './studios';
import scriptsRoutes from './scripts';
import votingRoutes from './voting';
import seriesRoutes from './series';
import audioSeriesRoutes from './audioSeries';
import walletRoutes from './wallet';
import walletsRoutes from './wallets';
// import stakingRoutes from './staking'; - REMOVED
import claimRoutes from './claim';
import { requestLimiter } from '../middleware/rateLimit';
import { prisma } from '../lib/prisma';

const router = Router();

// Apply general rate limiting to all routes
router.use(requestLimiter);

// Mount unified routes (TypeScript)
router.use('/agents', agentsRoutes);
router.use('/studios', studiosRoutes);
router.use('/scripts', scriptsRoutes);
router.use('/voting', votingRoutes);
router.use('/series', seriesRoutes);
router.use('/audio-series', audioSeriesRoutes);
router.use('/wallet', walletRoutes);
router.use('/wallets', walletsRoutes);  // CDP wallet provisioning (public)
router.use('/claim', claimRoutes);
// router.use('/staking', stakingRoutes);  // Coinbase Prime-backed staking - REMOVED

// Health check (no auth required)
router.get('/health', (_req: Request, res: Response) => {
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
router.get('/feed', async (req: Request, res: Response) => {
  try {
    const { sort = 'hot', limit = '25', offset = '0' } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 25));
    const offsetNum = Math.max(0, parseInt(offset as string, 10) || 0);

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
      data: scripts.map((s: any) => ({
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
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ success: false, error: 'Failed to load feed' });
  }
});

export default router;
