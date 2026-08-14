const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/banner.controller');
const { uploadFile } = require('../middleware/upload.middleware');

const bannerUpload = uploadFile('banners').fields([
  { name: 'image', maxCount: 1 }
]);

const handleBannerUpload = (req, res, next) => {
  bannerUpload(req, res, (err) => {
    if (err) {
      console.error('MULTER BANNER ERROR:', err.message);
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    next();
  });
};

router.get('/', bannerController.getBanners);
router.get('/:id', bannerController.getBannerById);
router.post('/', handleBannerUpload, bannerController.createBanner);
router.put('/:id', handleBannerUpload, bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;
