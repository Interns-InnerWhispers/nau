const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { validatePagination } = require('../middleware/validation');

// Admin routes
router.get('/users', validatePagination, adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.put('/users/:user_id', adminController.updateUser);
router.put('/users/:user_id/role', adminController.updateUserRole);
router.put('/users/:user_id/status', adminController.updateUserStatus);
router.delete('/users/:user_id', adminController.deleteUser);
router.get('/statistics', adminController.getSystemStats);
router.get('/stats', adminController.getSystemStats);
router.get('/logs', validatePagination, adminController.getLogs);

module.exports = router;
