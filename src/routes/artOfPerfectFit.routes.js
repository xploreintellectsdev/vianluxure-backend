const express = require('express');
const router = express.Router();
const artOfPerfectFitController = require('../controllers/artOfPerfectFit.controller');
const { uploadFile } = require('../middleware/upload.middleware');

const stepUpload = uploadFile('art-of-perfect-fit').fields([
  { name: 'image', maxCount: 1 }
]);

const handleStepUpload = (req, res, next) => {
  stepUpload(req, res, (err) => {
    if (err) {
      console.error('MULTER ART OF PERFECT FIT ERROR:', err.message);
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    next();
  });
};

// --- Public Endpoints ---
router.get('/', artOfPerfectFitController.getArtOfPerfectFit);

// --- Admin Endpoints ---
router.put('/section', artOfPerfectFitController.updateSection);
router.post('/steps', handleStepUpload, artOfPerfectFitController.createStep);
router.put('/steps/reorder', artOfPerfectFitController.reorderSteps); // MUST come before /:id to avoid param conflict
router.put('/steps/:id', handleStepUpload, artOfPerfectFitController.updateStep);
router.delete('/steps/:id', artOfPerfectFitController.deleteStep);

module.exports = router;
