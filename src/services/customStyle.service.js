const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const createOption = async (optionData) => {
    const query = `
        INSERT INTO custom_options (option_type, option_name, option_price, option_image) 
        VALUES (?, ?, ?, ?)
    `;
    const [result] = await pool.query(query, [
        optionData.type, optionData.name, optionData.price, optionData.image
    ]);
    return result.insertId;
};

const getAllOptions = async (type, search, page, limit, sortBy, sortOrder) => {
    let baseQuery = `
        SELECT * FROM custom_options 
        WHERE option_type = ? AND is_active = TRUE AND deleted_at IS NULL
    `;
    let queryParams = [type]; 

    if (search) {
        baseQuery += ` AND option_name LIKE ?`;
        queryParams.push(`%${search}%`);
    }

    return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};

const findOneOption = async (id) => {
    const [rows] = await pool.query(`
        SELECT * FROM custom_options WHERE option_id = ? AND deleted_at IS NULL
    `, [id]);
    return rows.length > 0 ? rows[0] : null;
};

const updateOption = async (id, optionData) => {
    let query = `UPDATE custom_options SET option_name = ?, option_price = ?`;
    let values = [optionData.name, optionData.price];

    if (optionData.image) {
        query += `, option_image = ?`;
        values.push(optionData.image);
    }

    query += ` WHERE option_id = ? AND deleted_at IS NULL`;
    values.push(id);

    const [result] = await pool.query(query, values);
    return result.affectedRows;
};

const removeOption = async (id) => {
    const query = `
        UPDATE custom_options 
        SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP 
        WHERE option_id = ?
    `;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows;
};

module.exports = { createOption, getAllOptions, findOneOption, updateOption, removeOption };