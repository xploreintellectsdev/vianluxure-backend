const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const createColor = async (name, slug, hexCode) => {
    const query = `INSERT INTO colors (col_name, col_slug, col_hex_code) VALUES (?, ?, ?)`;
    const [result] = await pool.query(query, [name, slug, hexCode]);
    return result.insertId;
};

const getAllColors = async (search, page, limit, sortBy, sortOrder) => {
    let baseQuery = `SELECT * FROM colors WHERE is_active = TRUE AND deleted_at IS NULL`;
    let queryParams = [];

    if (search) {
        baseQuery += ` AND (col_name LIKE ? OR col_slug LIKE ? OR col_hex_code LIKE ?)`;
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};

const updateColor = async (id, name, slug, hexCode) => {
    const query = `UPDATE colors SET col_name = ?, col_slug = ?, col_hex_code = ? WHERE col_id = ? AND deleted_at IS NULL`;
    const [result] = await pool.query(query, [name, slug, hexCode, id]);
    return result.affectedRows;
};

const deleteColor = async (id) => {
    const query = `UPDATE colors SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE col_id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows;
};

const checkSlugExists = async (slug, excludeId = null) => {
    let query = `SELECT col_id FROM colors WHERE col_slug = ?`;
    let params = [slug];
    
    if (excludeId) {
        query += ` AND col_id != ?`;
        params.push(excludeId);
    }
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
};

module.exports = { 
    createColor, 
    getAllColors, 
    updateColor, 
    deleteColor, 
    checkSlugExists 
};