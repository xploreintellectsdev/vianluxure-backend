const pageFaqService = require('../services/pageFaq.service');

const getByPage = async (req, res) => {
  try {
    const { pageKey } = req.params;
    const activeOnly = req.query.activeOnly === 'true';
    const viewMode = req.query.viewMode || 'active';
    
    const data = await pageFaqService.getFaqSectionByPage(pageKey, activeOnly, viewMode);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching FAQ info:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAllSections = async (req, res) => {
  try {
    const sections = await pageFaqService.getAllFaqSections();
    res.status(200).json({ success: true, data: sections });
  } catch (error) {
    console.error('Error fetching all FAQ sections:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const upsertSection = async (req, res) => {
  try {
    const { pageKey } = req.params;
    const { subtitle, title, footer_text, is_active } = req.body;
    
    const data = {
      subtitle,
      title,
      footer_text,
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    };

    const sectionId = await pageFaqService.upsertFaqSection(pageKey, data);
    res.status(200).json({ success: true, message: 'FAQ section saved successfully', data: { faq_section_id: sectionId } });
  } catch (error) {
    console.error('Error upserting FAQ section:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// --- FAQs ---

const createFaq = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { order_no, question, answer, is_active } = req.body;
    
    const insertId = await pageFaqService.createFaq(sectionId, {
      order_no: Number(order_no || 0),
      question,
      answer,
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    });
    
    res.status(201).json({ success: true, message: 'FAQ created successfully', data: { faq_id: insertId } });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateFaq = async (req, res) => {
  try {
    const { faqId } = req.params;
    const { order_no, question, answer, is_active } = req.body;
    
    const updateData = {};
    if (order_no !== undefined) updateData.order_no = Number(order_no);
    if (question !== undefined) updateData.question = question;
    if (answer !== undefined) updateData.answer = answer;
    if (is_active !== undefined) updateData.is_active = (is_active === 'true' || is_active === true || is_active === '1' || is_active === 1) ? 1 : 0;
    
    const success = await pageFaqService.updateFaq(faqId, updateData);
    if (!success) return res.status(404).json({ success: false, message: 'FAQ not found' });
    
    res.status(200).json({ success: true, message: 'FAQ updated successfully' });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deleteFaq = async (req, res) => {
  try {
    const { faqId } = req.params;
    await pageFaqService.deleteFaq(faqId);
    res.status(200).json({ success: true, message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const restoreFaq = async (req, res) => {
  try {
    const { faqId } = req.params;
    await pageFaqService.restoreFaq(faqId);
    res.status(200).json({ success: true, message: 'FAQ restored successfully' });
  } catch (error) {
    console.error('Error restoring FAQ:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const reorderFaqs = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { faqs } = req.body; // Array of { faq_id, order_no }
    
    if (!Array.isArray(faqs)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    
    await pageFaqService.reorderFaqs(sectionId, faqs);
    res.status(200).json({ success: true, message: 'FAQs reordered successfully' });
  } catch (error) {
    console.error('Error reordering FAQs:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getByPage,
  getAllSections,
  upsertSection,
  createFaq,
  updateFaq,
  deleteFaq,
  restoreFaq,
  reorderFaqs
};
