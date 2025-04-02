const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const departmentRoutes = require('./departmentRoutes');
const absenceRoutes = require('./absenceRoutes');
const leaveBalanceRoutes = require('./leaveBalanceRoutes');
const notificationRoutes = require('./notificationRoutes');
const reportRoutes = require('./reportRoutes');

const router = express.Router();

// API version
router.get('/', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Absence Management API',
        version: '1.0.0'
    });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/absences', absenceRoutes);
router.use('/leave-balances', leaveBalanceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);

module.exports = router;