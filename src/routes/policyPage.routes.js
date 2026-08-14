const express = require('express');
const router = express.Router();
const policyPageController = require('../controllers/policyPage.controller');

// --- Policy Pages ---
router.get('/', policyPageController.getAllPages);
router.get('/:pageKey', policyPageController.getPageByKey);
router.post('/', policyPageController.createPage);
router.put('/:pageId', policyPageController.updatePage);

// --- Policy Sections ---
router.get('/:pageId/sections', policyPageController.getSections);
router.post('/:pageId/sections', policyPageController.createSection);
router.put('/:pageId/sections/reorder', policyPageController.reorderSections); // Must be before /sections/:sectionId to avoid match issues

// Important: these use /sections/:sectionId as the path to avoid confusion with page routes
router.put('/sections/:sectionId', policyPageController.updateSection);
router.delete('/sections/:sectionId', policyPageController.deleteSection);
router.put('/sections/:sectionId/restore', policyPageController.restoreSection);

module.exports = router;
