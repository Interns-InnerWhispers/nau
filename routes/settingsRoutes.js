const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/settingsController');

router.get('/',         ctrl.getUserSettings);
router.put('/',         ctrl.updateUserSettings);
router.get('/college',  ctrl.getCollegeSettings);
router.put('/college',  ctrl.updateCollegeSettings);

module.exports = router;
