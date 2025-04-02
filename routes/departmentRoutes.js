const express = require('express');
const {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getDepartmentPolicy,
    updateDepartmentPolicy
} = require('../controllers/departmentController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all departments (all users)
router.get('/', getAllDepartments);

// Get a specific department (all users)
router.get('/:id', getDepartmentById);

// Get department absence policy
router.get('/:id/policy', getDepartmentPolicy);

// Admin-only routes
router.post('/', authorize(['admin']), createDepartment);
router.put('/:id', authorize(['admin']), updateDepartment);
router.delete('/:id', authorize(['admin']), deleteDepartment);
router.put('/:id/policy', authorize(['admin']), updateDepartmentPolicy);

module.exports = router;