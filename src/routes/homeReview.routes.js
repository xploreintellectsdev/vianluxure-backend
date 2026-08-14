const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const homeReviewController = require('../controllers/homeReview.controller');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/home-reviews');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// Settings routes
router.get('/settings', homeReviewController.getSettings);
router.put('/settings', homeReviewController.updateSettings);

// Public route
router.get('/public', homeReviewController.getPublicData);

// Reviews routes
router.get('/', homeReviewController.getAllReviews);
router.post('/', upload.single('image'), homeReviewController.createReview);
router.post('/bulk', upload.array('images', 20), homeReviewController.bulkCreateReviews);
router.put('/:id', upload.single('image'), homeReviewController.updateReview);
router.delete('/:id', homeReviewController.softDeleteReview);
router.put('/:id/restore', homeReviewController.restoreReview);

module.exports = router;
