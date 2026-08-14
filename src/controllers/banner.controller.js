const bannerService = require('../services/banner.service');

const getBanners = async (req, res) => {
  try {
    const { activeOnly = 'false' } = req.query;
    const banners = await bannerService.getBanners({ activeOnly });
    return res.status(200).json({ success: true, data: banners });
  } catch (error) {
    console.error('Get Banners Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getBannerById = async (req, res) => {
  try {
    const banner = await bannerService.getBannerById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
    return res.status(200).json({ success: true, data: banner });
  } catch (error) {
    console.error('Get Banner By ID Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createBanner = async (req, res) => {
  try {
    const { banner_key, order_no, layout_type, eyebrow_label, title, description, button_text, button_link, is_active, stats } = req.body;
    
    let image = '';
    if (req.file) {
      image = `/uploads/banners/${req.file.filename}`;
    } else if (req.files && req.files['image'] && req.files['image'][0]) {
      image = `/uploads/banners/${req.files['image'][0].filename}`;
    }

    if (!image) {
      return res.status(400).json({ success: false, message: 'Banner image is required.' });
    }

    const insertId = await bannerService.createBanner({
      banner_key,
      order_no: Number(order_no || 0),
      layout_type: layout_type || 'overlay',
      eyebrow_label: eyebrow_label || '',
      title,
      description: description || '',
      button_text: button_text || '',
      button_link: button_link || '',
      image,
      is_active: (is_active === 'true' || is_active === '1' || is_active === 1) ? 1 : 0
    });

    if (stats) {
      try {
        const parsedStats = JSON.parse(stats);
        await bannerService.replaceStatsForBanner(insertId, parsedStats);
      } catch (e) {
        console.error('Error parsing stats JSON on create:', e.message);
      }
    }

    return res.status(201).json({ success: true, message: 'Banner created successfully', id: insertId });
  } catch (error) {
    console.error('Create Banner Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateBanner = async (req, res) => {
  try {
    const bannerId = req.params.id;
    const { banner_key, order_no, layout_type, eyebrow_label, title, description, button_text, button_link, is_active, stats } = req.body;
    
    let image = null;
    if (req.file) {
      image = `/uploads/banners/${req.file.filename}`;
    } else if (req.files && req.files['image'] && req.files['image'][0]) {
      image = `/uploads/banners/${req.files['image'][0].filename}`;
    }

    const success = await bannerService.updateBanner(bannerId, {
      banner_key,
      order_no: Number(order_no || 0),
      layout_type: layout_type || 'overlay',
      eyebrow_label: eyebrow_label || '',
      title,
      description: description || '',
      button_text: button_text || '',
      button_link: button_link || '',
      image,
      is_active: (is_active === 'true' || is_active === '1' || is_active === 1) ? 1 : 0
    });

    if (!success) {
      return res.status(404).json({ success: false, message: 'Banner not found or not updated' });
    }

    if (stats) {
      try {
        const parsedStats = JSON.parse(stats);
        await bannerService.replaceStatsForBanner(bannerId, parsedStats);
      } catch (e) {
        console.error('Error parsing stats JSON on update:', e.message);
      }
    }

    return res.status(200).json({ success: true, message: 'Banner updated successfully' });
  } catch (error) {
    console.error('Update Banner Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteBanner = async (req, res) => {
  try {
    const success = await bannerService.deleteBanner(req.params.id);
    if (!success) return res.status(404).json({ success: false, message: 'Banner not found or already deleted' });
    return res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Delete Banner Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner
};
