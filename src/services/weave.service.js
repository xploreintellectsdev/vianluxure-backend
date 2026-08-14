const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const createWeave = async (name, slug) => {
    const query = `INSERT INTO weaves (wv_name, wv_slug) VALUES (?, ?)`;
    const [result] = await pool.query(query, [name, slug]);
    return result.insertId;
};

const getAllWeaves = async (search, page, limit, sortBy, sortOrder) => {
    let baseQuery = `SELECT * FROM weaves WHERE is_active = TRUE AND deleted_at IS NULL`;
    let queryParams = [];

    if (search) {
        baseQuery += ` AND (wv_name LIKE ? OR wv_slug LIKE ?)`;
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
    }

    return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};

const updateWeave = async (id, name, slug) => {
    const query = `UPDATE weaves SET wv_name = ?, wv_slug = ? WHERE wv_id = ? AND deleted_at IS NULL`;
    const [result] = await pool.query(query, [name, slug, id]);
    return result.affectedRows;
};

const deleteWeave = async (id) => {
    const query = `UPDATE weaves SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE wv_id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows;
};

const checkSlugExists = async (slug, excludeId = null) => {
    let query = `SELECT wv_id FROM weaves WHERE wv_slug = ?`;
    let params = [slug];
    
    if (excludeId) {
        query += ` AND wv_id != ?`;
        params.push(excludeId);
    }
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
};

module.exports = { 
    createWeave, 
    getAllWeaves, 
    updateWeave, 
    deleteWeave, 
    checkSlugExists 
};