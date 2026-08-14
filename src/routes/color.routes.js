const express = require('express');
const router = express.Router();
const colorController = require('../controllers/color.controller');

router.post('/', colorController.create);
router.get('/', colorController.getAll);
router.put('/:id', colorController.update);
router.delete('/:id', colorController.delete);

module.exports = router;