const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/organizationsController');

router.get('/',                ctrl.getOrganization);
router.put('/',                ctrl.updateOrganization);
router.get('/members',         ctrl.getMembers);
router.post('/members',        ctrl.addMember);
router.put('/members/:id',     ctrl.updateMember);
router.delete('/members/:id',  ctrl.removeMember);
router.get('/meetings',        ctrl.getMeetings);
router.post('/meetings',       ctrl.createMeeting);
router.put('/meetings/:id',    ctrl.updateMeeting);
router.delete('/meetings/:id', ctrl.deleteMeeting);

module.exports = router;
