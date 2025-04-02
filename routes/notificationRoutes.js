const express = require('express');
const {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
} = require('../controllers/notificationController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all notifications for current user
router.get('/', getUserNotifications);

// Mark all notifications as read
router.post('/read-all', markAllNotificationsAsRead);

// Mark a notification as read
router.patch('/:id/read', markNotificationAsRead);

// Delete a notification
router.delete('/:id', deleteNotification);

module.exports = router;