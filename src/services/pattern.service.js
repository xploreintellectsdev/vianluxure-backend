const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const createPattern = async (name, slug) => {
    const query = `INSERT INTO patterns (pat_name, pat_slug) VALUES (?, ?)`;
    const [result] = await pool.query(query, [name, slug]);
    return result.insertId;
};

const getAllPatterns = async (search, page, limit, sortBy, sortOrder) => {
    let baseQuery = `SELECT * FROM patterns WHERE is_active = TRUE AND deleted_at IS NULL`;
    let queryParams = [];

    if (search) {
        baseQuery += ` AND (pat_name LIKE ? OR pat_slug LIKE ?)`;
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
    }

    return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};

const updatePattern = async (id, name, slug) => {
    const query = `UPDATE patterns SET pat_name = ?, pat_slug = ? WHERE pat_id = ? AND deleted_at IS NULL`;
    const [result] = await pool.query(query, [name, slug, id]);
    return result.affectedRows;
};

const deletePattern = async (id) => {
    const query = `UPDATE patterns SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE pat_id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows;
};

const checkSlugExists = async (slug, excludeId = null) => {
    let query = `SELECT pat_id FROM patterns WHERE pat_slug = ?`;
    let params = [slug];
    
    if (excludeId) {
        query += ` AND pat_id != ?`;
        params.push(excludeId);
    }
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
};

module.exports = { 
    createPattern, 
    getAllPatterns, 
    updatePattern, 
    deletePattern, 
    checkSlugExists 
};