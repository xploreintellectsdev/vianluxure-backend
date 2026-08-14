const aboutService = require('../services/about.service');

// --- Sections ---

const getSections = async (req, res) => {
  try {
    const { search, sort, order, page, limit, activeOnly } = req.query;
    const status = activeOnly === 'true' ? '1' : req.query.status;
    const result = await aboutService.getSections({ search, sort, order, page: parseInt(page), limit: parseInt(limit), status });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error in getSections:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sections" });
  }
};

const getSectionById = async (req, res) => {
  try {
    const section = await aboutService.getSectionById(req.params.id);
    if (!section) return res.status(404).json({ success: false, message: "Section not found" });
    
    const items = await aboutService.getItemsBySectionId(req.params.id);
    section.items = items;

    res.json({ success: true, data: section });
  } catch (error) {
    console.error("Error in getSectionById:", error);
    res.status(500).json({ success: false, message: "Failed to fetch section" });
  }
};

const createSection = async (req, res) => {
  try {
    const data = req.body;
    if (req.file) data.image = `/uploads/about-page/${req.file.filename}`;

    const sectionId = await aboutService.createSection(data);
    
    if (data.bullet_points) {
      let bullets = [];
      try { bullets = JSON.parse(data.bullet_points); } catch(e) {}
      for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        const isObj = typeof b === 'object' && b !== null;
        await aboutService.createItem(sectionId, {
          order_no: (i + 1) * 10,
          item_title: isObj ? b.title : b,
          item_text: isObj ? b.value : null,
          is_active: 1
        });
      }
    }
    
    if (data.process_steps) {
      let steps = [];
      try { steps = JSON.parse(data.process_steps); } catch(e) {}
      for (let i = 0; i < steps.length; i++) {
        await aboutService.createItem(sectionId, {
          order_no: (i + 1) * 10,
          item_title: steps[i].title,
          item_text: steps[i].value,
          is_active: 1
        });
      }
    }
    
    if (req.files && req.files.gallery_images && req.files.gallery_images.length > 0) {
      const mappedFiles = req.files.gallery_images.map(f => ({ ...f, filename: `/uploads/about-page/${f.filename}` }));
      await aboutService.bulkCreateItems(sectionId, mappedFiles);
    }

    res.status(201).json({ success: true, message: "Section created successfully", data: { section_id: sectionId } });
  } catch (error) {
    console.error("Error in createSection:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: "Section key already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to create section" });
  }
};

const updateSection = async (req, res) => {
  try {
    const data = req.body;
    if (req.file) data.image = `/uploads/about-page/${req.file.filename}`;

    await aboutService.updateSection(req.params.id, data);
    
    if (data.bullet_points !== undefined || data.process_steps !== undefined) {
      const pool = require('../config/db').pool;
      await pool.query('UPDATE about_section_items SET deleted_at = CURRENT_TIMESTAMP WHERE section_id = ? AND (item_image IS NULL OR item_image = "")', [req.params.id]);
      
      if (data.bullet_points !== undefined) {
        let bullets = [];
        try { bullets = JSON.parse(data.bullet_points); } catch(e) {}
        for (let i = 0; i < bullets.length; i++) {
          const b = bullets[i];
          const isObj = typeof b === 'object' && b !== null;
          await aboutService.createItem(req.params.id, {
            order_no: (i + 1) * 10,
            item_title: isObj ? b.title : b,
            item_text: isObj ? b.value : null,
            is_active: 1
          });
        }
      }
      
      if (data.process_steps !== undefined) {
        let steps = [];
        try { steps = JSON.parse(data.process_steps); } catch(e) {}
        for (let i = 0; i < steps.length; i++) {
          await aboutService.createItem(req.params.id, {
            order_no: (i + 1) * 10,
            item_title: steps[i].title,
            item_text: steps[i].value,
            is_active: 1
          });
        }
      }
    }
    
    if (req.files && req.files.gallery_images && req.files.gallery_images.length > 0) {
      const mappedFiles = req.files.gallery_images.map(f => ({ ...f, filename: `/uploads/about-page/${f.filename}` }));
      await aboutService.bulkCreateItems(req.params.id, mappedFiles);
    }

    res.json({ success: true, message: "Section updated successfully" });
  } catch (error) {
    console.error("Error in updateSection:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: "Section key already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to update section" });
  }
};

const deleteSection = async (req, res) => {
  try {
    await aboutService.deleteSection(req.params.id);
    res.json({ success: true, message: "Section deleted successfully" });
  } catch (error) {
    console.error("Error in deleteSection:", error);
    res.status(500).json({ success: false, message: "Failed to delete section" });
  }
};

// --- Items ---

const getItemsBySectionId = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const items = await aboutService.getItemsBySectionId(req.params.sectionId, activeOnly === 'true');
    res.json({ success: true, data: items });
  } catch (error) {
    console.error("Error in getItemsBySectionId:", error);
    res.status(500).json({ success: false, message: "Failed to fetch items" });
  }
};

