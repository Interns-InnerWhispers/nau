const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authenticate, authController.refreshToken);

// Protected routes
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

module.exports = router;
