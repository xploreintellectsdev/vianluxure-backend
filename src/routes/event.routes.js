const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const { uploadFile } = require('../middleware/upload.middleware');

const eventUpload = uploadFile('events').fields([
  { name: 'event_media', maxCount: 1 }
]);

const handleEventUpload = (req, res, next) => {
  eventUpload(req, res, (err) => {
    if (err) {
      console.error('MULTER EVENT ERROR:', err.message);
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    next();
  });
};

router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEventById);
router.post('/', handleEventUpload, eventController.createEvent);
router.put('/:id', handleEventUpload, eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

module.exports = router;
