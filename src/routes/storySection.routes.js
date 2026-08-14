const express = require('express');
const router = express.Router();
const storySectionController = require('../controllers/storySection.controller');
const { uploadFile } = require('../middleware/upload.middleware');

const cardUpload = uploadFile('story-sections').fields([
  { name: 'image', maxCount: 1 }
]);

const handleCardUpload = (req, res, next) => {
  cardUpload(req, res, (err) => {
    if (err) {
      console.error('MULTER STORY SECTION ERROR:', err.message);
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    next();
  });
};

// --- Aggregate Views (Public) ---
// GET /api/story-sections/with-cards?activeOnly=true
router.get('/with-cards', storySectionController.getAllSectionsWithCards);

// --- Story Sections ---
router.get('/', storySectionController.getSections);
router.get('/:id', storySectionController.getSectionById);
router.post('/', storySectionController.createSection);
router.put('/:id', storySectionController.updateSection);
router.delete('/:id', storySectionController.deleteSection);

// --- Story Cards ---
router.get('/:sectionId/cards', storySectionController.getCardsBySection);
router.post('/:sectionId/cards', handleCardUpload, storySectionController.createCard);
router.put('/cards/:cardId', handleCardUpload, storySectionController.updateCard);
router.delete('/cards/:cardId', storySectionController.deleteCard);
router.put('/:sectionId/cards/reorder', storySectionController.reorderCards);

module.exports = router;
