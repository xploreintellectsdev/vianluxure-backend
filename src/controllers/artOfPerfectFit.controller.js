const artOfPerfectFitService = require('../services/artOfPerfectFit.service');

// --- Aggregate View ---

const getArtOfPerfectFit = async (req, res) => {
  try {
    const section = await artOfPerfectFitService.getSection();
    const steps = await artOfPerfectFitService.getSteps();
    
    return res.status(200).json({
      success: true,
      data: {
        title: section.title,
        is_active: section.is_active !== 0,
        steps: steps
      }
    });
  } catch (error) {
    console.error('Get Art of Perfect Fit Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- Section ---

const updateSection = async (req, res) => {
  try {
    const { title, is_active } = req.body;
    if (title === undefined || title === null) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const isActiveVal = is_active ? 1 : 0;
    await artOfPerfectFitService.updateSection(title, isActiveVal);
    return res.status(200).json({ success: true, message: 'Section updated successfully' });
  } catch (error) {
    console.error('Update Section Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- Steps ---

const createStep = async (req, res) => {
  try {
    const { title, description, display_order } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'title and description are required' });
    }

    let image_url = '';
    if (req.file) {
      image_url = `/uploads/art-of-perfect-fit/${req.file.filename}`;
    } else if (req.files && req.files['image'] && req.files['image'][0]) {
      image_url = `/uploads/art-of-perfect-fit/${req.files['image'][0].filename}`;
    }

    const insertId = await artOfPerfectFitService.createStep({
      title,
      description,
      image_url,
      display_order: display_order ? Number(display_order) : 0
    });

    return res.status(201).json({ success: true, message: 'Step created successfully', data: { id: insertId } });
  } catch (error) {
    console.error('Create Step Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, display_order } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'title and description are required' });
    }

    let image_url;
    if (req.file) {
      image_url = `/uploads/art-of-perfect-fit/${req.file.filename}`;
    } else if (req.files && req.files['image'] && req.files['image'][0]) {
      image_url = `/uploads/art-of-perfect-fit/${req.files['image'][0].filename}`;
    }

    await artOfPerfectFitService.updateStep(id, {
      title,
      description,
      image_url,
      display_order: display_order ? Number(display_order) : 0
    });

    return res.status(200).json({ success: true, message: 'Step updated successfully' });
  } catch (error) {
    console.error('Update Step Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteStep = async (req, res) => {
  try {
    await artOfPerfectFitService.deleteStep(req.params.id);
    return res.status(200).json({ success: true, message: 'Step deleted successfully' });
  } catch (error) {
    console.error('Delete Step Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const reorderSteps = async (req, res) => {
  try {
    const { steps } = req.body; // Array of { step_id, display_order }
    
    if (!Array.isArray(steps)) {
      return res.status(400).json({ success: false, message: 'Steps must be an array' });
    }

    await artOfPerfectFitService.reorderSteps(steps);
    
    return res.status(200).json({ success: true, message: 'Steps reordered successfully' });
  } catch (error) {
    console.error('Reorder Steps Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getArtOfPerfectFit,
  updateSection,
  createStep,
  updateStep,
  deleteStep,
  reorderSteps
};
