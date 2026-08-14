const blogService = require('../services/blog.service');

const getBlogs = async (req, res) => {
  try {
    const { search = '', sort = 'order_no', order = 'ASC', page = 1, limit = 10, status = '' } = req.query;
    const result = await blogService.getBlogs({
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
    console.error('Get Blogs Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getBlogById = async (req, res) => {
  try {
    const blog = await blogService.getBlogById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    return res.status(200).json({ success: true, data: blog });
  } catch (error) {
    console.error('Get Blog By ID Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createBlog = async (req, res) => {
  try {
    const { order_no, published_date, blog_title, short_description, blog_content, is_active } = req.body;
    
    let blog_image = '';
    if (req.file) {
      blog_image = `/uploads/blogs/${req.file.filename}`;
    } else if (req.files && req.files['blog_image'] && req.files['blog_image'][0]) {
      blog_image = `/uploads/blogs/${req.files['blog_image'][0].filename}`;
    }

    if (!blog_image) {
      return res.status(400).json({ success: false, message: 'Blog image is required.' });
    }

    const insertId = await blogService.createBlog({
      order_no: Number(order_no || 0),
      published_date: published_date ? published_date : null,
      blog_title,
      blog_image,
      short_description: short_description || '',
      blog_content: blog_content || '',
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    });

    return res.status(201).json({ success: true, message: 'Blog created successfully.', data: { blog_id: insertId } });
  } catch (error) {
    console.error('Create Blog Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { order_no, published_date, blog_title, short_description, blog_content, is_active } = req.body;

    let blog_image = null;
    if (req.file) {
      blog_image = `/uploads/blogs/${req.file.filename}`;
    } else if (req.files && req.files['blog_image'] && req.files['blog_image'][0]) {
      blog_image = `/uploads/blogs/${req.files['blog_image'][0].filename}`;
    }

    const success = await blogService.updateBlog(id, {
      order_no: Number(order_no || 0),
      published_date: published_date ? published_date : null,
      blog_title,
      blog_image,
      short_description: short_description || '',
      blog_content: blog_content || '',
      is_active: is_active === 'true' || is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
    });

    if (!success) return res.status(404).json({ success: false, message: 'Blog not found.' });

    return res.status(200).json({ success: true, message: 'Blog updated successfully.' });
  } catch (error) {
    console.error('Update Blog Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteBlog = async (req, res) => {
  try {
    const success = await blogService.deleteBlog(req.params.id);
    if (!success) return res.status(404).json({ success: false, message: 'Blog not found.' });
    return res.status(200).json({ success: true, message: 'Blog deleted successfully.' });
  } catch (error) {
    console.error('Delete Blog Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog
};
