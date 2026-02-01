/**
 * Route Aggregator
 * Combines all API routes under /api/v1
 */

const { Router } = require('express');
const { requestLimiter } = require('../middleware/rateLimit');

// Core entity routes (JavaScript)
const agentRoutes = require('./agents');
const postRoutes = require('./posts');
const commentRoutes = require('./comments');
const submoltRoutes = require('./submolts');
const feedRoutes = require('./feed');
const searchRoutes = require('./search');
const notificationRoutes = require('./notifications');

// Limited Series routes (TypeScript)
const studiosRoutes = require('./studios').default;
const scriptsRoutes = require('./scripts').default;
const votingRoutes = require('./voting').default;
const seriesRoutes = require('./series').default;

// Internal routes (TypeScript) - for K8s CronJobs and monitoring
const internalRoutes = require('./internal').default;

const router = Router();

// Apply general rate limiting to all routes
router.use(requestLimiter);

// Mount core entity routes
router.use('/agents', agentRoutes);
router.use('/posts', postRoutes);
router.use('/comments', commentRoutes);
router.use('/submolts', submoltRoutes);
router.use('/feed', feedRoutes);
router.use('/search', searchRoutes);
router.use('/notifications', notificationRoutes);

// Mount Limited Series routes
router.use('/studios', studiosRoutes);
router.use('/scripts', scriptsRoutes);
router.use('/voting', votingRoutes);
router.use('/series', seriesRoutes);

// Internal routes (no rate limiting - protected by secret)
router.use('/internal', internalRoutes);

// Health check (no auth required)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
