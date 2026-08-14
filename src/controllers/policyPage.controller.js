const policyService = require('../services/policyPage.service');

const getAllPages = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const pages = await policyService.getAllPages({ activeOnly: activeOnly === 'true' });
    res.json({ success: true, data: pages });
  } catch (error) {
    console.error('Error fetching policy pages:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching policy pages.' });
  }
};

const getPageByKey = async (req, res) => {
  try {
    const { pageKey } = req.params;
    const page = await policyService.getPageByKey(pageKey);
    if (!page) {
      return res.status(404).json({ success: false, message: 'Policy page not found.' });
    }
    // Optionally filter sections by is_active for public view
    if (req.query.activeOnly === 'true') {
      for (const key in page.sections) {
        page.sections[key] = page.sections[key].filter(s => s.is_active === 1);
      }
      if (page.is_active === 0) {
        return res.status(404).json({ success: false, message: 'Policy page is inactive.' });
      }
    }
    res.json({ success: true, data: page });
  } catch (error) {
    console.error('Error fetching policy page:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching policy page.' });
  }
};

const createPage = async (req, res) => {
  try {
    const insertId = await policyService.createPage(req.body);
    res.json({ success: true, data: { page_id: insertId }, message: 'Policy page created successfully.' });
  } catch (error) {
    console.error('Error creating policy page:', error.message);
    res.status(500).json({ success: false, message: 'Server error creating policy page.' });
  }
};

const updatePage = async (req, res) => {
  try {
    const { pageId } = req.params;
    const success = await policyService.updatePage(pageId, req.body);
    if (success) {
      res.json({ success: true, message: 'Policy page updated successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'Policy page not found or no changes made.' });
    }
  } catch (error) {
    console.error('Error updating policy page:', error.message);
    res.status(500).json({ success: false, message: 'Server error updating policy page.' });
  }
};

const getSections = async (req, res) => {
  try {
    const { pageId } = req.params;
    const { trashed } = req.query;
    const sections = await policyService.getSections({ pageId, trashed: trashed === 'true' });
    res.json({ success: true, data: sections });
  } catch (error) {
    console.error('Error fetching policy sections:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching policy sections.' });
  }
};

const createSection = async (req, res) => {
  try {
    const { pageId } = req.params;
    const insertId = await policyService.createSection(pageId, req.body);
    res.json({ success: true, data: { section_id: insertId }, message: 'Section created successfully.' });
  } catch (error) {
    console.error('Error creating policy section:', error.message);
    res.status(500).json({ success: false, message: 'Server error creating policy section.' });
  }
};

const updateSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const success = await policyService.updateSection(sectionId, req.body);
    if (success) {
      res.json({ success: true, message: 'Section updated successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'Section not found or no changes made.' });
    }
  } catch (error) {
    console.error('Error updating policy section:', error.message);
    res.status(500).json({ success: false, message: 'Server error updating policy section.' });
  }
};

const deleteSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const success = await policyService.deleteSection(sectionId);
    if (success) {
      res.json({ success: true, message: 'Section moved to trash.' });
    } else {
      res.status(404).json({ success: false, message: 'Section not found.' });
    }
  } catch (error) {
    console.error('Error deleting policy section:', error.message);
    res.status(500).json({ success: false, message: 'Server error deleting policy section.' });
  }
};

const restoreSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const success = await policyService.restoreSection(sectionId);
    if (success) {
      res.json({ success: true, message: 'Section restored successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'Section not found.' });
    }
  } catch (error) {
    console.error('Error restoring policy section:', error.message);
    res.status(500).json({ success: false, message: 'Server error restoring policy section.' });
  }
};

const reorderSections = async (req, res) => {
  try {
    const { pageId } = req.params;
    const { group_name, orderedIds } = req.body;
    await policyService.reorderSections(pageId, group_name, orderedIds);
    res.json({ success: true, message: 'Sections reordered successfully.' });
  } catch (error) {
    console.error('Error reordering policy sections:', error.message);
    res.status(500).json({ success: false, message: 'Server error reordering policy sections.' });
  }
};

module.exports = {
  getAllPages,
  getPageByKey,
  createPage,
  updatePage,
  getSections,
  createSection,
  updateSection,
  deleteSection,
  restoreSection,
  reorderSections
};
