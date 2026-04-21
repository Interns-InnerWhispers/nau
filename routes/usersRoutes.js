const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { validatePagination } = require('../middleware/validation');

// User routes
router.get('/me', usersController.getUserProfile);
router.put('/me', usersController.updateUserProfile);
router.post('/me/change-password', usersController.changePassword);
router.post('/change-password', usersController.changePassword);
router.get('/', validatePagination, usersController.getAllUsers);
router.get('/:id', usersController.getUserById);

module.exports = router;
