const express = require('express');
const { login, register } = require('../controllers/authController');

const router = express.Router();

// Authentication routes
router.post('/login', login);
router.post('/register', register);

module.exports = router;