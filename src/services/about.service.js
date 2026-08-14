const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

// --- About Sections ---

const getSections = async ({ search = '', sort = 'order_no', order = 'ASC', page = 1, limit = 10, status = '' }) => {
  let baseQuery = 'SELECT * FROM about_page_sections WHERE deleted_at IS NULL';
  const queryParams = [];

  if (search) {
    baseQuery += ' AND (title LIKE ? OR eyebrow_label LIKE ? OR section_key LIKE ?)';
    queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status !== '' && status !== undefined) {
    baseQuery += ' AND is_active = ?';
    queryParams.push(status === 'true' || status === '1' || status === 1 ? 1 : 0);
  }

  return await paginate(baseQuery, queryParams, page, limit, sort, order);
};

const getSectionById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM about_page_sections WHERE section_id = ? AND deleted_at IS NULL', [id]);
  const section = rows[0];
  if (section) {
    section.items = await getItemsBySectionId(id);
  }
  return section;
};

const getSectionByKey = async (key) => {
  const [rows] = await pool.query('SELECT * FROM about_page_sections WHERE section_key = ? AND deleted_at IS NULL', [key]);
  return rows[0];
};

const createSection = async (data) => {
  const { section_key, section_type, order_no = 0, eyebrow_label = '', title = '', description = '', image = '', button_text = '', button_link = '', is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO about_page_sections (section_key, section_type, order_no, eyebrow_label, title, description, image, button_text, button_link, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [section_key, section_type, order_no, eyebrow_label, title, description, image, button_text, button_link, is_active]
  );
  return result.insertId;
};

const updateSection = async (id, data) => {
  const { section_key, section_type, order_no, eyebrow_label, title, description, image, button_text, button_link, is_active } = data;
  
  let query = 'UPDATE about_page_sections SET section_key = ?, section_type = ?, order_no = ?, eyebrow_label = ?, title = ?, description = ?, button_text = ?, button_link = ?, is_active = ?';
  const params = [section_key, section_type, order_no ?? 0, eyebrow_label || '', title || '', description || '', button_text || '', button_link || '', is_active ?? 1];

  if (image !== undefined && image !== null) {
    query += ', image = ?';
    params.push(image);
  }

  query += ' WHERE section_id = ?';
  params.push(id);

  await pool.query(query, params);
};

const deleteSection = async (id) => {
  await pool.query('UPDATE about_page_sections SET deleted_at = CURRENT_TIMESTAMP WHERE section_id = ?', [id]);
};

// --- About Section Items ---

const getItemsBySectionId = async (sectionId, activeOnly = false) => {
  let query = 'SELECT * FROM about_section_items WHERE section_id = ? AND deleted_at IS NULL';
  const params = [sectionId];
  if (activeOnly) {
    query += ' AND is_active = 1';
  }
  query += ' ORDER BY order_no ASC';
  const [rows] = await pool.query(query, params);
  return rows;
};

const getItemById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM about_section_items WHERE item_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const createItem = async (sectionId, data) => {
  const { order_no = 0, item_title = '', item_text = '', item_image = '', is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO about_section_items (section_id, order_no, item_title, item_text, item_image, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sectionId, order_no, item_title, item_text, item_image, is_active]
  );
  return result.insertId;
};

const updateItem = async (id, data) => {
  const { order_no, item_title, item_text, item_image, is_active } = data;
  let query = 'UPDATE about_section_items SET order_no = ?, item_title = ?, item_text = ?, is_active = ?';
  const params = [order_no ?? 0, item_title || '', item_text || '', is_active ?? 1];

  if (item_image !== undefined && item_image !== null) {
    query += ', item_image = ?';
    params.push(item_image);
  }

  query += ' WHERE item_id = ?';
  params.push(id);

  await pool.query(query, params);
};

const deleteItem = async (id) => {
  await pool.query('UPDATE about_section_items SET deleted_at = CURRENT_TIMESTAMP WHERE item_id = ?', [id]);
};

const reorderItems = async (sectionId, itemOrders) => {
  // itemOrders is an array of { item_id, order_no }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const { item_id, order_no } of itemOrders) {
      await connection.query(
        'UPDATE about_section_items SET order_no = ? WHERE item_id = ? AND section_id = ? AND deleted_at IS NULL',
        [order_no, item_id, sectionId]
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

const bulkCreateItems = async (sectionId, files) => {
  if (!files || files.length === 0) return 0;
  
  // Get current max order_no
  const [maxRows] = await pool.query('SELECT MAX(order_no) as maxOrder FROM about_section_items WHERE section_id = ? AND deleted_at IS NULL', [sectionId]);
  let currentOrder = (maxRows[0].maxOrder || 0) + 10;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const file of files) {
      await connection.query(
        `INSERT INTO about_section_items (section_id, order_no, item_image, is_active) VALUES (?, ?, ?, ?)`,
        [sectionId, currentOrder, file.filename, 1]
      );
      currentOrder += 10;
    }
    await connection.commit();
    return files.length;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// --- Aggregate View ---

const getAllSectionsWithItems = async (activeOnly = false) => {
  let query = 'SELECT * FROM about_page_sections WHERE deleted_at IS NULL';
  if (activeOnly) {
    query += ' AND is_active = 1';
  }
  query += ' ORDER BY order_no ASC';
  
  const [sections] = await pool.query(query);
  
  for (const section of sections) {
    section.items = await getItemsBySectionId(section.section_id, activeOnly);
  }
  
  return sections;
};

module.exports = {
  getSections,
  getSectionById,
  getSectionByKey,
  createSection,
  updateSection,
  deleteSection,
  
  getItemsBySectionId,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  bulkCreateItems,
  
  getAllSectionsWithItems
};
