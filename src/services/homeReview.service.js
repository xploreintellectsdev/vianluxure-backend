const { pool } = require("../config/db");

class HomeReviewService {
  async getSettings() {
    const [rows] = await pool.query("SELECT * FROM home_review_section_settings WHERE setting_id = 1");
    if (rows.length === 0) {
      return { heading: "Your Delight is Our Mission", subheading: "Over 1000+ 5-star reviews", is_visible: 1 };
    }
    return rows[0];
  }

  async upsertSettings(data) {
    const { heading, subheading, is_visible } = data;
    await pool.query(
      `INSERT INTO home_review_section_settings (setting_id, heading, subheading, is_visible)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       heading = VALUES(heading), 
       subheading = VALUES(subheading), 
       is_visible = VALUES(is_visible)`,
      [
        heading || "Your Delight is Our Mission", 
        subheading || "Over 1000+ 5-star reviews", 
        is_visible ?? 1
      ]
    );
    return this.getSettings();
  }

  async getAllReviews(viewMode = 'active') {
    let query = "SELECT * FROM home_customer_reviews WHERE deleted_at IS NULL";
    if (viewMode === 'trash') {
      query = "SELECT * FROM home_customer_reviews WHERE deleted_at IS NOT NULL";
    }
    query += " ORDER BY order_no ASC, review_id DESC";
    const [rows] = await pool.query(query);
    return rows;
  }

  async getPublicData() {
    const settings = await this.getSettings();
    const reviews = await this.getAllReviews('active');
    // Only return active reviews for public
    return {
      settings,
      reviews: reviews.filter(r => r.is_active === 1)
    };
  }

  async createReview(data) {
    const { order_no, customer_image, quote, author_name, author_location, is_active } = data;
    const [result] = await pool.query(
      `INSERT INTO home_customer_reviews 
      (order_no, customer_image, quote, author_name, author_location, is_active) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      [order_no || 0, customer_image, quote, author_name, author_location, is_active ?? 1]
    );
    const [rows] = await pool.query("SELECT * FROM home_customer_reviews WHERE review_id = ?", [result.insertId]);
    return rows[0];
  }

  async bulkCreateReviews(imagePaths) {
    const results = [];
    // Get current max order_no to append to end
    const [maxOrderRows] = await pool.query("SELECT MAX(order_no) as maxOrder FROM home_customer_reviews WHERE deleted_at IS NULL");
    let nextOrderNo = (maxOrderRows[0].maxOrder || 0) + 1;

    for (const imagePath of imagePaths) {
      const [res] = await pool.query(
        `INSERT INTO home_customer_reviews 
        (order_no, customer_image, quote, author_name, author_location, is_active) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [nextOrderNo++, imagePath, "Placeholder quote. Please edit.", "Placeholder Name", "", 1]
      );
      const [rows] = await pool.query("SELECT * FROM home_customer_reviews WHERE review_id = ?", [res.insertId]);
      results.push(rows[0]);
    }
    return results;
  }

  async updateReview(id, data) {
    const fields = [];
    const values = [];
    const allowedFields = ['order_no', 'customer_image', 'quote', 'author_name', 'author_location', 'is_active'];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) return null;

    values.push(id);
    await pool.query(`UPDATE home_customer_reviews SET ${fields.join(', ')} WHERE review_id = ?`, values);
    
    const [rows] = await pool.query("SELECT * FROM home_customer_reviews WHERE review_id = ?", [id]);
    return rows[0];
  }

  async softDeleteReview(id) {
    await pool.query("UPDATE home_customer_reviews SET deleted_at = CURRENT_TIMESTAMP WHERE review_id = ?", [id]);
    return { success: true };
  }

  async restoreReview(id) {
    await pool.query("UPDATE home_customer_reviews SET deleted_at = NULL WHERE review_id = ?", [id]);
    return { success: true };
  }
}

module.exports = new HomeReviewService();
