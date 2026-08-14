const express = require('express');
const router = express.Router();
const ptController = require('../controllers/productType.controller');

// ==========================================
// Base Route: /api/product-types
// ==========================================

// Create a new product type
router.post('/', ptController.create);

// Get all product types (supports ?search= & page= & limit=)
router.get('/', ptController.getAll);

// Update a product type by ID
router.put('/:id', ptController.update);

// Delete a product type by ID
router.delete('/:id', ptController.delete);

module.exports = router;