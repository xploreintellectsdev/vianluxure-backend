const { pool } = require('../config/db');
const paginate = require('../utils/paginate');

const getEvents = async ({ search = '', sort = 'order_no', order = 'ASC', page = 1, limit = 10, status = '' }) => {
  let baseQuery = 'SELECT * FROM events WHERE deleted_at IS NULL';
  const queryParams = [];

  if (search) {
    baseQuery += ' AND (event_title LIKE ? OR short_description LIKE ?)';
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  if (status !== '' && status !== undefined) {
    baseQuery += ' AND is_active = ?';
    queryParams.push(status === 'true' || status === '1' || status === 1 ? 1 : 0);
  }

  return await paginate(baseQuery, queryParams, page, limit, sort, order);
};

const getEventById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM events WHERE event_id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
};

const createEvent = async (data) => {
  const { order_no = 0, event_date = null, event_title, media_type = 'Image', event_media = '', short_description = '', is_active = 1 } = data;
  const [result] = await pool.query(
    `INSERT INTO events (order_no, event_date, event_title, media_type, event_media, short_description, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [order_no, event_date || null, event_title, media_type, event_media, short_description, is_active]
  );
  return result.insertId;
};

const updateEvent = async (id, data) => {
  const { order_no, event_date, event_title, media_type, event_media, short_description, is_active } = data;
  let query = 'UPDATE events SET order_no = ?, event_date = ?, event_title = ?, media_type = ?, short_description = ?, is_active = ?';
  const params = [order_no ?? 0, event_date || null, event_title, media_type || 'Image', short_description || '', is_active ?? 1];

  if (event_media !== undefined && event_media !== null) {
    query += ', event_media = ?';
    params.push(event_media);
  }

  query += ' WHERE event_id = ?';
  params.push(id);

  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
};

const deleteEvent = async (id) => {
  const [result] = await pool.query('UPDATE events SET is_active = FALSE, deleted_at = NOW() WHERE event_id = ? AND deleted_at IS NULL', [id]);
  return result.affectedRows > 0;
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
};
