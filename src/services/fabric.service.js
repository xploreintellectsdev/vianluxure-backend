const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const createFabric = async (fabricData, styles, specifications, galleryImages, productTypes, rtwGalleryImages) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let finalGroupCode = fabricData.groupCode;
        if (!finalGroupCode) {
            const [lastGroupRow] = await conn.query(
                `SELECT fab_group_code FROM fabric_master WHERE fab_group_code LIKE 'DES-%' ORDER BY fab_id DESC LIMIT 1`
            );
            if (lastGroupRow.length > 0) {
                const lastCode = lastGroupRow[0].fab_group_code;
                const lastNumber = parseInt(lastCode.split('-')[1]); 
                finalGroupCode = `DES-${lastNumber + 1}`;
            } else {
                finalGroupCode = `DES-1001`;
            }
        }

        const masterQuery = `
            INSERT INTO fabric_master (
                fab_group_code, fab_name, fab_slug, fc_id, org_id, 
                wt_id, wv_id, pat_id, col_id, fab_price_per_meter, 
                fab_gst, fab_stitching_charges,
                fab_short_desc, fab_long_desc, fab_disclaimer, fab_cover_image,
                is_new_arrival, is_best_seller
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [masterResult] = await conn.query(masterQuery, [
            finalGroupCode, fabricData.name, fabricData.slug, 
            fabricData.fc_id, fabricData.org_id, fabricData.wt_id, fabricData.wv_id,
            fabricData.pat_id, fabricData.col_id, fabricData.price,
            fabricData.gst || 0, fabricData.stitching_charges || 0,
            fabricData.shortDesc, fabricData.longDesc, fabricData.disclaimer || null, fabricData.coverImage,
            fabricData.isNewArrival ?? 0, fabricData.isBestSeller ?? 0
        ]);
        const fabricId = masterResult.insertId;

        const stockQty = parseFloat(fabricData.stock_quantity || 0);
        await conn.query(
            `INSERT INTO stock_master (pro_id, product_type, quantity, unit) VALUES (?, 'fabric', ?, 'meters') ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
            [fabricId, stockQty]
        );

        if (productTypes?.length) {
            const ptValues = productTypes.map(ptId => [fabricId, ptId]);
            await conn.query(`INSERT INTO fabric_product_type_mapping (fab_id, pt_id) VALUES ?`, [ptValues]);
        }

        if (styles?.length) {
            const styleValues = styles.map(styId => [fabricId, styId]);
            await conn.query(`INSERT INTO fabric_style_mapping (fab_id, sty_id) VALUES ?`, [styleValues]);
        }

        if (specifications?.length) {
            const specValues = specifications.map((s, i) => [fabricId, s.title, s.value, i]);
            await conn.query(`INSERT INTO fabric_specifications (fab_id, spec_title, spec_value, display_order) VALUES ?`, [specValues]);
        }

        if (galleryImages?.length) {
            const imgValues = galleryImages.map((url, i) => [fabricId, url, i]);
            await conn.query(`INSERT INTO fabric_images (fab_id, img_url, display_order) VALUES ?`, [imgValues]);
        }

        // ── FIX: Insert into Ready To Wear table including Checkboxes and Gallery! ──
        if (fabricData.rtwName && fabricData.rtwPrice) {
            const rtwSlug = fabricData.slug + '-rtw'; 
            const rtwQuery = `
                INSERT INTO ready_to_wear_master (
                    fab_id, rtw_name, rtw_slug, rtw_short_desc, rtw_price, 
                    rtw_cover_image, is_new_arrival, is_best_seller
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const [rtwResult] = await conn.query(rtwQuery, [
                fabricId, fabricData.rtwName, rtwSlug, fabricData.rtwShortDesc, fabricData.rtwPrice,
                fabricData.rtwCoverImage, fabricData.rtwIsNewArrival, fabricData.rtwIsBestSeller
            ]);

            const rtwId = rtwResult.insertId;
            if (rtwGalleryImages?.length) {
                const imgValues = rtwGalleryImages.map((url, i) => [rtwId, url, i]);
                await conn.query(`INSERT INTO rtw_images (rtw_id, img_url, display_order) VALUES ?`, [imgValues]);
            }
            const rtwStockQty = parseFloat(fabricData.rtwStock || 0);
            await conn.query(
                `INSERT INTO stock_master (pro_id, product_type, quantity, unit) VALUES (?, 'rtw', ?, 'pieces') ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
                [rtwId, rtwStockQty]
            );
        }

        await conn.commit();
        return { fabricId, finalGroupCode };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

