const { pool } = require('../config/db');

// --- Section ---

const getSection = async () => {
  const [rows] = await pool.query('SELECT * FROM art_of_perfect_fit_section LIMIT 1');
  return rows[0] || { title: 'The Art of the Perfect Fit', is_active: 1 };
};

const updateSection = async (title, is_active) => {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM art_of_perfect_fit_section');
  if (rows[0].count === 0) {
    await pool.query(
      'INSERT INTO art_of_perfect_fit_section (title, is_active) VALUES (?, ?)',
      [title, is_active]
    );
  } else {
    await pool.query(
      'UPDATE art_of_perfect_fit_section SET title = ?, is_active = ?',
      [title, is_active]
    );
  }
};

// --- Steps ---

const getSteps = async () => {
  const [rows] = await pool.query('SELECT * FROM art_of_perfect_fit_steps WHERE deleted_at IS NULL ORDER BY display_order ASC');
  return rows;
};

const getStepById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM art_of_perfect_fit_steps WHERE step_id = ?', [id]);
  return rows[0];
};

const createStep = async (data) => {
  const { title, description, image_url, display_order = 0 } = data;
  const [result] = await pool.query(
    `INSERT INTO art_of_perfect_fit_steps (title, description, image_url, display_order)
     VALUES (?, ?, ?, ?)`,
    [title, description, image_url, display_order]
  );
  return result.insertId;
};

const updateStep = async (id, data) => {
  const { title, description, image_url, display_order } = data;
  
  let query = 'UPDATE art_of_perfect_fit_steps SET title = ?, description = ?, display_order = ?';
  const params = [title, description, display_order ?? 0];

  if (image_url !== undefined && image_url !== null) {
    query += ', image_url = ?';
    params.push(image_url);
  }

  query += ' WHERE step_id = ?';
  params.push(id);

  await pool.query(query, params);
};

const deleteStep = async (id) => {
  await pool.query('UPDATE art_of_perfect_fit_steps SET deleted_at = NOW() WHERE step_id = ?', [id]);
};

const reorderSteps = async (stepOrders) => {
  // stepOrders is an array of { step_id, display_order }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const { step_id, display_order } of stepOrders) {
      await connection.query(
        'UPDATE art_of_perfect_fit_steps SET display_order = ? WHERE step_id = ?',
        [display_order, step_id]
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
  getSection,
  updateSection,
  getSteps,
  getStepById,
  createStep,
  updateStep,
  deleteStep,
  reorderSteps
};
