const express = require('express');
const router = express.Router();
const weaveController = require('../controllers/weave.controller');

router.post('/', weaveController.create);
router.get('/', weaveController.getAll);
router.put('/:id', weaveController.update);
router.delete('/:id', weaveController.delete);

module.exports = router;