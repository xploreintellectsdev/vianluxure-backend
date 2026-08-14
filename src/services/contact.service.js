const { pool } = require('../config/db');

// --- HERO ---

const getHero = async () => {
  const [rows] = await pool.query('SELECT * FROM contact_hero WHERE deleted_at IS NULL ORDER BY hero_id DESC LIMIT 1');
  return rows.length ? rows[0] : null;
};

const upsertHero = async (data) => {
  const existingHero = await getHero();
  
  if (existingHero) {
    const { title, eyebrow_label, form_title, description, image, is_active } = data;
    const updates = [];
    const values = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (eyebrow_label !== undefined) { updates.push('eyebrow_label = ?'); values.push(eyebrow_label); }
    if (form_title !== undefined) { updates.push('form_title = ?'); values.push(form_title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (image !== undefined) { updates.push('image = ?'); values.push(image); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }

    if (updates.length > 0) {
      const query = `UPDATE contact_hero SET ${updates.join(', ')} WHERE hero_id = ?`;
      values.push(existingHero.hero_id);
      await pool.query(query, values);
    }
    
    const [updated] = await pool.query('SELECT * FROM contact_hero WHERE hero_id = ?', [existingHero.hero_id]);
    return updated[0];
  } else {
    const query = `INSERT INTO contact_hero (eyebrow_label, title, form_title, description, image, is_active) VALUES (?, ?, ?, ?, ?, ?)`;
    const [result] = await pool.query(query, [
      data.eyebrow_label || null,
      data.title || null,
      data.form_title || null,
      data.description || null,
      data.image || null,
      data.is_active !== undefined ? data.is_active : 1
    ]);
    const [newHero] = await pool.query('SELECT * FROM contact_hero WHERE hero_id = ?', [result.insertId]);
    return newHero[0];
  }
};


// --- INFO ITEMS & MAP ---

const getInfoItems = async (activeOnly = false) => {
  let query = 'SELECT * FROM contact_info_items WHERE deleted_at IS NULL';
  if (activeOnly) {
    query += ' AND is_active = 1';
  }
  query += ' ORDER BY order_no ASC, item_id ASC';
  const [rows] = await pool.query(query);
  return rows;
};

const getInfoItemById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM contact_info_items WHERE item_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const createInfoItem = async (data) => {
  const query = `INSERT INTO contact_info_items (item_type, icon_key, label, value, link_url, order_no, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const [result] = await pool.query(query, [
    data.item_type || 'card',
    data.icon_key || null,
    data.label || null,
    data.value || null,
    data.link_url || null,
    data.order_no || 0,
    data.is_active !== undefined ? data.is_active : 1
  ]);
  return getInfoItemById(result.insertId);
};

const updateInfoItem = async (id, data) => {
  const updates = [];
  const values = [];

  if (data.item_type !== undefined) { updates.push('item_type = ?'); values.push(data.item_type); }
  if (data.icon_key !== undefined) { updates.push('icon_key = ?'); values.push(data.icon_key); }
  if (data.label !== undefined) { updates.push('label = ?'); values.push(data.label); }
  if (data.value !== undefined) { updates.push('value = ?'); values.push(data.value); }
  if (data.link_url !== undefined) { updates.push('link_url = ?'); values.push(data.link_url); }
  if (data.order_no !== undefined) { updates.push('order_no = ?'); values.push(data.order_no); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active); }

  if (updates.length > 0) {
    const query = `UPDATE contact_info_items SET ${updates.join(', ')} WHERE item_id = ? AND deleted_at IS NULL`;
    values.push(id);
    await pool.query(query, values);
  }
  return getInfoItemById(id);
};

const deleteInfoItem = async (id) => {
  await pool.query('UPDATE contact_info_items SET deleted_at = CURRENT_TIMESTAMP WHERE item_id = ?', [id]);
  return { success: true };
};

const reorderInfoItems = async (items) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const item of items) {
      await connection.query('UPDATE contact_info_items SET order_no = ? WHERE item_id = ? AND deleted_at IS NULL', [item.order_no, item.id]);
    }
    await connection.commit();
    return { success: true };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};


// --- SUBMISSIONS ---

const getSubmissions = async ({ search = '', page = 1, limit = 20, status = '' }) => {
  const offset = (page - 1) * limit;
  let queryStr = 'FROM contact_submissions WHERE deleted_at IS NULL';
  const queryParams = [];

  if (status === 'unread') {
    queryStr += ' AND is_read = 0';
  } else if (status === 'read') {
    queryStr += ' AND is_read = 1';
  }

  if (search) {
    queryStr += ' AND (full_name LIKE ? OR email LIKE ? OR whatsapp_number LIKE ?)';
    const searchStr = `%${search}%`;
    queryParams.push(searchStr, searchStr, searchStr);
  }

  const [countRows] = await pool.query(`SELECT COUNT(*) as total ${queryStr}`, queryParams);
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT * ${queryStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, parseInt(limit), parseInt(offset)]
  );

  return {
    data: rows,
    meta: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total
    }
  };
};

const createSubmission = async (data) => {
  const query = `INSERT INTO contact_submissions (full_name, whatsapp_number, email, message) VALUES (?, ?, ?, ?)`;
  const [result] = await pool.query(query, [
    data.full_name || '',
    data.whatsapp_number || null,
    data.email || null,
    data.message || null
  ]);
  const [rows] = await pool.query('SELECT * FROM contact_submissions WHERE submission_id = ?', [result.insertId]);
  return rows[0];
};

const markSubmissionRead = async (id) => {
  await pool.query('UPDATE contact_submissions SET is_read = 1 WHERE submission_id = ? AND deleted_at IS NULL', [id]);
  const [rows] = await pool.query('SELECT * FROM contact_submissions WHERE submission_id = ?', [id]);
  return rows[0];
};

const deleteSubmission = async (id) => {
  await pool.query('UPDATE contact_submissions SET deleted_at = CURRENT_TIMESTAMP WHERE submission_id = ?', [id]);
  return { success: true };
};


module.exports = {
  // Hero
  getHero,
  upsertHero,
  // Info Items
  getInfoItems,
  getInfoItemById,
  createInfoItem,
  updateInfoItem,
  deleteInfoItem,
  reorderInfoItems,
  // Submissions
  getSubmissions,
  createSubmission,
  markSubmissionRead,
  deleteSubmission
};
