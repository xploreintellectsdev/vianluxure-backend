const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const createRTW = async (rtwData, galleryImages) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const query = `
            INSERT INTO ready_to_wear_master (
                fab_id, rtw_name, rtw_slug, rtw_short_desc, rtw_price, 
                rtw_cover_image, is_new_arrival, is_best_seller
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await conn.query(query, [
            rtwData.fab_id, rtwData.name, rtwData.slug, rtwData.shortDesc, rtwData.price,
            rtwData.coverImage, rtwData.isNewArrival, rtwData.isBestSeller
        ]);
        const rtwId = result.insertId;

        const stockQty = parseFloat(rtwData.stock_quantity ?? rtwData.rtwStock ?? 0);
        await conn.query(
            `INSERT INTO stock_master (pro_id, product_type, quantity, unit) VALUES (?, 'rtw', ?, 'pieces') ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
            [rtwId, stockQty]
        );

        if (galleryImages?.length) {
            const imgValues = galleryImages.map((url, i) => [rtwId, url, i]);
            await conn.query(`INSERT INTO rtw_images (rtw_id, img_url, display_order) VALUES ?`, [imgValues]);
        }

        await conn.commit();
        return rtwId;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

const findAllRTW = async (search, page, limit, sortBy, sortOrder) => {
    let baseQuery = `
        SELECT r.*, IFNULL(sm.quantity, 0) AS stock_quantity, IFNULL(sm.unit, 'pieces') AS stock_unit, f.fab_name, f.fab_group_code, f.fab_gst, f.fab_stitching_charges 
        FROM ready_to_wear_master r
        LEFT JOIN fabric_master f ON r.fab_id = f.fab_id
        LEFT JOIN stock_master sm ON r.rtw_id = sm.pro_id AND sm.product_type = 'rtw'
        WHERE r.is_active = TRUE AND r.deleted_at IS NULL
    `;
    let queryParams = [];
    
    if (search) {
        baseQuery += ` AND (r.rtw_name LIKE ? OR f.fab_name LIKE ?)`;
        const term = `%${search}%`;
        queryParams.push(term, term);
    }
    
    return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};

const findOneRTW = async (id) => {
    const [rtw] = await pool.query(`
        SELECT r.*, IFNULL(sm.quantity, 0) AS stock_quantity, IFNULL(sm.unit, 'pieces') AS stock_unit, f.fab_name, f.fab_gst, f.fab_stitching_charges 
        FROM ready_to_wear_master r
        LEFT JOIN fabric_master f ON r.fab_id = f.fab_id
        LEFT JOIN stock_master sm ON r.rtw_id = sm.pro_id AND sm.product_type = 'rtw'
        WHERE r.rtw_id = ? AND r.deleted_at IS NULL
    `, [id]);
    if (!rtw.length) return null;

    const [images] = await pool.query(`SELECT img_id, img_url FROM rtw_images WHERE rtw_id = ? ORDER BY display_order ASC`, [id]);

    return { ...rtw[0], images };
};

const updateRTW = async (id, rtwData, galleryImages) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let query = `
            UPDATE ready_to_wear_master SET 
            fab_id = ?, rtw_name = ?, rtw_short_desc = ?, rtw_price = ?, 
            is_new_arrival = ?, is_best_seller = ?
        `;
        let values = [
            rtwData.fab_id, rtwData.name, rtwData.shortDesc, rtwData.price,
            rtwData.isNewArrival, rtwData.isBestSeller
        ];

        if (rtwData.coverImage) {
            query += `, rtw_cover_image = ?`;
            values.push(rtwData.coverImage);
        }

        query += ` WHERE rtw_id = ?`;
        values.push(id);
        await conn.query(query, values);

        if (rtwData.stock_quantity !== undefined && rtwData.stock_quantity !== null && rtwData.stock_quantity !== '') {
            const stockQty = parseFloat(rtwData.stock_quantity || 0);
            await conn.query(
                `INSERT INTO stock_master (pro_id, product_type, quantity, unit) VALUES (?, 'rtw', ?, 'pieces') ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
                [id, stockQty]
            );
        }

        if (galleryImages?.length) {
            const imgValues = galleryImages.map((url, i) => [id, url, i]);
            await conn.query(`INSERT INTO rtw_images (rtw_id, img_url, display_order) VALUES ?`, [imgValues]);
        }

        await conn.commit();
        return true;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

const removeRTW = async (id) => {
    const query = `UPDATE ready_to_wear_master SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE rtw_id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows;
};

const checkSlugExists = async (slug, id = null) => {
    let query = `SELECT rtw_id FROM ready_to_wear_master WHERE rtw_slug = ?`;
    let params = [slug];
    if (id) {
        query += ` AND rtw_id != ?`;
        params.push(id);
    }
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
};

module.exports = { createRTW, findAllRTW, findOneRTW, updateRTW, removeRTW, checkSlugExists };