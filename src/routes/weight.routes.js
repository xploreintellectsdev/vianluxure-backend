const express = require('express');
const router = express.Router();
const weightController = require('../controllers/weight.controller');

router.post('/', weightController.create);
router.get('/', weightController.getAll);
router.put('/:id', weightController.update);
router.delete('/:id', weightController.delete);

module.exports = router;