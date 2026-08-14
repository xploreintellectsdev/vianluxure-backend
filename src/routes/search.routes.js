const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');

router.get('/filters', searchController.getFilters);
router.get('/', searchController.search);

module.exports = router;