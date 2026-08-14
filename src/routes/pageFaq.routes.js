const express = require('express');
const router = express.Router();
const pageFaqController = require('../controllers/pageFaq.controller');

router.get('/', pageFaqController.getAllSections);
router.get('/:pageKey', pageFaqController.getByPage);

// --- Items Routes (Must be before /:pageKey to avoid matching pageKey='faqs') ---
router.post('/:sectionId/faqs', pageFaqController.createFaq);
router.put('/faqs/:faqId', pageFaqController.updateFaq);
router.delete('/faqs/:faqId', pageFaqController.deleteFaq);
router.put('/faqs/:faqId/restore', pageFaqController.restoreFaq);
router.put('/:sectionId/faqs/reorder', pageFaqController.reorderFaqs);

// --- Sections Route ---
router.put('/:pageKey', pageFaqController.upsertSection);

module.exports = router;
