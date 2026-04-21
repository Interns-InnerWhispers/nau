const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/reportsController');

router.get('/',             ctrl.getAll);
router.get('/:id',          ctrl.getOne);
router.post('/',            ctrl.create);
router.put('/:id',          ctrl.update);
router.patch('/:id/submit', ctrl.submit);
router.delete('/:id',       ctrl.remove);

module.exports = router;
