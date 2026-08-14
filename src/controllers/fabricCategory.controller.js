const fcService = require('../services/fabricCategory.service');
const generateSlug = require('../utils/generateSlug');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const create = catchAsync(async (req, res) => {
  // ── TEMP DEBUG — remove once the image issue is confirmed fixed ──
  console.log('=== CREATE DEBUG ===');
  console.log('req.file:', req.file);
  console.log('req.body:', req.body);
  console.log('Content-Type header:', req.headers['content-type']);
  console.log('=====================');

  const { name, image } = req.body;
  let uploadedImage = null;
  if (req.file) {
    uploadedImage = `/uploads/category/${req.file.filename}`;
  } else if (typeof image === 'string' && (image.startsWith('/') || image.startsWith('http'))) {
    uploadedImage = image;
  }

  if (!name) return errorRes(res, "Category name is required", 400);

  let slug = generateSlug(name);
  const exists = await fcService.checkSlugExists(slug);
  if (exists) return errorRes(res, "This Fabric Category already exists.", 400);

  const id = await fcService.createFabricCategory(name, slug, uploadedImage);
  return successRes(res, "Fabric Category created successfully", { insertId: id }, null, 201);
});

const getAll = catchAsync(async (req, res) => {
  const search = req.query.search || "";
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const sortBy = req.query.sortBy || "fc_id";
  const sortOrder = req.query.sortOrder || "DESC";
  // ── FIX: optional flag so storefront can request only categories that have products ──
  const onlyWithProducts = req.query.onlyWithProducts === 'true';

  const { data, meta } = await fcService.getAllFabricCategories(search, page, limit, sortBy, sortOrder, onlyWithProducts);
  return successRes(res, "Fabric Categories fetched successfully", data, meta);
});

const update = catchAsync(async (req, res) => {
  // ── TEMP DEBUG — remove once the image issue is confirmed fixed ──
  console.log('=== UPDATE DEBUG ===');
  console.log('req.file:', req.file);
  console.log('req.body:', req.body);
  console.log('Content-Type header:', req.headers['content-type']);
  console.log('=====================');

  const { id } = req.params;
  const { name, image } = req.body;
  let uploadedImage = null;
  if (req.file) {
    uploadedImage = `/uploads/category/${req.file.filename}`;
  } else if (typeof image === 'string' && (image.startsWith('/') || image.startsWith('http'))) {
    uploadedImage = image;
  }

  if (!name) return errorRes(res, "Category name is required", 400);

  let slug = generateSlug(name);
  const exists = await fcService.checkSlugExists(slug, id);
  if (exists) return errorRes(res, "Name already taken by another category.", 400);

  const affectedRows = await fcService.updateFabricCategory(id, name, slug, uploadedImage);
  if (affectedRows === 0) return errorRes(res, "Fabric Category not found", 404);

  return successRes(res, "Fabric Category updated successfully");
});

const deleteCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const affectedRows = await fcService.deleteFabricCategory(id);
  if (affectedRows === 0) return errorRes(res, "Fabric Category not found", 404);
  return successRes(res, "Fabric Category deleted successfully");
});

const getByCategorySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const fabrics = await fcService.findByCategorySlug(slug);
    res.status(200).json({ success: true, data: fabrics });
  } catch (error) {
    console.error("Error fetching fabrics by category:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  create,
  getAll,
  update,
  delete: deleteCategory,
  getByCategorySlug
};