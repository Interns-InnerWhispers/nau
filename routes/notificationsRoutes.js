const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');

router.patch('/:id/read', notificationsController.markRead);
router.patch('/read-all', notificationsController.markAllRead);

module.exports = router;
