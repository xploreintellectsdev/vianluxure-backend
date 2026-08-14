const express = require('express');
const router = express.Router();
const customStyleCategoryController = require('../controllers/customStyleCategory.controller');

// Public route for fetching active categories (or all for admin if no activeOnly query provided)
router.get('/', customStyleCategoryController.getAll);

// Protected routes (add authentication middleware if needed, e.g. authenticateToken, isAdmin)
router.post('/', customStyleCategoryController.create);
router.put('/:id', customStyleCategoryController.update);
router.delete('/:id', customStyleCategoryController.remove);

module.exports = router;
