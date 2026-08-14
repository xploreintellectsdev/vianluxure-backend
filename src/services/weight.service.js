const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const createWeight = async (name, slug) => {
    const query = `INSERT INTO weights (wt_name, wt_slug) VALUES (?, ?)`;
    const [result] = await pool.query(query, [name, slug]);
    return result.insertId;
};

const getAllWeights = async (search, page, limit, sortBy, sortOrder) => {
    let baseQuery = `SELECT * FROM weights WHERE is_active = TRUE AND deleted_at IS NULL`;
    let queryParams = [];

    if (search) {
        baseQuery += ` AND (wt_name LIKE ? OR wt_slug LIKE ?)`;
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
    }

    return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};

const updateWeight = async (id, name, slug) => {
    const query = `UPDATE weights SET wt_name = ?, wt_slug = ? WHERE wt_id = ? AND deleted_at IS NULL`;
    const [result] = await pool.query(query, [name, slug, id]);
    return result.affectedRows;
};

const deleteWeight = async (id) => {
    const query = `UPDATE weights SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE wt_id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows;
};

const checkSlugExists = async (slug, excludeId = null) => {
    let query = `SELECT wt_id FROM weights WHERE wt_slug = ?`;
    let params = [slug];
    
    if (excludeId) {
        query += ` AND wt_id != ?`;
        params.push(excludeId);
    }
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
};

module.exports = { 
    createWeight, 
    getAllWeights, 
    updateWeight, 
    deleteWeight, 
    checkSlugExists 
};