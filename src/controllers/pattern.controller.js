const patternService = require('../services/pattern.service');
const generateSlug = require('../utils/generateSlug');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const create = catchAsync(async (req, res) => {
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Pattern name is required", 400);

    let slug = generateSlug(name);

    const exists = await patternService.checkSlugExists(slug);
    if (exists) return errorRes(res, "This Pattern already exists", 400);

    const id = await patternService.createPattern(name, slug);
    return successRes(res, "Pattern created successfully", { insertId: id }, null, 201);
});

const getAll = catchAsync(async (req, res) => {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "pat_id";
    const sortOrder = req.query.sortOrder || "DESC";

    const { data, meta } = await patternService.getAllPatterns(
        search, page, limit, sortBy, sortOrder
    );
    
    return successRes(res, "Patterns fetched successfully", data, meta);
});

const update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Pattern name is required", 400);

    let slug = generateSlug(name);

    const exists = await patternService.checkSlugExists(slug, id);
    if (exists) return errorRes(res, "Name already taken by another pattern", 400);

    const affectedRows = await patternService.updatePattern(id, name, slug);
    if (affectedRows === 0) return errorRes(res, "Pattern not found", 404);

    return successRes(res, "Pattern updated successfully");
});

const deletePattern = catchAsync(async (req, res) => {
    const { id } = req.params;

    const affectedRows = await patternService.deletePattern(id);
    if (affectedRows === 0) return errorRes(res, "Pattern not found", 404);

    return successRes(res, "Pattern deleted successfully");
});

module.exports = { 
    create, 
    getAll, 
    update, 
    delete: deletePattern 
};