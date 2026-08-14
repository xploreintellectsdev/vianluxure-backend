const customerStoryService = require('../services/customerStory.service');

const getByPage = async (req, res) => {
  try {
    const { pageKey } = req.params;
    const activeOnly = req.query.activeOnly === 'true';
    const viewMode = req.query.viewMode || 'active';
    
    const data = await customerStoryService.getSectionByPageKey(pageKey, activeOnly, viewMode);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching customer story info:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const upsertSection = async (req, res) => {
  try {
    const { pageKey } = req.params;
    const { title, is_active } = req.body;
    let image = req.body.image;

    // Handle multer upload
    if (req.file) {
      image = `${req.protocol}://${req.get('host')}/uploads/customer-stories/${req.file.filename}`;
    }
    
    const data = {
      title,
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    };

    if (image !== undefined) {
      data.image = image;
    }

    const sectionId = await customerStoryService.upsertSection(pageKey, data);
    res.status(200).json({ success: true, message: 'Customer story section saved successfully', data: { story_section_id: sectionId } });
  } catch (error) {
    console.error('Error upserting customer story section:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// --- Stories ---

const createStory = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { order_no, customer_name, story_date, rating, story_text, is_active } = req.body;
    
    const insertId = await customerStoryService.createStory(sectionId, {
      order_no: Number(order_no || 0),
      customer_name,
      story_date: story_date || null,
      rating: Number(rating || 5),
      story_text,
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    });
    
    res.status(201).json({ success: true, message: 'Story created successfully', data: { story_id: insertId } });
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { order_no, customer_name, story_date, rating, story_text, is_active } = req.body;
    
    const updateData = {};
    if (order_no !== undefined) updateData.order_no = Number(order_no);
    if (customer_name !== undefined) updateData.customer_name = customer_name;
    if (story_date !== undefined) updateData.story_date = story_date;
    if (rating !== undefined) updateData.rating = Number(rating);
    if (story_text !== undefined) updateData.story_text = story_text;
    if (is_active !== undefined) updateData.is_active = (is_active === 'true' || is_active === true || is_active === '1' || is_active === 1) ? 1 : 0;
    
    const success = await customerStoryService.updateStory(storyId, updateData);
    if (!success) return res.status(404).json({ success: false, message: 'Story not found' });
    
    res.status(200).json({ success: true, message: 'Story updated successfully' });
  } catch (error) {
    console.error('Error updating story:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    await customerStoryService.deleteStory(storyId);
    res.status(200).json({ success: true, message: 'Story deleted successfully' });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const restoreStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    await customerStoryService.restoreStory(storyId);
    res.status(200).json({ success: true, message: 'Story restored successfully' });
  } catch (error) {
    console.error('Error restoring story:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const reorderStories = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { stories } = req.body; // Array of { story_id, order_no }
    
    if (!Array.isArray(stories)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    
    await customerStoryService.reorderStories(sectionId, stories);
    res.status(200).json({ success: true, message: 'Stories reordered successfully' });
  } catch (error) {
    console.error('Error reordering stories:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getByPage,
  upsertSection,
  createStory,
  updateStory,
  deleteStory,
  restoreStory,
  reorderStories
};
