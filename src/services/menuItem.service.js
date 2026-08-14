const { pool } = require('../config/db');

const getMenuItems = async ({ location, activeOnly = 'false' }) => {
  let query = 'SELECT * FROM site_menu_items WHERE deleted_at IS NULL';
  const params = [];

  if (location) {
    query += ' AND location = ?';
    params.push(location);
  }

  if (activeOnly === 'true' || activeOnly === true) {
    query += ' AND is_active = 1';
  }

  query += ' ORDER BY group_name ASC, order_no ASC, menu_id ASC';

  const [rows] = await pool.query(query, params);
  return rows;
};

const getMenuItemById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM site_menu_items WHERE menu_id = ? AND deleted_at IS NULL', [id]);
  return rows.length ? rows[0] : null;
};

const createMenuItem = async (data) => {
  const { location, group_name, label, link, item_type, icon, order_no, is_active } = data;
  const query = `
    INSERT INTO site_menu_items (location, group_name, label, link, item_type, icon, order_no, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    location,
    group_name || null,
    label,
    link || null,
    item_type || 'link',
    icon || null,
    order_no || 0,
    is_active !== undefined ? is_active : 1
  ];
  
  const [result] = await pool.query(query, params);
  return getMenuItemById(result.insertId);
};

const updateMenuItem = async (id, data) => {
  const { location, group_name, label, link, item_type, icon, order_no, is_active } = data;
  
  let updateQuery = 'UPDATE site_menu_items SET ';
  const updateFields = [];
  const params = [];

  if (location !== undefined) { updateFields.push('location = ?'); params.push(location); }
  if (group_name !== undefined) { updateFields.push('group_name = ?'); params.push(group_name || null); }
  if (label !== undefined) { updateFields.push('label = ?'); params.push(label); }
  if (link !== undefined) { updateFields.push('link = ?'); params.push(link || null); }
  if (item_type !== undefined) { updateFields.push('item_type = ?'); params.push(item_type); }
  if (icon !== undefined) { updateFields.push('icon = ?'); params.push(icon || null); }
  if (order_no !== undefined) { updateFields.push('order_no = ?'); params.push(order_no); }
  if (is_active !== undefined) { updateFields.push('is_active = ?'); params.push(is_active); }

  if (updateFields.length === 0) return getMenuItemById(id);

  updateQuery += updateFields.join(', ') + ' WHERE menu_id = ?';
  params.push(id);

  await pool.query(updateQuery, params);
  return getMenuItemById(id);
};

const deleteMenuItem = async (id) => {
  const [result] = await pool.query('DELETE FROM site_menu_items WHERE menu_id = ?', [id]);
  return result.affectedRows > 0;
};

module.exports = {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
};
