const express = require('express');
const router = express.Router();
const aboutController = require('../controllers/about.controller');
const { uploadFile } = require('../middleware/upload.middleware');

const sectionUpload = uploadFile('about-page').fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery_images', maxCount: 30 }
]);
const itemUpload = uploadFile('about-page').fields([{ name: 'item_image', maxCount: 1 }]);
const bulkUpload = uploadFile('about-page').array('images', 30);

const handleSectionUpload = (req, res, next) => {
  sectionUpload(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    if (req.files && req.files.image && req.files.image.length > 0) {
      req.file = req.files.image[0]; // Map it back to req.file for controller
    }
    next();
  });
};

const handleItemUpload = (req, res, next) => {
  itemUpload(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    if (req.files && req.files.item_image && req.files.item_image.length > 0) {
      req.file = req.files.item_image[0]; // Map it back to req.file for controller
    }
    next();
  });
};

const handleBulkUpload = (req, res, next) => {
  bulkUpload(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    next();
  });
};

// --- Aggregate View ---
router.get('/with-items', aboutController.getAllSectionsWithItems);

// --- Sections ---
router.get('/', aboutController.getSections);
router.get('/:id', aboutController.getSectionById);
router.post('/', handleSectionUpload, aboutController.createSection);
router.put('/:id', handleSectionUpload, aboutController.updateSection);
router.delete('/:id', aboutController.deleteSection);

// --- Items ---
router.get('/:sectionId/items', aboutController.getItemsBySectionId);
router.post('/:sectionId/items', handleItemUpload, aboutController.createItem);
router.put('/items/:itemId', handleItemUpload, aboutController.updateItem);
router.delete('/items/:itemId', aboutController.deleteItem);
router.put('/:sectionId/items/reorder', aboutController.reorderItems);

// --- Bulk Upload ---
router.post('/:sectionId/items/bulk', handleBulkUpload, aboutController.bulkUploadItems);

module.exports = router;
