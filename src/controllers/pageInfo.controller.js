const pageInfoService = require('../services/pageInfo.service');

const getByPage = async (req, res) => {
  try {
    const { pageKey } = req.params;
    // For public frontend, we want activeOnly = true, but admin needs all.
    // Let's pass an activeOnly flag in query if needed.
    const activeOnly = req.query.activeOnly === 'true';
    const viewMode = req.query.viewMode || 'active';
    
    const data = await pageInfoService.getAllSectionsForPage(pageKey, activeOnly, viewMode);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching page info:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAllSections = async (req, res) => {
  try {
    const sections = await pageInfoService.getAllSections();
    res.status(200).json({ success: true, data: sections });
  } catch (error) {
    console.error('Error fetching all page info sections:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const upsertSection = async (req, res) => {
  try {
    const { pageKey, sectionType } = req.params;
    const { subtitle, title, description, is_active } = req.body;
    
    let image = undefined;
    if (req.file) {
      image = `/uploads/page-info/${req.file.filename}`;
    } else if (req.files && req.files['image'] && req.files['image'][0]) {
      image = `/uploads/page-info/${req.files['image'][0].filename}`;
    }
    
    const data = {
      subtitle,
      title,
      description,
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    };
    if (image !== undefined) data.image = image;

    const sectionId = await pageInfoService.upsertSection(pageKey, sectionType, data);
    res.status(200).json({ success: true, message: 'Section saved successfully', data: { section_id: sectionId } });
  } catch (error) {
    console.error('Error upserting section:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// --- Items ---

const createItem = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { order_no, icon_key, item_title, item_description, is_active } = req.body;
    
    const insertId = await pageInfoService.createItem(sectionId, {
      order_no: Number(order_no || 0),
      icon_key,
      item_title,
      item_description,
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    });
    
    res.status(201).json({ success: true, message: 'Item created successfully', data: { item_id: insertId } });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { order_no, icon_key, item_title, item_description, is_active } = req.body;
    
    const updateData = {};
    if (order_no !== undefined) updateData.order_no = Number(order_no);
    if (icon_key !== undefined) updateData.icon_key = icon_key;
    if (item_title !== undefined) updateData.item_title = item_title;
    if (item_description !== undefined) updateData.item_description = item_description;
    if (is_active !== undefined) updateData.is_active = (is_active === 'true' || is_active === true || is_active === '1' || is_active === 1) ? 1 : 0;
    
    const success = await pageInfoService.updateItem(itemId, updateData);
    if (!success) return res.status(404).json({ success: false, message: 'Item not found' });
    
    res.status(200).json({ success: true, message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    await pageInfoService.deleteItem(itemId);
    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting page info item:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const restoreItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    await pageInfoService.restoreItem(itemId);
    res.status(200).json({ success: true, message: 'Item restored successfully' });
  } catch (error) {
    console.error('Error restoring page info item:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const reorderItems = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { items } = req.body; // Array of { item_id, order_no }
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    
    await pageInfoService.reorderItems(sectionId, items);
    res.status(200).json({ success: true, message: 'Items reordered successfully' });
  } catch (error) {
    console.error('Error reordering items:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getByPage,
  getAllSections,
  upsertSection,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  restoreItem
};
