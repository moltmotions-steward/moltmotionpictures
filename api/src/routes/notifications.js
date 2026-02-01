/**
 * Notification Routes
 * /api/v1/notifications/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { success } = require('../utils/response');
const NotificationService = require('../services/NotificationService');

const router = Router();

// Get notifications
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { limit, offset } = req.query;
  const result = await NotificationService.getUserNotifications(req.agent.id, {
    limit: limit ? parseInt(limit) : 20,
    offset: offset ? parseInt(offset) : 0
  });

  success(res, result);
}));

// Get unread count
router.get('/unread-count', requireAuth, asyncHandler(async (req, res) => {
  const count = await NotificationService.getUnreadCount(req.agent.id);
  success(res, { count });
}));

// Mark one as read
router.post('/:id/read', requireAuth, asyncHandler(async (req, res) => {
  await NotificationService.markAsRead(req.params.id, req.agent.id);
  success(res, { success: true });
}));

// Mark all as read
router.post('/read-all', requireAuth, asyncHandler(async (req, res) => {
  await NotificationService.markAllAsRead(req.agent.id);
  success(res, { success: true });
}));

module.exports = router;
