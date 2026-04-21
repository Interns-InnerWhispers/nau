const express = require('express');
const router = express.Router();
const socialMediaController = require('../controllers/socialMediaController');

// Accounts
router.get('/accounts', socialMediaController.getAccounts);
router.post('/accounts', socialMediaController.createAccount);
router.put('/accounts/:id', socialMediaController.updateAccount);
router.delete('/accounts/:id', socialMediaController.deleteAccount);

// Metrics
router.get('/metrics', socialMediaController.getMetrics);
router.post('/metrics', socialMediaController.createMetric);
router.delete('/metrics/:id', socialMediaController.deleteMetric);

// Aggregated stats and posts
router.get('/posts', socialMediaController.getPosts);
router.post('/posts', socialMediaController.createPost);
router.get('/analytics', socialMediaController.getAnalytics);

module.exports = router;
