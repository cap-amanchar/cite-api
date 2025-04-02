const express = require('express');
const {
    createAbsenceRequest,
    getAbsenceRequests,
    getAbsenceRequestById,
    updateAbsenceRequest,
    cancelAbsenceRequest,
    processAbsenceRequest,
    updateAbsenceStatus
} = require('../controllers/absenceController');
const { authenticate, authorize, checkResourceOwnership } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all absence requests (filtered by user role)
router.get('/', getAbsenceRequests);

// Get a specific absence request by ID
router.get('/:id', checkResourceOwnership('absence_request'), getAbsenceRequestById);

// Create a new absence request (employees only)
router.post('/', authorize(['employee']), createAbsenceRequest);

// Update a pending absence request
router.put('/:id', checkResourceOwnership('absence_request'), updateAbsenceRequest);

// Cancel an absence request
router.delete('/:id', checkResourceOwnership('absence_request'), cancelAbsenceRequest);

// Approve or reject an absence request (managers and admins only)
router.post('/:id/process', authorize(['manager', 'admin']), processAbsenceRequest);

router.patch('/:id/status', authenticate, checkResourceOwnership('absence_request'), updateAbsenceStatus);

module.exports = router;