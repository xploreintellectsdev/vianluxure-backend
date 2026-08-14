const eventService = require('../services/event.service');

const getEvents = async (req, res) => {
  try {
    const { search = '', sort = 'order_no', order = 'ASC', page = 1, limit = 10, status = '' } = req.query;
    const result = await eventService.getEvents({
      search,
      sort,
      order,
      page: Number(page),
      limit: Number(limit),
      status
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
      total: result.meta ? result.meta.total : result.data.length
    });
  } catch (error) {
    console.error('Get Events Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await eventService.getEventById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    return res.status(200).json({ success: true, data: event });
  } catch (error) {
    console.error('Get Event By ID Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createEvent = async (req, res) => {
  try {
    const { order_no, event_date, event_title, media_type, short_description, is_active } = req.body;

    let event_media = '';
    if (req.file) {
      event_media = `/uploads/events/${req.file.filename}`;
    } else if (req.files && req.files['event_media'] && req.files['event_media'][0]) {
      event_media = `/uploads/events/${req.files['event_media'][0].filename}`;
    }

    if (!event_media) {
      return res.status(400).json({ success: false, message: 'Event media is required.' });
    }

    const insertId = await eventService.createEvent({
      order_no: Number(order_no || 0),
      event_date: event_date ? event_date : null,
      event_title,
      media_type: media_type || 'Image',
      event_media,
      short_description: short_description || '',
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    });

    return res.status(201).json({ success: true, message: 'Event created successfully.', data: { event_id: insertId } });
  } catch (error) {
    console.error('Create Event Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { order_no, event_date, event_title, media_type, short_description, is_active } = req.body;

    let event_media = null;
    if (req.file) {
      event_media = `/uploads/events/${req.file.filename}`;
    } else if (req.files && req.files['event_media'] && req.files['event_media'][0]) {
      event_media = `/uploads/events/${req.files['event_media'][0].filename}`;
    }

    const success = await eventService.updateEvent(id, {
      order_no: Number(order_no || 0),
      event_date: event_date ? event_date : null,
      event_title,
      media_type: media_type || 'Image',
      event_media,
      short_description: short_description || '',
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    });

    if (!success) return res.status(404).json({ success: false, message: 'Event not found.' });

    return res.status(200).json({ success: true, message: 'Event updated successfully.' });
  } catch (error) {
    console.error('Update Event Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const success = await eventService.deleteEvent(req.params.id);
    if (!success) return res.status(404).json({ success: false, message: 'Event not found.' });
    return res.status(200).json({ success: true, message: 'Event deleted successfully.' });
  } catch (error) {
    console.error('Delete Event Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
};
