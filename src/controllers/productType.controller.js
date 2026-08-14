const ptService = require('../services/productType.service');
const generateSlug = require('../utils/generateSlug');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

/**
 * Create a new Product Type
 */
const create = catchAsync(async (req, res) => {
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Name is required", 400);

    let slug = generateSlug(name);

    // Check for duplicate slug
    const exists = await ptService.checkSlugExists(slug);
    if (exists) return errorRes(res, "This Product Type already exists.", 400);

    const id = await ptService.createProductType(name, slug);
    return successRes(res, "Product Type created successfully", { insertId: id }, null, 201);
});

/**
 * Get all Product Types with Search and Pagination
 */
const getAll = catchAsync(async (req, res) => {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Extract sort parameters with defaults
    const sortBy = req.query.sortBy || "pt_id";
    const sortOrder = req.query.sortOrder || "DESC";

    const { data, meta } = await ptService.getAllProductTypes(
        search, page, limit, sortBy, sortOrder
    );
    
    return successRes(res, "Product Types fetched successfully", data, meta);
});

/**
 * Update a Product Type by ID
 */
const update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Name is required", 400);

    let slug = generateSlug(name);

    // Ensure the new name/slug doesn't conflict with other records
    const exists = await ptService.checkSlugExists(slug, id);
    if (exists) return errorRes(res, "Name already taken by another product type.", 400);

    const affectedRows = await ptService.updateProductType(id, name, slug);
    if (affectedRows === 0) return errorRes(res, "Product Type not found", 404);

    return successRes(res, "Product Type updated successfully");
});

/**
 * Soft Delete a Product Type by ID
 */
const deleteType = catchAsync(async (req, res) => {
    const { id } = req.params;

    const affectedRows = await ptService.deleteProductType(id);
    if (affectedRows === 0) return errorRes(res, "Product Type not found", 404);

    return successRes(res, "Product Type deleted successfully");
});

// Bulk export
module.exports = { 
    create, 
    getAll, 
    update, 
    delete: deleteType 
};