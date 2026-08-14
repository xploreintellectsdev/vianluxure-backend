const storySectionService = require('../services/storySection.service');

// --- Story Sections ---

const getSections = async (req, res) => {
  try {
    const { search = '', sort = 'order_no', order = 'ASC', page = 1, limit = 10, status = '' } = req.query;
    const result = await storySectionService.getSections({
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
    console.error('Get Story Sections Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getSectionById = async (req, res) => {
  try {
    const section = await storySectionService.getSectionById(req.params.id);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    
    section.cards = await storySectionService.getCardsBySectionId(req.params.id);
    return res.status(200).json({ success: true, data: section });
  } catch (error) {
    console.error('Get Story Section By ID Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getCardsBySection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const cards = await storySectionService.getCardsBySectionId(sectionId);
    return res.status(200).json({ success: true, data: cards });
  } catch (error) {
    console.error('Get Cards By Section Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createSection = async (req, res) => {
  try {
    const { section_key, order_no, eyebrow_label, title, description, is_active } = req.body;
    
    if (!section_key || !title) {
      return res.status(400).json({ success: false, message: 'section_key and title are required' });
    }

    const insertId = await storySectionService.createSection({
      section_key,
      order_no,
      eyebrow_label,
      title,
      description,
      is_active
    });

    return res.status(201).json({ success: true, message: 'Section created successfully', data: { id: insertId } });
  } catch (error) {
    console.error('Create Story Section Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateSection = async (req, res) => {
  try {
    const { section_key, order_no, eyebrow_label, title, description, is_active } = req.body;
    const { id } = req.params;

    if (!section_key || !title) {
      return res.status(400).json({ success: false, message: 'section_key and title are required' });
    }

    await storySectionService.updateSection(id, {
      section_key,
      order_no,
      eyebrow_label,
      title,
      description,
      is_active
    });

    return res.status(200).json({ success: true, message: 'Section updated successfully' });
  } catch (error) {
    console.error('Update Story Section Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteSection = async (req, res) => {
  try {
    await storySectionService.deleteSection(req.params.id);
    return res.status(200).json({ success: true, message: 'Section deleted successfully' });
  } catch (error) {
    console.error('Delete Story Section Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- Story Cards ---

const createCard = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { order_no, caption, card_title, card_description, is_active } = req.body;
    
    let image = '';
    if (req.file) {
      image = `/uploads/story-sections/${req.file.filename}`;
    } else if (req.files && req.files['image'] && req.files['image'][0]) {
      image = `/uploads/story-sections/${req.files['image'][0].filename}`;
    }

    if (!image) {
      return res.status(400).json({ success: false, message: 'Image is required for a story card' });
    }

    const insertId = await storySectionService.createCard(sectionId, {
      order_no,
      image,
      caption,
      card_title,
      card_description,
      is_active
    });

    return res.status(201).json({ success: true, message: 'Card created successfully', data: { id: insertId } });
  } catch (error) {
    console.error('Create Story Card Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { order_no, caption, card_title, card_description, is_active } = req.body;
    
    let image;
    if (req.file) {
      image = `/uploads/story-sections/${req.file.filename}`;
    } else if (req.files && req.files['image'] && req.files['image'][0]) {
      image = `/uploads/story-sections/${req.files['image'][0].filename}`;
    }

    await storySectionService.updateCard(cardId, {
      order_no,
      image,
      caption,
      card_title,
      card_description,
      is_active
    });

    return res.status(200).json({ success: true, message: 'Card updated successfully' });
  } catch (error) {
    console.error('Update Story Card Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteCard = async (req, res) => {
  try {
    await storySectionService.deleteCard(req.params.cardId);
    return res.status(200).json({ success: true, message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Delete Story Card Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const reorderCards = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { cards } = req.body; // Array of { card_id, order_no }
    
    if (!Array.isArray(cards)) {
      return res.status(400).json({ success: false, message: 'Cards must be an array' });
    }

    await storySectionService.reorderCards(sectionId, cards);
    
    return res.status(200).json({ success: true, message: 'Cards reordered successfully' });
  } catch (error) {
    console.error('Reorder Cards Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- Aggregate Views ---

const getAllSectionsWithCards = async (req, res) => {
  try {
    const { activeOnly = 'false' } = req.query;
    const isActiveOnly = activeOnly === 'true' || activeOnly === '1';
    
    const sections = await storySectionService.getAllSectionsWithCards(isActiveOnly);
    
    return res.status(200).json({ success: true, data: sections });
  } catch (error) {
    console.error('Get All Sections with Cards Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSections,
  getSectionById,
  getCardsBySection,
  createSection,
  updateSection,
  deleteSection,
  
  createCard,
  updateCard,
  deleteCard,
  reorderCards,
  
  getAllSectionsWithCards
};
