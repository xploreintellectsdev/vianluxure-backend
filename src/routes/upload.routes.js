const express = require('express');
const router = express.Router();
const { uploadFile } = require('../middleware/upload.middleware');

// Save uploaded files into /uploads/bespoke folder
const bespokeUpload = uploadFile('bespoke').single('referenceFile');

const handleUpload = (req, res, next) => {
    bespokeUpload(req, res, (err) => {
        if (err) {
            console.error('MULTER ERROR:', err.message);
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        }
        next();
    });
};

router.post('/', handleUpload, (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const fileUrl = `/uploads/bespoke/${req.file.filename}`;
    return res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname
    });
});

const profileUpload = uploadFile('profiles').single('profileImage');

router.post('/profile', (req, res) => {
    profileUpload(req, res, (err) => {
        if (err) {
            console.error('MULTER ERROR:', err.message);
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No profile image uploaded' });
        }
        const fileUrl = `/uploads/profiles/${req.file.filename}`;
        return res.status(200).json({
            success: true,
            url: fileUrl
        });
    });
});

module.exports = router;