const { db } = require('../config/database');
const { ValidationError, NotFoundError } = require('../middlewares/errorMiddleware');

/**
 * Get all notifications for the current user
 */
const getUserNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { status, limit = 20, offset = 0 } = req.query;

        // Build query with filters
        let query = `
      SELECT 
        n.id, 
        n.type, 
        n.status, 
        n.sent_date, 
        n.read_date, 
        n.content,
        n.request_id,
        ar.type as request_type,
        ar.start_date as request_start_date,
        ar.end_date as request_end_date,
        a.full_name as related_user_name
      FROM notifications n
      LEFT JOIN absence_requests ar ON n.request_id = ar.id
      LEFT JOIN employees e ON ar.employee_id = e.id
      LEFT JOIN accounts a ON e.account_id = a.id
      WHERE n.recipient_id = ?
    `;

        const params = [userId];

        if (status) {
            query += ` AND n.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY n.sent_date DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const notifications = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        // Count total unread notifications
        const unreadCount = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count
         FROM notifications
         WHERE recipient_id = ? AND status = 'unread'`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row ? row.count : 0);
                }
            );
        });

        res.status(200).json({
            status: 'success',
            data: {
                notifications,
                unreadCount
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark notification as read
 */
const markNotificationAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        // Check if notification exists and belongs to user
        const notification = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, status FROM notifications WHERE id = ? AND recipient_id = ?`,
                [id, userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!notification) {
            throw new NotFoundError('Notification not found or you do not have permission to access it');
        }

        if (notification.status === 'read') {
            // Already read, just return success
            return res.status(200).json({
                status: 'success',
                message: 'Notification already marked as read'
            });
        }

        // Update notification status
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE notifications
         SET status = 'read', read_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
                [id],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });

        res.status(200).json({
            status: 'success',
            message: 'Notification marked as read'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark all notifications as read
 */
const markAllNotificationsAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Update all unread notifications for user
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE notifications
         SET status = 'read', read_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE recipient_id = ? AND status = 'unread'`,
                [userId],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });

        res.status(200).json({
            status: 'success',
            message: 'All notifications marked as read'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a notification
 */
const deleteNotification = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        // Check if notification exists and belongs to user
        const notification = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM notifications WHERE id = ? AND recipient_id = ?`,
                [id, userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!notification) {
            throw new NotFoundError('Notification not found or you do not have permission to delete it');
        }

        // Delete notification
        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM notifications WHERE id = ?`,
                [id],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });

        res.status(200).json({
            status: 'success',
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a notification (internal use only, not exposed as API endpoint)
 */
const createNotification = async (recipientId, type, content, requestId = null) => {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO notifications (recipient_id, type, status, content, request_id)
       VALUES (?, ?, 'unread', ?, ?)`,
            [recipientId, type, content, requestId],
            function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
};

module.exports = {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    createNotification
};