const express = require('express');
const {
    getCurrentUser,
    updateCurrentUser,
    getAllUsers
} = require('../controllers/userController');
const {
    getUserById,
    createUser,
    updateUser,
    deleteUser
} = require('../controllers/adminUserController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Current user routes (for all authenticated users)
router.get('/me', getCurrentUser);
router.put('/me', updateCurrentUser);

// Admin-only routes
router.get('/', authorize(['admin']), getAllUsers);
router.post('/', authorize(['admin']), createUser);
router.get('/:id', authorize(['admin']), getUserById);
router.put('/:id', authorize(['admin']), updateUser);
router.delete('/:id', authorize(['admin']), deleteUser);

module.exports = router;