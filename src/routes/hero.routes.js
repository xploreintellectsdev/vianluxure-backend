const express = require('express');
const router = express.Router();
const heroController = require('../controllers/hero.controller');
const { uploadFile } = require('../middleware/upload.middleware');

const heroUpload = uploadFile('hero').fields([
  { name: 'image', maxCount: 1 }
]);

const handleHeroUpload = (req, res, next) => {
  heroUpload(req, res, (err) => {
    if (err) {
      console.error('MULTER HERO ERROR:', err.message);
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    next();
  });
};

// --- Slides ---
router.get('/slides', heroController.getSlides);
router.get('/slides/:id', heroController.getSlideById);
router.post('/slides', handleHeroUpload, heroController.createSlide);
router.put('/slides/:id', handleHeroUpload, heroController.updateSlide);
router.delete('/slides/:id', heroController.deleteSlide);

// --- Marquee Items ---
router.get('/marquee', heroController.getMarqueeItems);
router.get('/marquee/:id', heroController.getMarqueeItemById);
router.post('/marquee', heroController.createMarqueeItem);
router.put('/marquee/:id', heroController.updateMarqueeItem);
router.delete('/marquee/:id', heroController.deleteMarqueeItem);

module.exports = router;
