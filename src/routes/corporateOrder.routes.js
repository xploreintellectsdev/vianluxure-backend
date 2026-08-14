const express = require('express');
const router = express.Router();
const corporateController = require('../controllers/corporateOrder.controller');

router.post('/', corporateController.create);
router.get('/', corporateController.getAll);
router.patch('/:id/status', corporateController.updateStatus);
router.delete('/:id', corporateController.remove);

module.exports = router;