const createItem = async (req, res) => {
  try {
    const data = req.body;
    if (req.file) data.item_image = `/uploads/about-page/${req.file.filename}`;

    const itemId = await aboutService.createItem(req.params.sectionId, data);
    res.status(201).json({ success: true, message: "Item created successfully", data: { item_id: itemId } });
  } catch (error) {
    console.error("Error in createItem:", error);
    res.status(500).json({ success: false, message: "Failed to create item" });
  }
};

const updateItem = async (req, res) => {
  try {
    const data = req.body;
    if (req.file) data.item_image = `/uploads/about-page/${req.file.filename}`;

    await aboutService.updateItem(req.params.itemId, data);
    res.json({ success: true, message: "Item updated successfully" });
  } catch (error) {
    console.error("Error in updateItem:", error);
    res.status(500).json({ success: false, message: "Failed to update item" });
  }
};

const deleteItem = async (req, res) => {
  try {
    await aboutService.deleteItem(req.params.itemId);
    res.json({ success: true, message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error in deleteItem:", error);
    res.status(500).json({ success: false, message: "Failed to delete item" });
  }
};

const reorderItems = async (req, res) => {
  try {
    const { itemOrders } = req.body; // Array of { item_id, order_no }
    if (!itemOrders || !Array.isArray(itemOrders)) {
      return res.status(400).json({ success: false, message: "Invalid itemOrders data" });
    }
    await aboutService.reorderItems(req.params.sectionId, itemOrders);
    res.json({ success: true, message: "Items reordered successfully" });
  } catch (error) {
    console.error("Error in reorderItems:", error);
    res.status(500).json({ success: false, message: "Failed to reorder items" });
  }
};

const bulkUploadItems = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }
    
    // Add /uploads/about-page/ prefix to filenames inside the service layer, or do it here and pass mapped files
    const mappedFiles = req.files.map(file => ({
      ...file,
      filename: `/uploads/about-page/${file.filename}`
    }));
    
    const count = await aboutService.bulkCreateItems(req.params.sectionId, mappedFiles);
    res.status(201).json({ success: true, message: `Successfully uploaded ${count} images` });
  } catch (error) {
    console.error("Error in bulkUploadItems:", error);
    res.status(500).json({ success: false, message: "Failed to bulk upload items" });
  }
};

// --- Aggregate View ---

const getAllSectionsWithItems = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const sections = await aboutService.getAllSectionsWithItems(activeOnly === 'true');
    res.json({ success: true, data: sections });
  } catch (error) {
    console.error("Error in getAllSectionsWithItems:", error);
    res.status(500).json({ success: false, message: "Failed to fetch all sections" });
  }
};

module.exports = {
  getSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  
  getItemsBySectionId,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  bulkUploadItems,
  
  getAllSectionsWithItems
};
