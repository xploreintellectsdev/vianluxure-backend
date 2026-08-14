const { pool } = require('../config/db');
const paginate = require('../utils/paginate');


const createProductType = async (name, slug) => {
    const query = `INSERT INTO product_types (pt_name, pt_slug) VALUES (?, ?)`;
    const [result] = await pool.query(query, [name, slug]);
    return result.insertId;
};


const getAllProductTypes = async (search, page, limit, sortBy, sortOrder) => {
    let baseQuery = `SELECT * FROM product_types WHERE is_active = TRUE AND deleted_at IS NULL`;
    let queryParams = [];

    if (search) {
        baseQuery += ` AND (pt_name LIKE ? OR pt_slug LIKE ?)`;
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
    }

    // Do NOT append ORDER BY here. Just pass everything to the paginate utility.
    return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};

const updateProductType = async (id, name, slug) => {
    const query = `UPDATE product_types SET pt_name = ?, pt_slug = ? WHERE pt_id = ? AND deleted_at IS NULL`;
    const [result] = await pool.query(query, [name, slug, id]);
    return result.affectedRows;
};


const deleteProductType = async (id) => {
    const query = `UPDATE product_types SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE pt_id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows;
};


const checkSlugExists = async (slug, excludeId = null) => {
    let query = `SELECT pt_id FROM product_types WHERE pt_slug = ?`;
    let params = [slug];
    
    if (excludeId) {
        query += ` AND pt_id != ?`;
        params.push(excludeId);
    }
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
};

module.exports = { 
    createProductType, 
    getAllProductTypes, 
    updateProductType, 
    deleteProductType, 
    checkSlugExists 
};