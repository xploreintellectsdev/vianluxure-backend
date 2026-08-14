const { pool } = require('../config/db');

// --- Page Info Sections ---

const getSectionByPageAndType = async (pageKey, sectionType, activeOnly = false, viewMode = 'active') => {
  let query = 'SELECT * FROM page_info_sections WHERE page_key = ? AND section_type = ? AND deleted_at IS NULL';
  const params = [pageKey, sectionType];
  
  if (activeOnly) {
    query += ' AND is_active = 1';
  }
  
  const [rows] = await pool.query(query, params);
  const section = rows[0];
  
  if (section) {
    section.items = await getItemsBySectionId(section.section_id, activeOnly, viewMode);
  }
  
  return section;
};

const getAllSectionsForPage = async (pageKey, activeOnly = false, viewMode = 'active') => {
  const whatIs = await getSectionByPageAndType(pageKey, 'what_is', activeOnly, viewMode);
  const whyChoose = await getSectionByPageAndType(pageKey, 'why_choose', activeOnly, viewMode);
  return { whatIs, whyChoose };
};

const upsertSection = async (pageKey, sectionType, data) => {
  const { subtitle, title, description, image, is_active = 1 } = data;
  
  const [existing] = await pool.query(
    'SELECT section_id FROM page_info_sections WHERE page_key = ? AND section_type = ? AND deleted_at IS NULL',
    [pageKey, sectionType]
  );
  
  if (existing.length > 0) {
    const sectionId = existing[0].section_id;
    let query = 'UPDATE page_info_sections SET subtitle = ?, title = ?, description = ?, is_active = ?';
    const params = [subtitle || '', title || '', description || '', is_active];
    
    if (image !== undefined && image !== null) {
      query += ', image = ?';
      params.push(image);
    }
    
    query += ' WHERE section_id = ?';
    params.push(sectionId);
    
    await pool.query(query, params);
    return sectionId;
  } else {
    const [result] = await pool.query(
      `INSERT INTO page_info_sections (page_key, section_type, subtitle, title, description, image, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [pageKey, sectionType, subtitle || '', title || '', description || '', image || null, is_active]
    );
    return result.insertId;
  }
};

const getSectionById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM page_info_sections WHERE section_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const getAllSections = async () => {
  const [rows] = await pool.query('SELECT * FROM page_info_sections WHERE deleted_at IS NULL');
  return rows;
};

// --- Page Info Items ---

const getItemsBySectionId = async (sectionId, activeOnly = false, viewMode = 'active') => {
  let query = 'SELECT * FROM page_info_items WHERE section_id = ?';
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

const getItemById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM page_info_items WHERE item_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const createItem = async (sectionId, data) => {
  const { order_no = 0, icon_key = '', item_title, item_description = '', is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO page_info_items (section_id, order_no, icon_key, item_title, item_description, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sectionId, order_no, icon_key, item_title, item_description, is_active]
  );
  return result.insertId;
};

const updateItem = async (id, data) => {
  const updates = [];
  const params = [];
  
  if (data.order_no !== undefined) { updates.push('order_no = ?'); params.push(data.order_no); }
  if (data.icon_key !== undefined) { updates.push('icon_key = ?'); params.push(data.icon_key); }
  if (data.item_title !== undefined) { updates.push('item_title = ?'); params.push(data.item_title); }
  if (data.item_description !== undefined) { updates.push('item_description = ?'); params.push(data.item_description); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); params.push(data.is_active); }
  
  if (updates.length === 0) return true;
  
  const query = `UPDATE page_info_items SET ${updates.join(', ')} WHERE item_id = ? AND deleted_at IS NULL`;
  params.push(id);
  
  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
};

const deleteItem = async (id) => {
  await pool.query('UPDATE page_info_items SET deleted_at = CURRENT_TIMESTAMP WHERE item_id = ?', [id]);
};

const restoreItem = async (id) => {
  await pool.query('UPDATE page_info_items SET deleted_at = NULL WHERE item_id = ?', [id]);
};

const reorderItems = async (sectionId, itemOrders) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const { item_id, order_no } of itemOrders) {
      await connection.query(
        'UPDATE page_info_items SET order_no = ? WHERE item_id = ? AND section_id = ? AND deleted_at IS NULL',
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

module.exports = {
  getSectionByPageAndType,
  getAllSectionsForPage,
  upsertSection,
  getSectionById,
  getAllSections,
  
  getItemsBySectionId,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  restoreItem,
  reorderItems
};
