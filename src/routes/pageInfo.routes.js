const express = require('express');
const router = express.Router();
const pageInfoController = require('../controllers/pageInfo.controller');
const { uploadFile } = require('../middleware/upload.middleware');

const imageUpload = uploadFile('page-info').fields([
  { name: 'image', maxCount: 1 }
]);

const handleImageUpload = (req, res, next) => {
  imageUpload(req, res, (err) => {
    if (err) {
      console.error('MULTER ERROR:', err.message);
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    next();
  });
};

router.get('/', pageInfoController.getAllSections);
router.get('/:pageKey', pageInfoController.getByPage);

// --- Items Routes (Must be before /:pageKey/:sectionType to avoid matching pageKey='items') ---
router.post('/:sectionId/items', pageInfoController.createItem);
router.put('/items/:itemId', pageInfoController.updateItem);
router.delete('/items/:itemId', pageInfoController.deleteItem);
router.put('/items/:itemId/restore', pageInfoController.restoreItem);
router.put('/:sectionId/items/reorder', pageInfoController.reorderItems);

// --- Sections Route ---
router.put('/:pageKey/:sectionType', handleImageUpload, pageInfoController.upsertSection);

module.exports = router;
