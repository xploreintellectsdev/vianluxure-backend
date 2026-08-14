const { pool } = require('../config/db');

// --- Page FAQ Sections ---

const getFaqSectionByPage = async (pageKey, activeOnly = false, viewMode = 'active') => {
  let query = 'SELECT * FROM page_faq_sections WHERE page_key = ? AND deleted_at IS NULL';
  const params = [pageKey];
  
  if (activeOnly) {
    query += ' AND is_active = 1';
  }
  
  const [rows] = await pool.query(query, params);
  const section = rows[0];
  
  if (section) {
    section.faqs = await getFaqsBySectionId(section.faq_section_id, activeOnly, viewMode);
  }
  
  return section;
};

const upsertFaqSection = async (pageKey, data) => {
  const { subtitle = 'Frequently Asked Questions', title = '', footer_text = '', is_active = 1 } = data;
  
  const [existing] = await pool.query(
    'SELECT faq_section_id FROM page_faq_sections WHERE page_key = ? AND deleted_at IS NULL',
    [pageKey]
  );
  
  if (existing.length > 0) {
    const sectionId = existing[0].faq_section_id;
    await pool.query(
      'UPDATE page_faq_sections SET subtitle = ?, title = ?, footer_text = ?, is_active = ? WHERE faq_section_id = ?',
      [subtitle, title, footer_text, is_active, sectionId]
    );
    return sectionId;
  } else {
    const [result] = await pool.query(
      `INSERT INTO page_faq_sections (page_key, subtitle, title, footer_text, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [pageKey, subtitle, title, footer_text, is_active]
    );
    return result.insertId;
  }
};

const getFaqSectionById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM page_faq_sections WHERE faq_section_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const getAllFaqSections = async () => {
  const [rows] = await pool.query('SELECT * FROM page_faq_sections WHERE deleted_at IS NULL');
  return rows;
};

// --- Page FAQs ---

const getFaqsBySectionId = async (sectionId, activeOnly = false, viewMode = 'active') => {
  let query = 'SELECT * FROM page_faqs WHERE faq_section_id = ?';
  if (viewMode === 'trash') {
    query += ' AND deleted_at IS NOT NULL';
  } else {
    query += ' AND deleted_at IS NULL';
  }
  const params = [sectionId];
  if (activeOnly) {
    query += ' AND is_active = 1';
  }
  query += ' ORDER BY order_no ASC';
  const [rows] = await pool.query(query, params);
  return rows;
};

const getFaqById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM page_faqs WHERE faq_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const createFaq = async (sectionId, data) => {
  const { order_no = 0, question, answer = '', is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO page_faqs (faq_section_id, order_no, question, answer, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [sectionId, order_no, question, answer, is_active]
  );
  return result.insertId;
};

const updateFaq = async (id, data) => {
  const updates = [];
  const params = [];
  
  if (data.order_no !== undefined) { updates.push('order_no = ?'); params.push(data.order_no); }
  if (data.question !== undefined) { updates.push('question = ?'); params.push(data.question); }
  if (data.answer !== undefined) { updates.push('answer = ?'); params.push(data.answer); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); params.push(data.is_active); }
  
  if (updates.length === 0) return true;
  
  const query = `UPDATE page_faqs SET ${updates.join(', ')} WHERE faq_id = ? AND deleted_at IS NULL`;
  params.push(id);
  
  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
};

const deleteFaq = async (id) => {
  await pool.query('UPDATE page_faqs SET deleted_at = CURRENT_TIMESTAMP WHERE faq_id = ?', [id]);
};

const restoreFaq = async (id) => {
  await pool.query('UPDATE page_faqs SET deleted_at = NULL WHERE faq_id = ?', [id]);
};

const reorderFaqs = async (sectionId, faqOrders) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const { faq_id, order_no } of faqOrders) {
      await connection.query(
        'UPDATE page_faqs SET order_no = ? WHERE faq_id = ? AND faq_section_id = ? AND deleted_at IS NULL',
        [order_no, faq_id, sectionId]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getFaqSectionByPage,
  upsertFaqSection,
  getFaqSectionById,
  getAllFaqSections,
  
  getFaqsBySectionId,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  restoreFaq,
  reorderFaqs
};
