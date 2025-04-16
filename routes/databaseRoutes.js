const express = require('express');
const { checkDatabase, createBackup, tryRestoreFromBackup } = require('../config/database');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['admin']));

// Get database status
router.get('/status', async (req, res, next) => {
    try {
        const status = await checkDatabase();
        res.status(200).json({
            status: 'success',
            data: status
        });
    } catch (error) {
        next(error);
    }
});

// Manually trigger a backup
router.post('/backup', async (req, res, next) => {
    try {
        await createBackup();
        res.status(200).json({
            status: 'success',
            message: 'Database backup created successfully'
        });
    } catch (error) {
        next(error);
    }
});

// Manually trigger a restore
router.post('/restore', async (req, res, next) => {
    try {
        const restored = await tryRestoreFromBackup();
        if (restored) {
            res.status(200).json({
                status: 'success',
                message: 'Database restored from backup successfully'
            });
        } else {
            res.status(400).json({
                status: 'error',
                message: 'Failed to restore database or no backup found'
            });
        }
    } catch (error) {
        next(error);
    }
});

module.exports = router;