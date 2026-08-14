const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const customerStoryController = require('../controllers/customerStory.controller');

// --- File Upload Config ---
const uploadDir = path.join(__dirname, "..", "uploads", "customer-stories");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
});

// --- Routes ---
router.get('/:pageKey', customerStoryController.getByPage);

// Section Route (with single image upload)
router.post('/:pageKey/section', upload.single('image'), customerStoryController.upsertSection);

// Items Routes
router.post('/:sectionId/stories', customerStoryController.createStory);
router.put('/stories/:storyId', customerStoryController.updateStory);
router.delete('/stories/:storyId', customerStoryController.deleteStory);
router.put('/stories/:storyId/restore', customerStoryController.restoreStory);
router.put('/:sectionId/stories/reorder', customerStoryController.reorderStories);

module.exports = router;
