const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blog.controller');
const { uploadFile } = require('../middleware/upload.middleware');

const blogUpload = uploadFile('blogs').fields([
  { name: 'blog_image', maxCount: 1 }
]);

const handleBlogUpload = (req, res, next) => {
  blogUpload(req, res, (err) => {
    if (err) {
      console.error('MULTER BLOG ERROR:', err.message);
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    next();
  });
};

router.get('/', blogController.getBlogs);
router.get('/:id', blogController.getBlogById);
router.post('/', handleBlogUpload, blogController.createBlog);
router.put('/:id', handleBlogUpload, blogController.updateBlog);
router.delete('/:id', blogController.deleteBlog);

module.exports = router;
