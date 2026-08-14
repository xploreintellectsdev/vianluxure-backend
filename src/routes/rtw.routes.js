const express = require('express');
const router = express.Router();
const rtwController = require('../controllers/rtw.controller');
const { uploadFile } = require('../middleware/upload.middleware');

const rtwUpload = uploadFile('rtw').fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 }
]);

const handleRtwUpload = (req, res, next) => {
    rtwUpload(req, res, (err) => {
        if (err) {
            console.error('MULTER ERROR:', err.message);
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        }
        next();
    });
};

router.post('/', handleRtwUpload, rtwController.create);
router.get('/', rtwController.getAll);
router.get('/:id', rtwController.getById);
router.put('/:id', handleRtwUpload, rtwController.update);
router.delete('/:id', rtwController.delete);

module.exports = router;