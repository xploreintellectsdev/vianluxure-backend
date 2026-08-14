const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const entityConfigMap = {
  product_types: { table: 'product_types', id: 'pt_id', nameCol: 'pt_name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  fabric_categories: { table: 'fabric_categories', id: 'fc_id', nameCol: 'fc_name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  origins: { table: 'origins', id: 'org_id', nameCol: 'org_name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  weights: { table: 'weights', id: 'wt_id', nameCol: 'wt_name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  weaves: { table: 'weaves', id: 'wv_id', nameCol: 'wv_name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  patterns: { table: 'patterns', id: 'pat_id', nameCol: 'pat_name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  styles: { table: 'styles', id: 'sty_id', nameCol: 'sty_name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  colors: { table: 'colors', id: 'col_id', nameCol: 'col_name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  fabrics: { table: 'fabric_master', id: 'fab_id', nameCol: 'fab_name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  rtw: { table: 'ready_to_wear_master', id: 'rtw_id', nameCol: 'rtw_name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  reviews: { table: 'fabric_reviews', id: 'rev_id', nameCol: 'customer_name', restoreSet: 'deleted_at = NULL' },
  blogs: { table: 'blogs', id: 'blog_id', nameCol: 'blog_title', restoreSet: 'deleted_at = NULL, is_active = 1' },
  events: { table: 'events', id: 'event_id', nameCol: 'event_title', restoreSet: 'deleted_at = NULL, is_active = 1' },
  custom_style_categories: { table: 'custom_style_categories', id: 'id', nameCol: 'name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  custom_styles: { table: 'custom_styles', id: 'id', nameCol: 'style_name', restoreSet: 'deleted_at = NULL, is_active = TRUE' },
  hero_slides: { table: 'home_hero_slides', id: 'slide_id', nameCol: 'title', restoreSet: 'deleted_at = NULL, is_active = 1' },
  hero_marquee: { table: 'home_marquee_items', id: 'item_id', nameCol: 'item_text', restoreSet: 'deleted_at = NULL, is_active = 1' },
  banners: { table: 'home_banners', id: 'banner_id', nameCol: 'title', restoreSet: 'deleted_at = NULL, is_active = 1' },
  story_sections: { table: 'home_story_sections', id: 'section_id', nameCol: 'title', restoreSet: 'deleted_at = NULL, is_active = 1' },
  menu_items: { table: 'site_menu_items', id: 'menu_id', nameCol: 'label', restoreSet: 'deleted_at = NULL, is_active = 1' },
  about_sections: { table: 'about_page_sections', id: 'section_id', nameCol: 'title', restoreSet: 'deleted_at = NULL, is_active = 1' },
  contact_info_items: { table: 'contact_info_items', id: 'item_id', nameCol: 'label', restoreSet: 'deleted_at = NULL, is_active = 1' },
  art_of_perfect_fit_steps: { table: 'art_of_perfect_fit_steps', id: 'step_id', nameCol: 'title', restoreSet: 'deleted_at = NULL' }
};

exports.getTrash = async (req, res) => {
  try {
    const { entity } = req.params;
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const config = entityConfigMap[entity];
    if (!config) {
      return res.status(400).json({ success: false, message: `Unknown or unsupported entity: ${entity}` });
    }

    let baseQuery = `SELECT * FROM ${config.table} WHERE deleted_at IS NOT NULL`;
    const params = [];

    if (search && config.nameCol) {
      baseQuery += ` AND ${config.nameCol} LIKE ?`;
      params.push(`%${search}%`);
    }

    const { data, meta } = await paginate(baseQuery, params, page, limit, config.id, 'DESC');
    return res.status(200).json({ success: true, data, meta });
  } catch (error) {
    console.error('Error fetching deleted entities:', error);
    return res.status(500).json({ success: false, message: 'Internal server error fetching trash items.' });
  }
};

exports.restoreEntity = async (req, res) => {
  try {
    const { entity, id } = req.body;
    if (!entity || !id) {
      return res.status(400).json({ success: false, message: 'Entity name and ID are required for restoration.' });
    }

    const config = entityConfigMap[entity];
    if (!config) {
      return res.status(400).json({ success: false, message: `Unknown or unsupported entity: ${entity}` });
    }

    const query = `UPDATE ${config.table} SET ${config.restoreSet} WHERE ${config.id} = ?`;
    const [result] = await pool.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Record not found or already restored.' });
    }

    return res.status(200).json({ success: true, message: 'Successfully restored deleted record.' });
  } catch (error) {
    console.error('Error restoring entity:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while restoring record.' });
  }
};

exports.permanentDelete = async (req, res) => {
  try {
    const { entity, id } = req.body;
    if (!entity || !id) {
      return res.status(400).json({ success: false, message: 'Entity name and ID are required.' });
    }

    const config = entityConfigMap[entity];
    if (!config) {
      return res.status(400).json({ success: false, message: `Unknown or unsupported entity: ${entity}` });
    }

    const query = `DELETE FROM ${config.table} WHERE ${config.id} = ?`;
    const [result] = await pool.query(query, [id]);

    return res.status(200).json({ success: true, message: 'Record permanently deleted.' });
  } catch (error) {
    console.error('Error in permanent delete:', error);
    return res.status(500).json({ success: false, message: 'Failed to permanently delete record.' });
  }
};
