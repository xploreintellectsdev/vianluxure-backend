const { pool: ConnectDB } = require("../config/db");

// ========================
// Placements
// ========================
const getPlacements = async (activeOnly = false) => {
    let query = `SELECT * FROM monogram_placements WHERE 1=1`;
    if (activeOnly) {
        query += ` AND is_active = true`;
    }
    query += ` ORDER BY placement_id DESC`;
    const [rows] = await ConnectDB.execute(query);
    return rows;
};

const getPlacementById = async (id) => {
    const query = `SELECT * FROM monogram_placements WHERE placement_id = ?`;
    const [rows] = await ConnectDB.execute(query, [id]);
    return rows[0] || null;
};

const getPlacementByName = async (name) => {
    const query = `SELECT * FROM monogram_placements WHERE placement_name = ?`;
    const [rows] = await ConnectDB.execute(query, [name]);
    return rows[0] || null;
};

const createPlacement = async (data) => {
    const { placement_name, placement_image, extra_price, is_active } = data;
    const query = `
        INSERT INTO monogram_placements (placement_name, placement_image, extra_price, is_active, created_at)
        VALUES (?, ?, ?, ?, NOW())
    `;
    const [result] = await ConnectDB.execute(query, [placement_name, placement_image, extra_price, is_active]);
    return result.insertId;
};

const updatePlacement = async (id, data) => {
    const { placement_name, placement_image, extra_price, is_active } = data;
    const query = `
        UPDATE monogram_placements
        SET placement_name = ?, placement_image = ?, extra_price = ?, is_active = ?
        WHERE placement_id = ?`;
    const [result] = await ConnectDB.execute(query, [placement_name, placement_image, extra_price, is_active, id]);
    return result.affectedRows > 0;
};

const deletePlacement = async (id) => {
    const query = `DELETE FROM monogram_placements WHERE placement_id = ?`;
    const [result] = await ConnectDB.execute(query, [id]);
    return result.affectedRows > 0;
};

// ========================
// Colors
// ========================
const getColors = async (activeOnly = false) => {
    let query = `SELECT * FROM monogram_colors WHERE 1=1`;
    if (activeOnly) {
        query += ` AND is_active = true`;
    }
    query += ` ORDER BY color_id DESC`;
    const [rows] = await ConnectDB.execute(query);
    return rows;
};

const getColorById = async (id) => {
    const query = `SELECT * FROM monogram_colors WHERE color_id = ?`;
    const [rows] = await ConnectDB.execute(query, [id]);
    return rows[0] || null;
};

const getColorByName = async (name) => {
    const query = `SELECT * FROM monogram_colors WHERE color_name = ?`;
    const [rows] = await ConnectDB.execute(query, [name]);
    return rows[0] || null;
};

const createColor = async (data) => {
    const { color_name, color_image, is_active } = data;
    const query = `
        INSERT INTO monogram_colors (color_name, color_image, is_active, created_at)
        VALUES (?, ?, ?, NOW())
    `;
    const [result] = await ConnectDB.execute(query, [color_name, color_image, is_active]);
    return result.insertId;
};

const updateColor = async (id, data) => {
    const { color_name, color_image, is_active } = data;
    const query = `
        UPDATE monogram_colors
        SET color_name = ?, color_image = ?, is_active = ?
        WHERE color_id = ?`;
    const [result] = await ConnectDB.execute(query, [color_name, color_image, is_active, id]);
    return result.affectedRows > 0;
};

const deleteColor = async (id) => {
    const query = `DELETE FROM monogram_colors WHERE color_id = ?`;
    const [result] = await ConnectDB.execute(query, [id]);
    return result.affectedRows > 0;
};

// ========================
// Fonts
// ========================
const getFonts = async (activeOnly = false) => {
    let query = `SELECT * FROM monogram_fonts WHERE 1=1`;
    if (activeOnly) {
        query += ` AND is_active = true`;
    }
    query += ` ORDER BY font_id DESC`;
    const [rows] = await ConnectDB.execute(query);
    return rows;
};

const getFontById = async (id) => {
    const query = `SELECT * FROM monogram_fonts WHERE font_id = ?`;
    const [rows] = await ConnectDB.execute(query, [id]);
    return rows[0] || null;
};

const getFontByName = async (name) => {
    const query = `SELECT * FROM monogram_fonts WHERE font_name = ?`;
    const [rows] = await ConnectDB.execute(query, [name]);
    return rows[0] || null;
};

const createFont = async (data) => {
    const { font_name, font_preview_image, is_active } = data;
    const query = `
        INSERT INTO monogram_fonts (font_name, font_preview_image, is_active, created_at)
        VALUES (?, ?, ?, NOW())
    `;
    const [result] = await ConnectDB.execute(query, [font_name, font_preview_image, is_active]);
    return result.insertId;
};

const updateFont = async (id, data) => {
    const { font_name, font_preview_image, is_active } = data;
    const query = `
        UPDATE monogram_fonts
        SET font_name = ?, font_preview_image = ?, is_active = ?
        WHERE font_id = ?`;
    const [result] = await ConnectDB.execute(query, [font_name, font_preview_image, is_active, id]);
    return result.affectedRows > 0;
};

const deleteFont = async (id) => {
    const query = `DELETE FROM monogram_fonts WHERE font_id = ?`;
    const [result] = await ConnectDB.execute(query, [id]);
    return result.affectedRows > 0;
};

module.exports = {
    getPlacements,
    getPlacementById,
    getPlacementByName,
    createPlacement,
    updatePlacement,
    deletePlacement,
    getColors,
    getColorById,
    getColorByName,
    createColor,
    updateColor,
    deleteColor,
    getFonts,
    getFontById,
    getFontByName,
    createFont,
    updateFont,
    deleteFont
};
