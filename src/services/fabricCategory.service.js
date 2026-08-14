const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const createFabricCategory = async (name, slug, image = null) => {
  const query = `INSERT INTO fabric_categories (fc_name, fc_slug, fc_image) VALUES (?, ?, ?)`;
  const [result] = await pool.query(query, [name, slug, image]);
  return result.insertId;
};

const getAllFabricCategories = async (search, page, limit, sortBy, sortOrder, onlyWithProducts = false) => {
  let baseQuery = `SELECT * FROM fabric_categories WHERE is_active = TRUE AND deleted_at IS NULL`;
  let queryParams = [];

  if (search) {
    baseQuery += ` AND (fc_name LIKE ? OR fc_slug LIKE ?)`;
    const searchTerm = `%${search}%`;
    queryParams.push(searchTerm, searchTerm);
  }

  // ── FIX: when onlyWithProducts is true (used by storefront), only return
  // categories that have at least one active, non-deleted product linked
  // to them in fabric_master. Admin panel calls without this flag, so it
  // still sees every category (including empty ones) for management.
  if (onlyWithProducts) {
    baseQuery += ` AND EXISTS (
      SELECT 1 FROM fabric_master fm
      WHERE fm.fc_id = fabric_categories.fc_id
        AND fm.is_active = TRUE
        AND fm.deleted_at IS NULL
    )`;
  }

  return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};

// ── FIX: COALESCE(?, fc_image) — if uploadedImage is null (no new file AND
// no existing path string was sent), keep whatever image is already in the DB
// instead of overwriting it with NULL.
const updateFabricCategory = async (id, name, slug, image = null) => {
  const query = `UPDATE fabric_categories SET fc_name = ?, fc_slug = ?, fc_image = COALESCE(?, fc_image) WHERE fc_id = ? AND deleted_at IS NULL`;
  const [result] = await pool.query(query, [name, slug, image, id]);
  return result.affectedRows;
};

const deleteFabricCategory = async (id) => {
  const query = `UPDATE fabric_categories SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE fc_id = ?`;
  const [result] = await pool.query(query, [id]);
  return result.affectedRows;
};

const checkSlugExists = async (slug, excludeId = null) => {
  let query = `SELECT fc_id FROM fabric_categories WHERE fc_slug = ?`;
  let params = [slug];
  if (excludeId) {
    query += ` AND fc_id != ?`;
    params.push(excludeId);
  }
  const [rows] = await pool.query(query, params);
  return rows.length > 0;
};

const findByCategorySlug = async (slug) => {
  const [rows] = await pool.query(`
    SELECT f.fab_id, f.fab_name, f.fab_slug, f.fab_price_per_meter, f.fab_cover_image, fc.fc_name
    FROM fabric_master f
    JOIN fabric_categories fc ON f.fc_id = fc.fc_id
    WHERE fc.fc_slug = ? AND f.is_active = TRUE AND f.deleted_at IS NULL
    ORDER BY f.fab_id DESC
  `, [slug]);
  return rows;
};

module.exports = {
  createFabricCategory,
  getAllFabricCategories,
  updateFabricCategory,
  deleteFabricCategory,
  checkSlugExists,
  findByCategorySlug
};