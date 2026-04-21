const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/proposalsController');

router.get('/',             ctrl.getAll);
router.get('/:id',          ctrl.getOne);
router.post('/',            ctrl.create);
router.put('/:id',          ctrl.update);
router.patch('/:id/submit', ctrl.submit);
router.patch('/:id/review', ctrl.review);
router.delete('/:id',       ctrl.remove);

module.exports = router;
