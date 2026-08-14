// src/services/review.service.js
//
// ADJUST IF NEEDED: this assumes src/config/db.js exports a mysql2/promise
// pool as `pool` (e.g. module.exports = { pool, testConnection }). If your
// pool is exported under a different name, change the import on the next
// line only — nothing else in this file needs to change.
const { pool } = require("../config/db");

const ReviewService = {
  /**
   * Insert a new review for a fabric.
   */
  async create({
    fab_id,
    customer_name,
    customer_email,
    rating,
    review_title,
    review_text,
    review_image_url,
  }) {
    const [result] = await pool.execute(
      `INSERT INTO fabric_reviews
        (fab_id, customer_name, customer_email, rating, review_title, review_text, review_image_url, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        fab_id,
        customer_name,
        customer_email,
        rating,
        review_title || null,
        review_text,
        review_image_url || null,
      ]
    );
    return result.insertId;
  },

  /**
   * Fetch a single review by id (used to return the created row).
   */
  async findById(rev_id) {
    const [rows] = await pool.execute(
      `SELECT * FROM fabric_reviews WHERE rev_id = ? AND deleted_at IS NULL LIMIT 1`,
      [rev_id]
    );
    return rows[0] || null;
  },

  /**
   * Fetch all approved, non-deleted reviews for a fabric, newest first.
   */
  async findByFabricId(fab_id) {
    const [rows] = await pool.execute(
      `SELECT rev_id, fab_id, customer_name, rating, review_title, review_text,
              review_image_url, created_at, updated_at
       FROM fabric_reviews
       WHERE fab_id = ? AND is_approved = 1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [fab_id]
    );
    return rows;
  },

  /**
   * Rating summary (count per star + average) for a fabric, computed in SQL.
   */
  async getRatingSummary(fab_id) {
    const [rows] = await pool.execute(
      `SELECT rating, COUNT(*) AS count
       FROM fabric_reviews
       WHERE fab_id = ? AND is_approved = 1 AND deleted_at IS NULL
       GROUP BY rating`,
      [fab_id]
    );

    const summary = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let total = 0;
    let sum = 0;
    rows.forEach((r) => {
      summary[r.rating] = r.count;
      total += r.count;
      sum += r.rating * r.count;
    });

    return {
      counts: summary,
      total,
      average: total ? Number((sum / total).toFixed(2)) : 0,
    };
  },

  /**
   * Soft delete a review by id.
   */
  async softDelete(rev_id) {
    const [result] = await pool.execute(
      `UPDATE fabric_reviews SET deleted_at = NOW() WHERE rev_id = ? AND deleted_at IS NULL`,
      [rev_id]
    );
    return result.affectedRows > 0;
  },

  /**
   * Fetch all reviews for admin (includes unapproved ones), joined with fabric_master.
   */
  async getAllForAdmin({ search, limit, offset, fab_id }) {
    let whereClause = "r.deleted_at IS NULL";
    const queryParams = [];

    if (fab_id) {
      whereClause += " AND r.fab_id = ?";
      queryParams.push(Number(fab_id));
    }

    if (search) {
      whereClause += ` AND (r.customer_name LIKE ? OR r.customer_email LIKE ? OR fm.fab_name LIKE ? OR r.review_title LIKE ?)`;
      const searchWildcard = `%${search}%`;
      queryParams.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM fabric_reviews r
      LEFT JOIN fabric_master fm ON fm.fab_id = r.fab_id
      WHERE ${whereClause}
    `;
    const [countRows] = await pool.execute(countQuery, queryParams);
    const total = countRows[0].total;

    const dataQuery = `
      SELECT r.rev_id, r.fab_id, r.customer_name, r.customer_email, r.rating, 
             r.review_title, r.review_text, r.review_image_url, r.is_approved, r.created_at,
             fm.fab_name
      FROM fabric_reviews r
      LEFT JOIN fabric_master fm ON fm.fab_id = r.fab_id
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    queryParams.push(String(limit), String(offset));
    
    // We use pool.query here because pool.execute with LIMIT/OFFSET strings can sometimes cause issues in older mysql2 depending on strict mode, 
    // but we can parse limit/offset as numbers and use pool.execute or pool.query.
    const [rows] = await pool.query(dataQuery, [...queryParams.slice(0, -2), Number(limit), Number(offset)]);

    return { rows, total };
  },

  /**
   * Update a review's content or approval status.
   */
  async update(rev_id, data) {
    const fields = [];
    const values = [];

    if (data.is_approved !== undefined) {
      fields.push("is_approved = ?");
      values.push(data.is_approved ? 1 : 0);
    }
    if (data.rating !== undefined) {
      fields.push("rating = ?");
      values.push(data.rating);
    }
    if (data.review_title !== undefined) {
      fields.push("review_title = ?");
      values.push(data.review_title || null);
    }
    if (data.review_text !== undefined) {
      fields.push("review_text = ?");
      values.push(data.review_text);
    }
    if (data.review_image_url !== undefined) {
      fields.push("review_image_url = ?");
      values.push(data.review_image_url);
    }

    if (fields.length === 0) return false;

    const query = `UPDATE fabric_reviews SET ${fields.join(", ")} WHERE rev_id = ? AND deleted_at IS NULL`;
    values.push(rev_id);

    const [result] = await pool.execute(query, values);
    return result.affectedRows > 0;
  }
};

module.exports = ReviewService;