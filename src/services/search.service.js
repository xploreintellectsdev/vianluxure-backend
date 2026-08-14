const { pool } = require('../config/db');

const getFilters = async () => {
    // Categories used by active fabrics OR RTW items
    const [categories] = await pool.query(`
        SELECT fc_id as id, fc_name as name, fc_slug as slug, fc_image as img 
        FROM fabric_categories c
        WHERE EXISTS (
            SELECT 1 FROM fabric_master f WHERE f.fc_id = c.fc_id AND f.is_active = TRUE AND f.deleted_at IS NULL
        ) OR EXISTS (
            SELECT 1 FROM ready_to_wear_master r JOIN fabric_master f ON r.fab_id = f.fab_id WHERE f.fc_id = c.fc_id AND r.is_active = TRUE AND r.deleted_at IS NULL
        )
    `);

    const [productTypes] = await pool.query(`
        SELECT pt_id as id, pt_name as name
        FROM product_types p
        WHERE EXISTS (
            SELECT 1 FROM fabric_product_type_mapping fptm 
            JOIN fabric_master f ON fptm.fab_id = f.fab_id 
            WHERE fptm.pt_id = p.pt_id AND f.is_active = TRUE AND f.deleted_at IS NULL
        )
    `);

    const [origins] = await pool.query(`
        SELECT org_id as id, org_name as name
        FROM origins o
        WHERE EXISTS (
            SELECT 1 FROM fabric_master f WHERE f.org_id = o.org_id AND f.is_active = TRUE AND f.deleted_at IS NULL
        ) OR EXISTS (
            SELECT 1 FROM ready_to_wear_master r JOIN fabric_master f ON r.fab_id = f.fab_id WHERE f.org_id = o.org_id AND r.is_active = TRUE AND r.deleted_at IS NULL
        )
    `);

    const [styles] = await pool.query(`
        SELECT sty_id as id, sty_name as name
        FROM styles s
        WHERE EXISTS (
            SELECT 1 FROM fabric_style_mapping fsm 
            JOIN fabric_master f ON fsm.fab_id = f.fab_id 
            WHERE fsm.sty_id = s.sty_id AND f.is_active = TRUE AND f.deleted_at IS NULL
        )
    `);

    const [colors] = await pool.query(`
        SELECT col_id as id, col_name as name
        FROM colors c
        WHERE EXISTS (
            SELECT 1 FROM fabric_master f WHERE f.col_id = c.col_id AND f.is_active = TRUE AND f.deleted_at IS NULL
        ) OR EXISTS (
            SELECT 1 FROM ready_to_wear_master r JOIN fabric_master f ON r.fab_id = f.fab_id WHERE f.col_id = c.col_id AND r.is_active = TRUE AND r.deleted_at IS NULL
        )
    `);

    const [patterns] = await pool.query(`
        SELECT pat_id as id, pat_name as name
        FROM patterns p
        WHERE EXISTS (
            SELECT 1 FROM fabric_master f WHERE f.pat_id = p.pat_id AND f.is_active = TRUE AND f.deleted_at IS NULL
        ) OR EXISTS (
            SELECT 1 FROM ready_to_wear_master r JOIN fabric_master f ON r.fab_id = f.fab_id WHERE f.pat_id = p.pat_id AND r.is_active = TRUE AND r.deleted_at IS NULL
        )
    `);

    return {
        categories,
        productTypes,
        origins,
        styles,
        colors,
        patterns
    };
};

const searchFabrics = async (searchQuery, limit = 50) => {
    const term = `%${searchQuery}%`;
    
    // ── MASSIVE UNION QUERY TO SEARCH ALL ASPECTS ──
    const query = `
        SELECT 
            f.fab_id as id, 
            'fabric' as product_type,
            f.fab_name as name, 
            f.fab_short_desc as short_desc, 
            f.fab_price_per_meter as price, 
            f.fab_cover_image as cover_image, 
            fc.fc_name as category_name,
            col.col_name as color_name
        FROM fabric_master f
        LEFT JOIN fabric_categories fc ON f.fc_id = fc.fc_id
        LEFT JOIN colors col ON f.col_id = col.col_id
        LEFT JOIN origins org ON f.org_id = org.org_id
        LEFT JOIN weights wt ON f.wt_id = wt.wt_id
        LEFT JOIN weaves wv ON f.wv_id = wv.wv_id
        LEFT JOIN patterns pat ON f.pat_id = pat.pat_id
        LEFT JOIN fabric_style_mapping fsm ON f.fab_id = fsm.fab_id
        LEFT JOIN styles s ON fsm.sty_id = s.sty_id
        WHERE f.is_active = TRUE 
          AND f.deleted_at IS NULL
          AND (
              f.fab_name LIKE ? OR 
              f.fab_short_desc LIKE ? OR 
              f.fab_group_code LIKE ? OR
              fc.fc_name LIKE ? OR
              col.col_name LIKE ? OR
              org.org_name LIKE ? OR
              wt.wt_name LIKE ? OR
              wv.wv_name LIKE ? OR
              pat.pat_name LIKE ? OR
              s.sty_name LIKE ?
          )
        GROUP BY f.fab_id

        UNION ALL

        SELECT 
            r.rtw_id as id,
            'ready_to_wear' as product_type,
            r.rtw_name as name,
            r.rtw_short_desc as short_desc,
            r.rtw_price as price,
            r.rtw_cover_image as cover_image,
            fc.fc_name as category_name,
            col.col_name as color_name
        FROM ready_to_wear_master r
        LEFT JOIN fabric_master f ON r.fab_id = f.fab_id
        LEFT JOIN fabric_categories fc ON f.fc_id = fc.fc_id
        LEFT JOIN colors col ON f.col_id = col.col_id
        LEFT JOIN origins org ON f.org_id = org.org_id
        LEFT JOIN weights wt ON f.wt_id = wt.wt_id
        LEFT JOIN weaves wv ON f.wv_id = wv.wv_id
        LEFT JOIN patterns pat ON f.pat_id = pat.pat_id
        LEFT JOIN fabric_style_mapping fsm ON f.fab_id = fsm.fab_id
        LEFT JOIN styles s ON fsm.sty_id = s.sty_id
        WHERE r.is_active = TRUE 
          AND r.deleted_at IS NULL
          AND f.deleted_at IS NULL
          AND (
              r.rtw_name LIKE ? OR 
              r.rtw_short_desc LIKE ? OR 
              f.fab_name LIKE ? OR 
              f.fab_group_code LIKE ? OR
              fc.fc_name LIKE ? OR
              col.col_name LIKE ? OR
              org.org_name LIKE ? OR
              wt.wt_name LIKE ? OR
              wv.wv_name LIKE ? OR
              pat.pat_name LIKE ? OR
              s.sty_name LIKE ?
          )
        GROUP BY r.rtw_id
        LIMIT ?
    `;

    // 10 params for fabric, 11 params for RTW, 1 for LIMIT = 22 params total
    const params = [
        term, term, term, term, term, 
        term, term, term, term, term, 

        term, term, term, term, term, 
        term, term, term, term, term, term, 

        Number(limit)
    ];

    const [rows] = await pool.query(query, params);
    return rows;
};

module.exports = { searchFabrics, getFilters };