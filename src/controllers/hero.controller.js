const heroService = require('../services/hero.service');

// --- Hero Slides ---

const getSlides = async (req, res) => {
  try {
    const { search = '', sort = 'order_no', order = 'ASC', page = 1, limit = 10, status = '' } = req.query;
    const result = await heroService.getSlides({
      search,
      sort,
      order,
      page: Number(page),
      limit: Number(limit),
      status
    });
    
    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
      total: result.meta ? result.meta.total : result.data.length
    });
  } catch (error) {
    console.error('Get Slides Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getSlideById = async (req, res) => {
  try {
    const slide = await heroService.getSlideById(req.params.id);
    if (!slide) return res.status(404).json({ success: false, message: 'Slide not found' });
    return res.status(200).json({ success: true, data: slide });
  } catch (error) {
    console.error('Get Slide By ID Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createSlide = async (req, res) => {
  try {
    const { order_no, title, description, button_text, button_link, is_active } = req.body;
    
    let image = '';
    if (req.file) {
      image = `/uploads/hero/${req.file.filename}`;
    } else if (req.files && req.files['image'] && req.files['image'][0]) {
      image = `/uploads/hero/${req.files['image'][0].filename}`;
    }

    if (!image) {
      return res.status(400).json({ success: false, message: 'Slide image is required.' });
    }

    const insertId = await heroService.createSlide({
      order_no: Number(order_no || 0),
      title,
      description: description || '',
      image,
      button_text: button_text || '',
      button_link: button_link || '',
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    });

    return res.status(201).json({ success: true, message: 'Slide created successfully.', data: { slide_id: insertId } });
  } catch (error) {
    console.error('Create Slide Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateSlide = async (req, res) => {
  try {
    const { id } = req.params;
    const { order_no, title, description, button_text, button_link, is_active } = req.body;

    let image = null;
    if (req.file) {
      image = `/uploads/hero/${req.file.filename}`;
    } else if (req.files && req.files['image'] && req.files['image'][0]) {
      image = `/uploads/hero/${req.files['image'][0].filename}`;
    }

    const updateData = {};
    if (order_no !== undefined) updateData.order_no = Number(order_no);
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (button_text !== undefined) updateData.button_text = button_text;
    if (button_link !== undefined) updateData.button_link = button_link;
    if (is_active !== undefined) updateData.is_active = is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0;
    if (image) updateData.image = image;

    const success = await heroService.updateSlide(id, updateData);

    if (!success) return res.status(404).json({ success: false, message: 'Slide not found.' });

    return res.status(200).json({ success: true, message: 'Slide updated successfully.' });
  } catch (error) {
    console.error('Update Slide Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteSlide = async (req, res) => {
  try {
    const success = await heroService.deleteSlide(req.params.id);
    if (!success) return res.status(404).json({ success: false, message: 'Slide not found.' });
    return res.status(200).json({ success: true, message: 'Slide deleted successfully.' });
  } catch (error) {
    console.error('Delete Slide Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- Hero Marquee Items ---

const getMarqueeItems = async (req, res) => {
  try {
    const { search = '', sort = 'order_no', order = 'ASC', page = 1, limit = 50, status = '' } = req.query;
    const result = await heroService.getMarqueeItems({
      search,
      sort,
      order,
      page: Number(page),
      limit: Number(limit),
      status
    });
    
    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
      total: result.meta ? result.meta.total : result.data.length
    });
  } catch (error) {
    console.error('Get Marquee Items Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMarqueeItemById = async (req, res) => {
  try {
    const item = await heroService.getMarqueeItemById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Marquee item not found' });
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('Get Marquee Item By ID Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createMarqueeItem = async (req, res) => {
  try {
    const { order_no, item_text, is_active } = req.body;
    const insertId = await heroService.createMarqueeItem({
      order_no: Number(order_no || 0),
      item_text,
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    });
    return res.status(201).json({ success: true, message: 'Marquee item created successfully.', data: { item_id: insertId } });
  } catch (error) {
    console.error('Create Marquee Item Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateMarqueeItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { order_no, item_text, is_active } = req.body;
    const updateData = {};
    if (order_no !== undefined) updateData.order_no = Number(order_no);
    if (item_text !== undefined) updateData.item_text = item_text;
    if (is_active !== undefined) updateData.is_active = (is_active === 'true' || is_active === true || is_active === '1' || is_active === 1) ? 1 : 0;

    const success = await heroService.updateMarqueeItem(id, updateData);
    if (!success) return res.status(404).json({ success: false, message: 'Marquee item not found.' });
    return res.status(200).json({ success: true, message: 'Marquee item updated successfully.' });
  } catch (error) {
    console.error('Update Marquee Item Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteMarqueeItem = async (req, res) => {
  try {
    const success = await heroService.deleteMarqueeItem(req.params.id);
    if (!success) return res.status(404).json({ success: false, message: 'Marquee item not found.' });
    return res.status(200).json({ success: true, message: 'Marquee item deleted successfully.' });
  } catch (error) {
    console.error('Delete Marquee Item Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSlides,
  getSlideById,
  createSlide,
  updateSlide,
  deleteSlide,
  getMarqueeItems,
  getMarqueeItemById,
  createMarqueeItem,
  updateMarqueeItem,
  deleteMarqueeItem
};
