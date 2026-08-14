const express = require('express');
const router = express.Router();
const customStyleController = require('../controllers/customStyle.controller');
const { uploadFile } = require('../middleware/upload.middleware');

// Automatically saves files into the /uploads/custom-styles folder!
const customStyleUpload = uploadFile('custom-styles').single('image');

const handleUpload = (req, res, next) => {
    customStyleUpload(req, res, (err) => {
        if (err) {
            console.error('MULTER ERROR:', err.message);
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        }
        next();
    });
};

router.post('/', handleUpload, customStyleController.create);
router.get('/', customStyleController.getAll);
router.get('/:id', customStyleController.getById);
router.put('/:id', handleUpload, customStyleController.update);
router.delete('/:id', customStyleController.delete);

module.exports = router;