const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

// --- Hero Slides ---

const getSlides = async ({ search = '', sort = 'order_no', order = 'ASC', page = 1, limit = 10, status = '' }) => {
  let baseQuery = 'SELECT * FROM home_hero_slides WHERE deleted_at IS NULL';
  const queryParams = [];

  if (search) {
    baseQuery += ' AND (title LIKE ? OR description LIKE ?)';
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  if (status !== '' && status !== undefined) {
    baseQuery += ' AND is_active = ?';
    queryParams.push(status === 'true' || status === '1' || status === 1 ? 1 : 0);
  }

  return await paginate(baseQuery, queryParams, page, limit, sort, order);
};

const getSlideById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM home_hero_slides WHERE slide_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const createSlide = async (data) => {
  const { order_no = 0, title, description = '', image = '', button_text = '', button_link = '', is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO home_hero_slides (order_no, title, description, image, button_text, button_link, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [order_no, title, description, image, button_text, button_link, is_active]
  );
  return result.insertId;
};

const updateSlide = async (id, data) => {
  const updates = [];
  const params = [];
  if (data.order_no !== undefined) { updates.push('order_no = ?'); params.push(data.order_no); }
  if (data.title !== undefined) { updates.push('title = ?'); params.push(data.title); }
  if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
  if (data.button_text !== undefined) { updates.push('button_text = ?'); params.push(data.button_text); }
  if (data.button_link !== undefined) { updates.push('button_link = ?'); params.push(data.button_link); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); params.push(data.is_active); }
  if (data.image !== undefined && data.image !== null) { updates.push('image = ?'); params.push(data.image); }
  
  if (updates.length === 0) return true;
  
  const query = `UPDATE home_hero_slides SET ${updates.join(', ')} WHERE slide_id = ? AND deleted_at IS NULL`;
  params.push(id);
  
  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
};

const deleteSlide = async (id) => {
  const [result] = await pool.query('UPDATE home_hero_slides SET is_active = FALSE, deleted_at = NOW() WHERE slide_id = ? AND deleted_at IS NULL', [id]);
  return result.affectedRows > 0;
};

// --- Hero Marquee Items ---

const getMarqueeItems = async ({ search = '', sort = 'order_no', order = 'ASC', page = 1, limit = 50, status = '' }) => {
  let baseQuery = 'SELECT * FROM home_marquee_items WHERE deleted_at IS NULL';
  const queryParams = [];

  if (search) {
    baseQuery += ' AND item_text LIKE ?';
    queryParams.push(`%${search}%`);
  }

  if (status !== '' && status !== undefined) {
    baseQuery += ' AND is_active = ?';
    queryParams.push(status === 'true' || status === '1' || status === 1 ? 1 : 0);
  }

  return await paginate(baseQuery, queryParams, page, limit, sort, order);
};

const getMarqueeItemById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM home_marquee_items WHERE item_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const createMarqueeItem = async (data) => {
  const { order_no = 0, item_text, is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO home_marquee_items (order_no, item_text, is_active) VALUES (?, ?, ?)`,
    [order_no, item_text, is_active]
  );
  return result.insertId;
};

const updateMarqueeItem = async (id, data) => {
  const updates = [];
  const params = [];
  if (data.order_no !== undefined) { updates.push('order_no = ?'); params.push(data.order_no); }
  if (data.item_text !== undefined) { updates.push('item_text = ?'); params.push(data.item_text); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); params.push(data.is_active); }

  if (updates.length === 0) return true;

  const query = `UPDATE home_marquee_items SET ${updates.join(', ')} WHERE item_id = ? AND deleted_at IS NULL`;
  params.push(id);

  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
};

const deleteMarqueeItem = async (id) => {
  const [result] = await pool.query('UPDATE home_marquee_items SET is_active = FALSE, deleted_at = NOW() WHERE item_id = ? AND deleted_at IS NULL', [id]);
  return result.affectedRows > 0;
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
