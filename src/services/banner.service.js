const { pool } = require('../config/db');

const getBanners = async ({ activeOnly = false }) => {
  let query = 'SELECT * FROM home_banners WHERE deleted_at IS NULL';
  const queryParams = [];

  if (activeOnly === 'true' || activeOnly === true) {
    query += ' AND is_active = 1';
  }

  query += ' ORDER BY order_no ASC';

  const [banners] = await pool.query(query, queryParams);

  if (banners.length === 0) return [];

  const bannerIds = banners.map(b => b.banner_id);
  const [stats] = await pool.query(
    'SELECT * FROM home_banner_stats WHERE banner_id IN (?) ORDER BY order_no ASC',
    [bannerIds]
  );

  return banners.map(banner => ({
    ...banner,
    stats: stats.filter(s => s.banner_id === banner.banner_id)
  }));
};

const getBannerById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM home_banners WHERE banner_id = ? AND deleted_at IS NULL', [id]);
  const banner = rows[0];
  if (!banner) return null;

  const [stats] = await pool.query('SELECT * FROM home_banner_stats WHERE banner_id = ? ORDER BY order_no ASC', [id]);
  banner.stats = stats;
  return banner;
};

const createBanner = async (data) => {
  const { banner_key, order_no = 0, layout_type = 'overlay', eyebrow_label = '', title, description = '', button_text = '', button_link = '', image = '', is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO home_banners (banner_key, order_no, layout_type, eyebrow_label, title, description, button_text, button_link, image, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [banner_key, order_no, layout_type, eyebrow_label, title, description, button_text, button_link, image, is_active]
  );
  return result.insertId;
};

const updateBanner = async (id, data) => {
  const { banner_key, order_no, layout_type, eyebrow_label, title, description, button_text, button_link, image, is_active } = data;
  let query = 'UPDATE home_banners SET banner_key = ?, order_no = ?, layout_type = ?, eyebrow_label = ?, title = ?, description = ?, button_text = ?, button_link = ?, is_active = ?';
  const params = [banner_key, order_no ?? 0, layout_type, eyebrow_label || '', title, description || '', button_text || '', button_link || '', is_active ?? 1];

  if (image !== undefined && image !== null) {
    query += ', image = ?';
    params.push(image);
  }

  query += ' WHERE banner_id = ?';
  params.push(id);

  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
};

const deleteBanner = async (id) => {
  const [result] = await pool.query('UPDATE home_banners SET is_active = FALSE, deleted_at = NOW() WHERE banner_id = ? AND deleted_at IS NULL', [id]);
  return result.affectedRows > 0;
};

const replaceStatsForBanner = async (bannerId, statsArray) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM home_banner_stats WHERE banner_id = ?', [bannerId]);

    if (statsArray && statsArray.length > 0) {
      const values = statsArray.map((s, idx) => [
        bannerId,
        s.order_no ?? idx,
        s.stat_value,
        s.stat_label
      ]);
      await conn.query(
        'INSERT INTO home_banner_stats (banner_id, order_no, stat_value, stat_label) VALUES ?',
        [values]
      );
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

module.exports = {
  getBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  replaceStatsForBanner
};
