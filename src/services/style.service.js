const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const createStyle = async (name, slug) => {
    const query = `INSERT INTO styles (sty_name, sty_slug) VALUES (?, ?)`;
    const [result] = await pool.query(query, [name, slug]);
    return result.insertId;
};

const getAllStyles = async (search, page, limit, sortBy, sortOrder) => {
    let baseQuery = `SELECT * FROM styles WHERE is_active = TRUE AND deleted_at IS NULL`;
    let queryParams = [];

    if (search) {
        baseQuery += ` AND (sty_name LIKE ? OR sty_slug LIKE ?)`;
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
    }

    return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};

const updateStyle = async (id, name, slug) => {
    const query = `UPDATE styles SET sty_name = ?, sty_slug = ? WHERE sty_id = ? AND deleted_at IS NULL`;
    const [result] = await pool.query(query, [name, slug, id]);
    return result.affectedRows;
};

const deleteStyle = async (id) => {
    const query = `UPDATE styles SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE sty_id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows;
};

const checkSlugExists = async (slug, excludeId = null) => {
    let query = `SELECT sty_id FROM styles WHERE sty_slug = ?`;
    let params = [slug];
    
    if (excludeId) {
        query += ` AND sty_id != ?`;
        params.push(excludeId);
    }
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
};

module.exports = { 
    createStyle, 
    getAllStyles, 
    updateStyle, 
    deleteStyle, 
    checkSlugExists 
};