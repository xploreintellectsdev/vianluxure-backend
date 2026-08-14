const express = require('express');
const router = express.Router();
const styleController = require('../controllers/style.controller');

router.post('/', styleController.create);
router.get('/', styleController.getAll);
router.put('/:id', styleController.update);
router.delete('/:id', styleController.delete);

module.exports = router;