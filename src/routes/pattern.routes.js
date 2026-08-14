const express = require('express');
const router = express.Router();
const patternController = require('../controllers/pattern.controller');

router.post('/', patternController.create);
router.get('/', patternController.getAll);
router.put('/:id', patternController.update);
router.delete('/:id', patternController.delete);

module.exports = router;