const findAllFabrics = async (search, page, limit, sortBy, sortOrder) => {
    let baseQuery = `
        SELECT f.*, 
               IFNULL(sm.quantity, 0) AS stock_quantity, IFNULL(sm.unit, 'meters') AS stock_unit,
               GROUP_CONCAT(DISTINCT pt.pt_name SEPARATOR ', ') AS pt_name,
               fc.fc_name, org.org_name, wt.wt_name, wv.wv_name, pat.pat_name, col.col_name 
        FROM fabric_master f
        LEFT JOIN stock_master sm ON f.fab_id = sm.pro_id AND sm.product_type = 'fabric'
        LEFT JOIN fabric_product_type_mapping fptm ON f.fab_id = fptm.fab_id
        LEFT JOIN product_types pt ON fptm.pt_id = pt.pt_id
        LEFT JOIN fabric_categories fc ON f.fc_id = fc.fc_id
        LEFT JOIN origins org ON f.org_id = org.org_id
        LEFT JOIN weights wt ON f.wt_id = wt.wt_id
        LEFT JOIN weaves wv ON f.wv_id = wv.wv_id
        LEFT JOIN patterns pat ON f.pat_id = pat.pat_id
        LEFT JOIN colors col ON f.col_id = col.col_id
        WHERE f.is_active = TRUE AND f.deleted_at IS NULL
    `;
    let queryParams = [];
    if (search) {
        baseQuery += ` AND (f.fab_name LIKE ? OR f.fab_group_code LIKE ?)`;
        const term = `%${search}%`;
        queryParams.push(term, term);
    }
    
    baseQuery += ` GROUP BY f.fab_id`;
    
    return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};

const findOneFabric = async (id) => {
    const [fabric] = await pool.query(`
        SELECT f.*, IFNULL(sm.quantity, 0) AS stock_quantity, IFNULL(sm.unit, 'meters') AS stock_unit, fc.fc_name, org.org_name, wt.wt_name, wv.wv_name, pat.pat_name, col.col_name
        FROM fabric_master f
        LEFT JOIN stock_master sm ON f.fab_id = sm.pro_id AND sm.product_type = 'fabric'
        LEFT JOIN fabric_categories fc ON f.fc_id = fc.fc_id
        LEFT JOIN origins org ON f.org_id = org.org_id
        LEFT JOIN weights wt ON f.wt_id = wt.wt_id
        LEFT JOIN weaves wv ON f.wv_id = wv.wv_id
        LEFT JOIN patterns pat ON f.pat_id = pat.pat_id
        LEFT JOIN colors col ON f.col_id = col.col_id
        WHERE f.fab_id = ? AND f.deleted_at IS NULL
    `, [id]);
    if (!fabric.length) return null;

    const [images] = await pool.query(`SELECT img_id, img_url FROM fabric_images WHERE fab_id = ? ORDER BY display_order ASC`, [id]);
    const [specs] = await pool.query(`SELECT spec_id, spec_title, spec_value FROM fabric_specifications WHERE fab_id = ? ORDER BY display_order ASC`, [id]);
    const [styles] = await pool.query(`SELECT s.sty_id, s.sty_name FROM styles s JOIN fabric_style_mapping fsm ON s.sty_id = fsm.sty_id WHERE fsm.fab_id = ?`, [id]);
    const [productTypes] = await pool.query(`SELECT pt.pt_id, pt.pt_name FROM product_types pt JOIN fabric_product_type_mapping fptm ON pt.pt_id = fptm.pt_id WHERE fptm.fab_id = ?`, [id]);

    const [rtwData] = await pool.query(`SELECT r.*, IFNULL(sm.quantity, 0) AS rtw_stock_quantity FROM ready_to_wear_master r LEFT JOIN stock_master sm ON r.rtw_id = sm.pro_id AND sm.product_type = 'rtw' WHERE r.fab_id = ? AND r.deleted_at IS NULL LIMIT 1`, [id]);
    
    // ── FIX: Fetch RTW Gallery Images so Edit works perfectly ──
    let rtwImages = [];
    if (rtwData.length > 0) {
        [rtwImages] = await pool.query(`SELECT img_id, img_url FROM rtw_images WHERE rtw_id = ? ORDER BY display_order ASC`, [rtwData[0].rtw_id]);
    }

    return { 
        ...fabric[0], images, specifications: specs, styles, productTypes,
        // Append RTW fields to the same object
        rtw_name: rtwData.length ? rtwData[0].rtw_name : null,
        rtw_price: rtwData.length ? rtwData[0].rtw_price : null,
        rtw_short_desc: rtwData.length ? rtwData[0].rtw_short_desc : null,
        rtw_cover_image: rtwData.length ? rtwData[0].rtw_cover_image : null,
        rtw_is_new_arrival: rtwData.length ? rtwData[0].is_new_arrival : 0,
        rtw_is_best_seller: rtwData.length ? rtwData[0].is_best_seller : 0,
        rtwStock: rtwData.length ? rtwData[0].rtw_stock_quantity : 0,
        rtw_images: rtwImages
    };
};

