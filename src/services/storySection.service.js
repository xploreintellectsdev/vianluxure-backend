const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

// --- Story Sections ---

const getSections = async ({ search = '', sort = 'order_no', order = 'ASC', page = 1, limit = 10, status = '' }) => {
  let baseQuery = 'SELECT * FROM home_story_sections WHERE deleted_at IS NULL';
  const queryParams = [];

  if (search) {
    baseQuery += ' AND (title LIKE ? OR eyebrow_label LIKE ?)';
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  if (status !== '' && status !== undefined) {
    baseQuery += ' AND is_active = ?';
    queryParams.push(status === 'true' || status === '1' || status === 1 ? 1 : 0);
  }

  return await paginate(baseQuery, queryParams, page, limit, sort, order);
};

const getSectionById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM home_story_sections WHERE section_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const createSection = async (data) => {
  const { section_key, order_no = 0, eyebrow_label = '', title, description = '', is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO home_story_sections (section_key, order_no, eyebrow_label, title, description, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [section_key, order_no, eyebrow_label, title, description, is_active]
  );
  return result.insertId;
};

const updateSection = async (id, data) => {
  const { section_key, order_no, eyebrow_label, title, description, is_active } = data;
  await pool.query(
    `UPDATE home_story_sections 
     SET section_key = ?, order_no = ?, eyebrow_label = ?, title = ?, description = ?, is_active = ?
     WHERE section_id = ?`,
    [section_key, order_no ?? 0, eyebrow_label || '', title, description || '', is_active ?? 1, id]
  );
};

const deleteSection = async (id) => {
  await pool.query('UPDATE home_story_sections SET deleted_at = CURRENT_TIMESTAMP WHERE section_id = ?', [id]);
};

// --- Story Cards ---

const getCardsBySectionId = async (sectionId, activeOnly = false) => {
  let query = 'SELECT * FROM home_story_cards WHERE section_id = ? AND deleted_at IS NULL';
  const params = [sectionId];
  if (activeOnly) {
    query += ' AND is_active = 1';
  }
  query += ' ORDER BY order_no ASC';
  const [rows] = await pool.query(query, params);
  return rows;
};

const getCardById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM home_story_cards WHERE card_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const createCard = async (sectionId, data) => {
  const { order_no = 0, image = '', caption = '', card_title, card_description = '', is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO home_story_cards (section_id, order_no, image, caption, card_title, card_description, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sectionId, order_no, image, caption, card_title, card_description, is_active]
  );
  return result.insertId;
};

const updateCard = async (id, data) => {
  const { order_no, image, caption, card_title, card_description, is_active } = data;
  let query = 'UPDATE home_story_cards SET order_no = ?, caption = ?, card_title = ?, card_description = ?, is_active = ?';
  const params = [order_no ?? 0, caption || '', card_title, card_description || '', is_active ?? 1];

  if (image !== undefined && image !== null) {
    query += ', image = ?';
    params.push(image);
  }

  query += ' WHERE card_id = ?';
  params.push(id);

  await pool.query(query, params);
};

const deleteCard = async (id) => {
  await pool.query('UPDATE home_story_cards SET deleted_at = CURRENT_TIMESTAMP WHERE card_id = ?', [id]);
};

const reorderCards = async (sectionId, cardOrders) => {
  // cardOrders is an array of { card_id, order_no }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const { card_id, order_no } of cardOrders) {
      await connection.query(
        'UPDATE home_story_cards SET order_no = ? WHERE card_id = ? AND section_id = ? AND deleted_at IS NULL',
        [order_no, card_id, sectionId]
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

// --- Aggregate View ---

const getAllSectionsWithCards = async (activeOnly = false) => {
  let query = 'SELECT * FROM home_story_sections WHERE deleted_at IS NULL';
  if (activeOnly) {
    query += ' AND is_active = 1';
  }
  query += ' ORDER BY order_no ASC';
  
  const [sections] = await pool.query(query);
  
  for (const section of sections) {
    section.cards = await getCardsBySectionId(section.section_id, activeOnly);
  }
  
  return sections;
};

module.exports = {
  getSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  
  getCardsBySectionId,
  getCardById,
  createCard,
  updateCard,
  deleteCard,
  reorderCards,
  
  getAllSectionsWithCards
};
