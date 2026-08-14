const express = require('express');
const router = express.Router();
const fabricController = require('../controllers/fabric.controller');
const { uploadFile } = require('../middleware/upload.middleware');

const fabricUpload = uploadFile('fabric').fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
    { name: 'rtwCoverImage', maxCount: 1 },
    { name: 'rtwGalleryImages', maxCount: 10 } 
]);

const handleFabricUpload = (req, res, next) => {
  fabricUpload(req, res, (err) => {
    if (err) {
      console.error('MULTER ERROR FIELD:', err.field, '| CODE:', err.code);
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.field ? `unexpected/invalid file field "${err.field}"` : err.message}`
      });
    }
    next();
  });
};

router.post('/', handleFabricUpload, fabricController.create);
router.get('/', fabricController.getAll);
router.get('/new-arrivals', fabricController.getNewArrivals);
router.get('/best-sellers', fabricController.getBestSellers);

// ── FIX: Moved this ABOVE the /:id route! ──
router.get('/available-for-rtw', fabricController.getAvailableForRTW);

router.get('/:id', fabricController.getById);
router.put('/:id', handleFabricUpload, fabricController.update);
router.delete('/:id', fabricController.delete);

module.exports = router;