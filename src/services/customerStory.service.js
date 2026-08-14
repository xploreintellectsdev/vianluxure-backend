const { pool } = require('../config/db');

// --- Customer Story Sections ---

const getSectionByPageKey = async (pageKey, activeOnly = false, viewMode = 'active') => {
  let query = 'SELECT * FROM customer_story_sections WHERE page_key = ? AND deleted_at IS NULL';
  const params = [pageKey];
  
  if (activeOnly) {
    query += ' AND is_active = 1';
  }
  
  const [rows] = await pool.query(query, params);
  const section = rows[0];
  
  if (section) {
    section.stories = await getStoriesBySectionId(section.story_section_id, activeOnly, viewMode);
  }
  
  return section;
};

const upsertSection = async (pageKey, data) => {
  const { title = 'Customer Stories', image = null, is_active = 1 } = data;
  
  const [existing] = await pool.query(
    'SELECT story_section_id FROM customer_story_sections WHERE page_key = ? AND deleted_at IS NULL',
    [pageKey]
  );
  
  if (existing.length > 0) {
    const sectionId = existing[0].story_section_id;
    // Update
    let updateQuery = 'UPDATE customer_story_sections SET title = ?, is_active = ?';
    const params = [title, is_active];
    
    if (image !== undefined) {
      updateQuery += ', image = ?';
      params.push(image);
    }
    
    updateQuery += ' WHERE story_section_id = ?';
    params.push(sectionId);
    
    await pool.query(updateQuery, params);
    return sectionId;
  } else {
    // Insert
    const [result] = await pool.query(
      `INSERT INTO customer_story_sections (page_key, title, image, is_active)
       VALUES (?, ?, ?, ?)`,
      [pageKey, title, image !== undefined ? image : null, is_active]
    );
    return result.insertId;
  }
};

const getSectionById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM customer_story_sections WHERE story_section_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

// --- Customer Stories ---

const getStoriesBySectionId = async (sectionId, activeOnly = false, viewMode = 'active') => {
  let query = 'SELECT * FROM customer_stories WHERE story_section_id = ?';
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

const getStoryById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM customer_stories WHERE story_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const createStory = async (sectionId, data) => {
  const { 
    order_no = 0, 
    customer_name = '', 
    story_date = null, 
    rating = 5, 
    story_text = '', 
    is_active = 1 
  } = data;
  
  const [result] = await pool.query(
    `INSERT INTO customer_stories (story_section_id, order_no, customer_name, story_date, rating, story_text, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sectionId, order_no, customer_name, story_date || null, rating, story_text, is_active]
  );
  return result.insertId;
};

const updateStory = async (id, data) => {
  const updates = [];
  const params = [];
  
  if (data.order_no !== undefined) { updates.push('order_no = ?'); params.push(data.order_no); }
  if (data.customer_name !== undefined) { updates.push('customer_name = ?'); params.push(data.customer_name); }
  if (data.story_date !== undefined) { updates.push('story_date = ?'); params.push(data.story_date || null); }
  if (data.rating !== undefined) { updates.push('rating = ?'); params.push(data.rating); }
  if (data.story_text !== undefined) { updates.push('story_text = ?'); params.push(data.story_text); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); params.push(data.is_active); }
  
  if (updates.length === 0) return true;
  
  const query = `UPDATE customer_stories SET ${updates.join(', ')} WHERE story_id = ? AND deleted_at IS NULL`;
  params.push(id);
  
  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
};

const deleteStory = async (id) => {
  await pool.query('UPDATE customer_stories SET deleted_at = CURRENT_TIMESTAMP WHERE story_id = ?', [id]);
};

const restoreStory = async (id) => {
  await pool.query('UPDATE customer_stories SET deleted_at = NULL WHERE story_id = ?', [id]);
};

const reorderStories = async (sectionId, storyOrders) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const { story_id, order_no } of storyOrders) {
      await connection.query(
        'UPDATE customer_stories SET order_no = ? WHERE story_id = ? AND story_section_id = ? AND deleted_at IS NULL',
        [order_no, story_id, sectionId]
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
  getSectionByPageKey,
  upsertSection,
  getSectionById,
  
  getStoriesBySectionId,
  getStoryById,
  createStory,
  updateStory,
  deleteStory,
  restoreStory,
  reorderStories
};
