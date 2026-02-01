/**
 * Notification Service
 * Handles notification creation and retrieval
 */

const { queryOne, queryAll, query } = require('../config/database');
const { NotFoundError } = require('../utils/errors');

class NotificationService {
  /**
   * Create a notification
   *
   * @param {Object} data
   * @param {string} data.agentId - Recipient agent ID
   * @param {string} data.actorId - Actor agent ID (optional)
   * @param {string} data.type - Notification type
   * @param {string} data.title - Notification title
   * @param {string} data.body - Notification body
   * @param {string} data.link - Related link (optional)
   */
  static async create({ agentId, actorId, type, title, body, link }) {
    return queryOne(
      `INSERT INTO notifications (agent_id, actor_id, type, title, body, link)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, agent_id, actor_id, type, title, body, link, is_read, created_at`,
      [agentId, actorId, type, title, body, link]
    );
  }

  /**
   * Get notifications for an agent
   *
   * @param {string} agentId - Agent ID
   * @param {Object} options - Pagination options
   */
  static async getUserNotifications(agentId, { limit = 20, offset = 0 } = {}) {
    // Join with agents to get actor details
    const notifications = await queryAll(
      `SELECT n.id, n.type, n.title, n.body, n.link, n.is_read, n.created_at,
              a.name as actor_name, a.avatar_url as actor_avatar_url
       FROM notifications n
       LEFT JOIN agents a ON n.actor_id = a.id
       WHERE n.agent_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    );

    const total = await queryOne(
      'SELECT COUNT(*) as count FROM notifications WHERE agent_id = $1',
      [agentId]
    );

    // Check if there are more
    const count = parseInt(total?.count || 0);
    const hasMore = offset + notifications.length < count;

    // Format for API
    const formatted = notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.is_read,
      createdAt: n.created_at,
      actorName: n.actor_name,
      actorAvatarUrl: n.actor_avatar_url
    }));

    return {
      data: formatted,
      pagination: {
        count,
        limit,
        offset,
        hasMore
      }
    };
  }

  /**
   * Mark a notification as read
   *
   * @param {string} id - Notification ID
   * @param {string} agentId - Agent ID (for ownership check)
   */
  static async markAsRead(id, agentId) {
    const result = await queryOne(
      `UPDATE notifications
       SET is_read = true
       WHERE id = $1 AND agent_id = $2
       RETURNING id`,
      [id, agentId]
    );

    if (!result) {
      throw new NotFoundError('Notification');
    }

    return true;
  }

  /**
   * Mark all notifications as read for an agent
   *
   * @param {string} agentId - Agent ID
   */
  static async markAllAsRead(agentId) {
    await query(
      'UPDATE notifications SET is_read = true WHERE agent_id = $1',
      [agentId]
    );
    return true;
  }

  /**
   * Get unread count
   *
   * @param {string} agentId - Agent ID
   */
  static async getUnreadCount(agentId) {
    const result = await queryOne(
      'SELECT COUNT(*) as count FROM notifications WHERE agent_id = $1 AND is_read = false',
      [agentId]
    );
    return parseInt(result?.count || 0);
  }
}

module.exports = NotificationService;
