const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const getBlogs = async ({ search = '', sort = 'order_no', order = 'ASC', page = 1, limit = 10, status = '' }) => {
  let baseQuery = 'SELECT * FROM blogs WHERE deleted_at IS NULL';
  const queryParams = [];

  if (search) {
    baseQuery += ' AND (blog_title LIKE ? OR short_description LIKE ?)';
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  if (status !== '' && status !== undefined) {
    baseQuery += ' AND is_active = ?';
    queryParams.push(status === 'true' || status === '1' || status === 1 ? 1 : 0);
  }

  return await paginate(baseQuery, queryParams, page, limit, sort, order);
};

const getBlogById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM blogs WHERE blog_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const createBlog = async (data) => {
  const { order_no = 0, published_date = null, blog_title, blog_image = '', short_description = '', blog_content = '', is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO blogs (order_no, published_date, blog_title, blog_image, short_description, blog_content, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [order_no, published_date || null, blog_title, blog_image, short_description, blog_content, is_active]
  );
  return result.insertId;
};

const updateBlog = async (id, data) => {
  const { order_no, published_date, blog_title, blog_image, short_description, blog_content, is_active } = data;
  let query = 'UPDATE blogs SET order_no = ?, published_date = ?, blog_title = ?, short_description = ?, blog_content = ?, is_active = ?';
  const params = [order_no ?? 0, published_date || null, blog_title, short_description || '', blog_content || '', is_active ?? 1];

  if (blog_image !== undefined && blog_image !== null) {
    query += ', blog_image = ?';
    params.push(blog_image);
  }

  query += ' WHERE blog_id = ?';
  params.push(id);

  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
};

const deleteBlog = async (id) => {
  const [result] = await pool.query('UPDATE blogs SET is_active = FALSE, deleted_at = NOW() WHERE blog_id = ? AND deleted_at IS NULL', [id]);
  return result.affectedRows > 0;
};

module.exports = {
  getBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog
};
