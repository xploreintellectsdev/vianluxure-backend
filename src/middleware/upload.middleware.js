const multer = require('multer');
const fs = require('fs');
const path = require('path');

/**
 * Multer Configuration for Dynamic Folder Uploads
 */
const uploadFile = (folderName) => {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, `../uploads/${folderName}`);
            
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const cleanFileName = file.originalname.replace(/\s+/g, '-'); 
            cb(null, uniqueSuffix + '-' + cleanFileName);
        }
    });

    const fileFilter = (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only image, video, and PDF files are allowed!'), false);
        }
    };

    return multer({ 
        storage: storage,
        fileFilter: fileFilter,
        limits: { fileSize: 50 * 1024 * 1024 } // 50 MB to accommodate short video clips
    });
};

/**
 * Utility to delete files from disk if DB transaction fails
 */
const deleteFiles = (files) => {
    if (!files) return;

    const filesToProcess = [];

    // Handle array of files (upload.array)
    if (Array.isArray(files)) {
        filesToProcess.push(...files);
    } 
    // Handle object of files (upload.fields)
    else if (typeof files === 'object') {
        Object.values(files).forEach(val => {
            if (Array.isArray(val)) filesToProcess.push(...val);
            else filesToProcess.push(val);
        });
    }

    filesToProcess.forEach(file => {
        if (file.path && fs.existsSync(file.path)) {
            fs.unlink(file.path, (err) => {
                if (err) console.error(`Error deleting file: ${file.path}`, err);
            });
        }
    });
};

module.exports = { uploadFile, deleteFiles };