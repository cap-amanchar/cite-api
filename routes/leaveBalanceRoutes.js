const express = require('express');
const {
    getCurrentEmployeeLeaveBalance,
    getEmployeeLeaveBalance,
    updateEmployeeLeaveBalance,
    getTeamLeaveBalances
} = require('../controllers/leaveBalanceController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get current employee's leave balance
router.get('/me', authorize(['employee']), getCurrentEmployeeLeaveBalance);

// Get team leave balances (manager and admin only)
router.get('/team', authorize(['manager', 'admin']), getTeamLeaveBalances);

// Get specific employee leave balance (manager and admin only)
router.get('/:id', authorize(['manager', 'admin']), getEmployeeLeaveBalance);

// Update employee leave balance (admin only)
router.put('/:id', authorize(['admin']), updateEmployeeLeaveBalance);

module.exports = router;