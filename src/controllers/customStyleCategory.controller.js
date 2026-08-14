const CustomStyleCategoryService = require('../services/customStyleCategory.service');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const getAll = catchAsync(async (req, res) => {
    // If activeOnly is passed, return only active categories (useful for public UI)
    const { activeOnly } = req.query;
    let data;
    if (activeOnly === 'true') {
        data = await CustomStyleCategoryService.getActive();
    } else {
        data = await CustomStyleCategoryService.getAll();
    }
    return successRes(res, "Categories retrieved successfully", data);
});

const create = catchAsync(async (req, res) => {
    const { name, slug } = req.body;
    if (!name || !slug) {
        return errorRes(res, "Name and slug are required", 400);
    }
    try {
        const id = await CustomStyleCategoryService.create({ name, slug });
        return successRes(res, "Category created successfully", { id }, null, 201);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return errorRes(res, "A category with this slug already exists", 409);
        }
        throw error;
    }
});

const update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, slug, is_active } = req.body;
    
    try {
        const affected = await CustomStyleCategoryService.update(id, { name, slug, is_active });
        if (!affected) return errorRes(res, "Category not found", 404);
        return successRes(res, "Category updated successfully");
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return errorRes(res, "A category with this slug already exists", 409);
        }
        throw error;
    }
});

const remove = catchAsync(async (req, res) => {
    const { id } = req.params;
    const affected = await CustomStyleCategoryService.delete(id);
    if (!affected) return errorRes(res, "Category not found", 404);
    return successRes(res, "Category deleted successfully");
});

module.exports = {
    getAll,
    create,
    update,
    remove
};