const updateFabric = async (id, fabricData, styles, specifications, galleryImages, productTypes, rtwGalleryImages) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let masterQuery = `
            UPDATE fabric_master SET 
            fab_name = ?, fc_id = ?, org_id = ?, wt_id = ?, wv_id = ?, 
            pat_id = ?, col_id = ?, fab_price_per_meter = ?, fab_gst = ?, fab_stitching_charges = ?, fab_short_desc = ?, fab_long_desc = ?, fab_disclaimer = ?,
            is_new_arrival = ?, is_best_seller = ?
        `;
        let values = [
            fabricData.name, fabricData.fc_id, fabricData.org_id,
            fabricData.wt_id, fabricData.wv_id, fabricData.pat_id, fabricData.col_id,
            fabricData.price, fabricData.gst || 0, fabricData.stitching_charges || 0, fabricData.shortDesc, fabricData.longDesc, fabricData.disclaimer || null,
            fabricData.isNewArrival ?? 0, fabricData.isBestSeller ?? 0
        ];

        if (fabricData.coverImage) {
            masterQuery += `, fab_cover_image = ?`;
            values.push(fabricData.coverImage);
        }

        masterQuery += ` WHERE fab_id = ?`;
        values.push(id);
        await conn.query(masterQuery, values);

        if (fabricData.stock_quantity !== undefined && fabricData.stock_quantity !== null && fabricData.stock_quantity !== '') {
            const stockQty = parseFloat(fabricData.stock_quantity || 0);
            await conn.query(
                `INSERT INTO stock_master (pro_id, product_type, quantity, unit) VALUES (?, 'fabric', ?, 'meters') ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
                [id, stockQty]
            );
        }

        if (productTypes) {
            await conn.query(`DELETE FROM fabric_product_type_mapping WHERE fab_id = ?`, [id]);
            if (productTypes.length) {
                const ptValues = productTypes.map(ptid => [id, ptid]);
                await conn.query(`INSERT INTO fabric_product_type_mapping (fab_id, pt_id) VALUES ?`, [ptValues]);
            }
        }

        if (styles) {
            await conn.query(`DELETE FROM fabric_style_mapping WHERE fab_id = ?`, [id]);
            if (styles.length) {
                const values = styles.map(sid => [id, sid]);
                await conn.query(`INSERT INTO fabric_style_mapping (fab_id, sty_id) VALUES ?`, [values]);
            }
        }

        if (specifications) {
            await conn.query(`DELETE FROM fabric_specifications WHERE fab_id = ?`, [id]);
            if (specifications.length) {
                const values = specifications.map((s, i) => [id, s.title, s.value, i]);
                await conn.query(`INSERT INTO fabric_specifications (fab_id, spec_title, spec_value, display_order) VALUES ?`, [values]);
            }
        }

        if (galleryImages?.length) {
            const values = galleryImages.map((url, i) => [id, url, i]);
            await conn.query(`INSERT INTO fabric_images (fab_id, img_url, display_order) VALUES ?`, [values]);
        }

        // ── FIX: Update or Insert RTW Data ──
        if (fabricData.rtwName && fabricData.rtwPrice) {
            const [existingRtw] = await conn.query(`SELECT rtw_id FROM ready_to_wear_master WHERE fab_id = ? AND deleted_at IS NULL LIMIT 1`, [id]);
            
            let currentRtwId;

            if (existingRtw.length > 0) {
                currentRtwId = existingRtw[0].rtw_id;
                let rtwQuery = `UPDATE ready_to_wear_master SET rtw_name = ?, rtw_short_desc = ?, rtw_price = ?, is_new_arrival = ?, is_best_seller = ?`;
                let rtwValues = [fabricData.rtwName, fabricData.rtwShortDesc, fabricData.rtwPrice, fabricData.rtwIsNewArrival, fabricData.rtwIsBestSeller];
                
                if (fabricData.rtwCoverImage) {
                    rtwQuery += `, rtw_cover_image = ?`;
                    rtwValues.push(fabricData.rtwCoverImage);
                }
                
                rtwQuery += ` WHERE fab_id = ?`;
                rtwValues.push(id);
                await conn.query(rtwQuery, rtwValues);
            } else {
                const rtwSlug = fabricData.name.replace(/\s+/g, '-').toLowerCase() + '-rtw'; 
                const rtwQuery = `
                    INSERT INTO ready_to_wear_master (
                        fab_id, rtw_name, rtw_slug, rtw_short_desc, rtw_price, 
                        rtw_cover_image, is_new_arrival, is_best_seller
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const [newRtw] = await conn.query(rtwQuery, [
                    id, fabricData.rtwName, rtwSlug, fabricData.rtwShortDesc, fabricData.rtwPrice,
                    fabricData.rtwCoverImage, fabricData.rtwIsNewArrival, fabricData.rtwIsBestSeller
                ]);
                currentRtwId = newRtw.insertId;
            }

            if (rtwGalleryImages?.length) {
                const imgValues = rtwGalleryImages.map((url, i) => [currentRtwId, url, i]);
                await conn.query(`INSERT INTO rtw_images (rtw_id, img_url, display_order) VALUES ?`, [imgValues]);
            }
            if (fabricData.rtwStock !== undefined && fabricData.rtwStock !== null && fabricData.rtwStock !== '') {
                const rtwStockQty = parseFloat(fabricData.rtwStock || 0);
                await conn.query(
                    `INSERT INTO stock_master (pro_id, product_type, quantity, unit) VALUES (?, 'rtw', ?, 'pieces') ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
                    [currentRtwId, rtwStockQty]
                );
            }
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

const removeFabric = async (id) => {
    const query = `UPDATE fabric_master SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE fab_id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows;
};

const findByFlag = async (flagColumn, limit = 10) => {
    const [rows] = await pool.query(`
        SELECT f.fab_id, f.fab_group_code, f.fab_name, f.fab_slug, f.fab_price_per_meter,
               f.fab_cover_image, fc.fc_name, IFNULL(sm.quantity, 0) AS stock_quantity, IFNULL(sm.unit, 'meters') AS stock_unit
        FROM fabric_master f
        LEFT JOIN fabric_categories fc ON f.fc_id = fc.fc_id
        LEFT JOIN stock_master sm ON f.fab_id = sm.pro_id AND sm.product_type = 'fabric'
        WHERE f.${flagColumn} = TRUE AND f.is_active = TRUE AND f.deleted_at IS NULL
        ORDER BY f.fab_id DESC
        LIMIT ?
    `, [Number(limit)]);
    return rows;
};

const checkSlugExists = async (slug, id = null) => {
    let query = `SELECT fab_id FROM fabric_master WHERE fab_slug = ?`;
    let params = [slug];
    if (id) {
        query += ` AND fab_id != ?`;
        params.push(id);
    }
    const [rows] = await pool.query(query, params);
    return rows.length > 0;
};

// ── ADD THIS RIGHT ABOVE module.exports ──
const getAvailableFabricsForRTW = async (search, page, limit, sortBy, sortOrder) => {
    let baseQuery = `
        SELECT f.fab_id, f.fab_name 
        FROM fabric_master f
        LEFT JOIN ready_to_wear_master rtw ON f.fab_id = rtw.fab_id
        WHERE f.is_active = TRUE 
          AND f.deleted_at IS NULL 
          AND rtw.rtw_id IS NULL
    `;
    let queryParams = [];

    if (search) {
        baseQuery += ` AND f.fab_name LIKE ?`;
        queryParams.push(`%${search}%`);
    }

    return await paginate(baseQuery, queryParams, page, limit, sortBy, sortOrder);
};
module.exports = { 
    createFabric, findAllFabrics, findOneFabric, updateFabric, removeFabric, checkSlugExists, findByFlag ,getAvailableFabricsForRTW
};