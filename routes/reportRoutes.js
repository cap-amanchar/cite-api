const express = require('express');
const {
    generateTeamAbsenceSummary,
    generateAbsenceTrends
} = require('../controllers/reportController');
const {
    generateEmployeeAbsenceReport,
    generateDepartmentCalendar
} = require('../controllers/employeeReportController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Team absence summary (managers and admins)
router.get('/team-summary', authorize(['manager', 'admin']), generateTeamAbsenceSummary);

// Absence trends (managers and admins)
router.get('/trends', authorize(['manager', 'admin']), generateAbsenceTrends);

// Employee absence report (employee can view their own, managers their team, admins anyone)
router.get('/employee/:id', generateEmployeeAbsenceReport);

// Department calendar (all authenticated users)
router.get('/department/:departmentId/calendar', generateDepartmentCalendar);

module.exports = router;