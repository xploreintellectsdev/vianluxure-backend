const { pool } = require('../config/db');

// --- Policy Pages ---

const getAllPages = async ({ activeOnly = false } = {}) => {
  let query = 'SELECT * FROM policy_pages';
  const params = [];
  if (activeOnly) {
    query += ' WHERE is_active = 1';
  }
  query += ' ORDER BY page_id ASC';
  const [rows] = await pool.query(query, params);
  return rows;
};

const getPageByKey = async (pageKey) => {
  const [pages] = await pool.query('SELECT * FROM policy_pages WHERE page_key = ?', [pageKey]);
  const page = pages[0];
  if (!page) return null;

  const [sections] = await pool.query('SELECT * FROM policy_sections WHERE page_id = ? AND deleted_at IS NULL ORDER BY order_no ASC', [page.page_id]);
  
  page.sections = {
    'main-grid': sections.filter(s => s.group_name === 'main-grid'),
    'stats': sections.filter(s => s.group_name === 'stats'),
    'footer-grid': sections.filter(s => s.group_name === 'footer-grid')
  };
  return page;
};

const createPage = async (data) => {
  const { page_key, hero_eyebrow = 'Policy', hero_title, hero_subtitle = '', intro_note = '', is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO policy_pages (page_key, hero_eyebrow, hero_title, hero_subtitle, intro_note, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [page_key, hero_eyebrow, hero_title, hero_subtitle, intro_note, is_active]
  );
  return result.insertId;
};

const updatePage = async (pageId, data) => {
  const { hero_eyebrow, hero_title, hero_subtitle, intro_note, is_active } = data;
  const [result] = await pool.query(
    `UPDATE policy_pages SET hero_eyebrow = ?, hero_title = ?, hero_subtitle = ?, intro_note = ?, is_active = ? WHERE page_id = ?`,
    [hero_eyebrow, hero_title, hero_subtitle, intro_note, is_active, pageId]
  );
  return result.affectedRows > 0;
};

// --- Policy Sections ---

const getSections = async ({ pageId, trashed = false }) => {
  let query = 'SELECT * FROM policy_sections WHERE page_id = ?';
  if (trashed) {
    query += ' AND deleted_at IS NOT NULL';
  } else {
    query += ' AND deleted_at IS NULL';
  }
  query += ' ORDER BY group_name ASC, order_no ASC';
  const [rows] = await pool.query(query, [pageId]);
  return rows;
};

const createSection = async (pageId, data) => {
  const { group_name, section_type, icon = '', title = '', content = '', stat_value = '', stat_unit = '', stat_label = '', stat_caption = '', order_no = 0, is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO policy_sections (page_id, group_name, section_type, icon, title, content, stat_value, stat_unit, stat_label, stat_caption, order_no, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pageId, group_name, section_type, icon, title, content, stat_value, stat_unit, stat_label, stat_caption, order_no, is_active]
  );
  return result.insertId;
};

const updateSection = async (sectionId, data) => {
  const { icon, title, content, stat_value, stat_unit, stat_label, stat_caption, order_no, is_active } = data;
  const [result] = await pool.query(
    `UPDATE policy_sections SET icon = ?, title = ?, content = ?, stat_value = ?, stat_unit = ?, stat_label = ?, stat_caption = ?, order_no = ?, is_active = ? WHERE section_id = ?`,
    [icon, title, content, stat_value, stat_unit, stat_label, stat_caption, order_no, is_active, sectionId]
  );
  return result.affectedRows > 0;
};

const deleteSection = async (sectionId) => {
  const [result] = await pool.query(
    `UPDATE policy_sections SET deleted_at = NOW(), is_active = 0 WHERE section_id = ?`,
    [sectionId]
  );
  return result.affectedRows > 0;
};

const restoreSection = async (sectionId) => {
  const [result] = await pool.query(
    `UPDATE policy_sections SET deleted_at = NULL, is_active = 1 WHERE section_id = ?`,
    [sectionId]
  );
  return result.affectedRows > 0;
};

const reorderSections = async (pageId, groupName, orderedIds) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (let i = 0; i < orderedIds.length; i++) {
      await connection.query(
        'UPDATE policy_sections SET order_no = ? WHERE section_id = ? AND page_id = ? AND group_name = ?',
        [i + 1, orderedIds[i], pageId, groupName]
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
  getAllPages,
  getPageByKey,
  createPage,
  updatePage,
  getSections,
  createSection,
  updateSection,
  deleteSection,
  restoreSection,
  reorderSections
};
