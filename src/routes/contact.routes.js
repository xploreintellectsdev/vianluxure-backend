const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const { uploadFile } = require('../middleware/upload.middleware');

// Public endpoints
router.get('/page-data', contactController.getPageData);
router.get('/hero', contactController.getHero);
router.get('/info-items', contactController.getInfoItems);
router.post('/submissions', contactController.createSubmission); // Submit contact form

// Admin endpoints (in a real app, these would be protected by auth middleware)
// Hero
router.put('/hero', uploadFile('contact-page').fields([{ name: 'image', maxCount: 1 }]), contactController.upsertHero);

// Info Items
router.post('/info-items', contactController.createInfoItem);
router.put('/info-items/reorder', contactController.reorderInfoItems);
router.put('/info-items/:id', contactController.updateInfoItem);
router.delete('/info-items/:id', contactController.deleteInfoItem);

// Submissions
router.get('/submissions', contactController.getSubmissions);
router.put('/submissions/:id/read', contactController.markSubmissionRead);
router.delete('/submissions/:id', contactController.deleteSubmission);

module.exports = router;
