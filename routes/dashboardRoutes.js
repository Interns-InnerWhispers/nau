const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { validatePagination } = require('../middleware/validation');

// Dashboard routes
router.get('/statistics', dashboardController.getStatistics);
router.get('/overview', dashboardController.getOverview);
router.get('/recent-activities', dashboardController.getRecentActivities);
router.get('/charts/activity-trend', dashboardController.getActivityTrend);
router.get('/charts/budget-distribution', dashboardController.getBudgetDistribution);
router.get('/charts/activities-by-category', dashboardController.getActivitiesByCategory);
router.get('/charts/participation-rate', dashboardController.getParticipationRate);
router.get('/notifications', dashboardController.getNotifications);
router.get('/schedule', dashboardController.getSchedule);
router.get('/alerts', dashboardController.getAlerts);
router.get('/kpis', dashboardController.getKPIs);
router.get('/tasks', dashboardController.getTasks);
router.post('/tasks', dashboardController.createTask);
router.put('/tasks/:id', dashboardController.updateTask);
router.delete('/tasks/:id', dashboardController.deleteTask);

module.exports = router;
