const express = require('express');
const router = express.Router();
const originController = require('../controllers/origin.controller');

router.post('/', originController.create);
router.get('/', originController.getAll);
router.put('/:id', originController.update);
router.delete('/:id', originController.delete);

module.exports = router;