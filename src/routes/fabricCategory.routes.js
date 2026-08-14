const express = require('express');
const router = express.Router();
const fcController = require('../controllers/fabricCategory.controller');
const { uploadFile } = require('../middleware/upload.middleware');

const categoryUpload = uploadFile('category').single('image');

const handleCategoryUpload = (req, res, next) => {
  categoryUpload(req, res, (err) => {
    if (err) {
      console.error('MULTER ERROR:', err.message);
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    next();
  });
};

router.post('/', handleCategoryUpload, fcController.create);
router.put('/:id', handleCategoryUpload, fcController.update);
router.get('/', fcController.getAll);
router.get('/category/:slug', fcController.getByCategorySlug);
router.delete('/:id', fcController.delete);

module.exports = router;