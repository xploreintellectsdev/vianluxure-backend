const { pool } = require("../config/db");

const CustomStyleCategoryService = {
  async getAll() {
    const [rows] = await pool.query(
      "SELECT id, name, slug, is_active FROM custom_style_categories ORDER BY created_at ASC"
    );
    return rows;
  },

  async getActive() {
    const [rows] = await pool.query(
      "SELECT id, name, slug FROM custom_style_categories WHERE is_active = 1 ORDER BY created_at ASC"
    );
    return rows;
  },

  async create({ name, slug }) {
    const query = "INSERT INTO custom_style_categories (name, slug) VALUES (?, ?)";
    const [result] = await pool.execute(query, [name, slug]);
    return result.insertId;
  },

  async update(id, { name, slug, is_active }) {
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push("name = ?");
      values.push(name);
    }
    if (slug !== undefined) {
      fields.push("slug = ?");
      values.push(slug);
    }
    if (is_active !== undefined) {
      fields.push("is_active = ?");
      values.push(is_active ? 1 : 0);
    }

    if (fields.length === 0) return false;

    const query = `UPDATE custom_style_categories SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);

    const [result] = await pool.execute(query, values);
    return result.affectedRows > 0;
  },

  async delete(id) {
    const [result] = await pool.execute("DELETE FROM custom_style_categories WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },
  
  async getBySlug(slug) {
    const [rows] = await pool.query("SELECT * FROM custom_style_categories WHERE slug = ?", [slug]);
    return rows[0] || null;
  }
};

module.exports = CustomStyleCategoryService;
