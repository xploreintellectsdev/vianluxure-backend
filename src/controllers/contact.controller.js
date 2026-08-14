const contactService = require('../services/contact.service');

// --- HERO ---

const getHero = async (req, res) => {
  try {
    const hero = await contactService.getHero();
    res.json({ success: true, data: hero });
  } catch (err) {
    console.error('Error fetching contact hero:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch contact hero' });
  }
};

const upsertHero = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.files && req.files.image && req.files.image.length > 0) {
      data.image = `/uploads/contact-page/${req.files.image[0].filename}`;
    }
    if (data.is_active !== undefined) {
      data.is_active = data.is_active === 'true' || data.is_active === '1' || data.is_active === 1 || data.is_active === true ? 1 : 0;
    }
    const updatedHero = await contactService.upsertHero(data);
    res.json({ success: true, data: updatedHero, message: 'Hero section updated successfully' });
  } catch (err) {
    console.error('Error updating contact hero:', err);
    res.status(500).json({ success: false, message: 'Failed to update contact hero' });
  }
};

// --- INFO ITEMS & MAP ---

const getInfoItems = async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const items = await contactService.getInfoItems(activeOnly);
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('Error fetching info items:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch contact info items' });
  }
};

const createInfoItem = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.is_active !== undefined) {
      data.is_active = data.is_active === 'true' || data.is_active === '1' || data.is_active === 1 || data.is_active === true ? 1 : 0;
    }
    const newItem = await contactService.createInfoItem(data);
    res.status(201).json({ success: true, data: newItem, message: 'Item created successfully' });
  } catch (err) {
    console.error('Error creating info item:', err);
    res.status(500).json({ success: false, message: 'Failed to create item' });
  }
};

const updateInfoItem = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.is_active !== undefined) {
      data.is_active = data.is_active === 'true' || data.is_active === '1' || data.is_active === 1 || data.is_active === true ? 1 : 0;
    }
    const updatedItem = await contactService.updateInfoItem(id, data);
    res.json({ success: true, data: updatedItem, message: 'Item updated successfully' });
  } catch (err) {
    console.error('Error updating info item:', err);
    res.status(500).json({ success: false, message: 'Failed to update item' });
  }
};

const deleteInfoItem = async (req, res) => {
  try {
    const { id } = req.params;
    await contactService.deleteInfoItem(id);
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Error deleting info item:', err);
    res.status(500).json({ success: false, message: 'Failed to delete item' });
  }
};

const reorderInfoItems = async (req, res) => {
  try {
    const { items } = req.body;
    await contactService.reorderInfoItems(items);
    res.json({ success: true, message: 'Items reordered successfully' });
  } catch (err) {
    console.error('Error reordering items:', err);
    res.status(500).json({ success: false, message: 'Failed to reorder items' });
  }
};

// --- SUBMISSIONS ---

const getSubmissions = async (req, res) => {
  try {
    const { search, page, limit, status } = req.query;
    const result = await contactService.getSubmissions({ search, page, limit, status });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch submissions' });
  }
};

const createSubmission = async (req, res) => {
  try {
    const data = req.body;
    if (!data.full_name) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }
    const newSubmission = await contactService.createSubmission(data);
    res.status(201).json({ success: true, data: newSubmission, message: 'Message sent successfully' });
  } catch (err) {
    console.error('Error creating submission:', err);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

const markSubmissionRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await contactService.markSubmissionRead(id);
    res.json({ success: true, data: updated, message: 'Marked as read' });
  } catch (err) {
    console.error('Error marking submission read:', err);
    res.status(500).json({ success: false, message: 'Failed to update submission' });
  }
};

const deleteSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    await contactService.deleteSubmission(id);
    res.json({ success: true, message: 'Submission deleted successfully' });
  } catch (err) {
    console.error('Error deleting submission:', err);
    res.status(500).json({ success: false, message: 'Failed to delete submission' });
  }
};

// --- COMBINED ENDPOINT ---
const getPageData = async (req, res) => {
  try {
    const [hero, infoItems] = await Promise.all([
      contactService.getHero(),
      contactService.getInfoItems(true)
    ]);
    res.json({ success: true, data: { hero, infoItems } });
  } catch (err) {
    console.error('Error fetching contact page data:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch contact page data' });
  }
};

module.exports = {
  getHero,
  upsertHero,
  getInfoItems,
  createInfoItem,
  updateInfoItem,
  deleteInfoItem,
  reorderInfoItems,
  getSubmissions,
  createSubmission,
  markSubmissionRead,
  deleteSubmission,
  getPageData
};
