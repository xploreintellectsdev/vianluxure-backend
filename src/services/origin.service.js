const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const createOrigin = async (name, slug) => {
    const query = `INSERT INTO origins (org_name, org_slug) VALUES (?, ?)`;
    const [result] = await pool.query(query, [name, slug]);
    return result.insertId;
};

const getAllOrigins = async (search, page, limit, sortBy, sortOrder) => {
    let baseQuery = `SELECT * FROM origins WHERE is_active = TRUE AND deleted_at IS NULL`;
    let queryParams = [];

    if (search) {
        baseQuery += ` AND (org_name LIKE ? OR org_slug LIKE ?)`;
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
    }

    return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};

const updateOrigin = async (id, name, slug) => {
    const query = `UPDATE origins SET org_name = ?, org_slug = ? WHERE org_id = ? AND deleted_at IS NULL`;
    const [result] = await pool.query(query, [name, slug, id]);
    return result.affectedRows;
};

const deleteOrigin = async (id) => {
    const query = `UPDATE origins SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE org_id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows;
};

const checkSlugExists = async (slug, excludeId = null) => {
    let query = `SELECT org_id FROM origins WHERE org_slug = ?`;
    let params = [slug];
    
    if (excludeId) {
        query += ` AND org_id != ?`;
        params.push(excludeId);
    }
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
};

module.exports = { 
    createOrigin, 
    getAllOrigins, 
    updateOrigin, 
    deleteOrigin, 
    checkSlugExists 
};