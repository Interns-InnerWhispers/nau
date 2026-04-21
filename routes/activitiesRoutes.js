const express = require('express');
const router = express.Router();
const activitiesController = require('../controllers/activitiesController');
const { validatePagination } = require('../middleware/validation');

// Activity routes
router.get('/', validatePagination, activitiesController.getAllActivities);
router.post('/', activitiesController.createActivity);
router.get('/:id', activitiesController.getActivityDetails);
router.put('/:id', activitiesController.updateActivity);
router.delete('/:id', activitiesController.deleteActivity);
router.get('/:id/participants', activitiesController.getParticipants);
router.post('/:id/participants', activitiesController.addParticipant);
router.put('/:id/participants/:userId', activitiesController.updateParticipant);
router.get('/:id/statistics', activitiesController.getActivityStatistics);

module.exports = router;
