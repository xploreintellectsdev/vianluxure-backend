const colorService = require('../services/color.service');
const generateSlug = require('../utils/generateSlug');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const create = catchAsync(async (req, res) => {
    const { name, hexCode } = req.body; // hexCode added
    
    if (!name) return errorRes(res, "Color name is required", 400);
    if (!hexCode) return errorRes(res, "Hex code is required", 400);

    let slug = generateSlug(name);

    const exists = await colorService.checkSlugExists(slug);
    if (exists) return errorRes(res, "This Color already exists", 400);

    const id = await colorService.createColor(name, slug, hexCode);
    return successRes(res, "Color created successfully", { insertId: id }, null, 201);
});

const getAll = catchAsync(async (req, res) => {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "col_id";
    const sortOrder = req.query.sortOrder || "DESC";

    const { data, meta } = await colorService.getAllColors(
        search, page, limit, sortBy, sortOrder
    );
    
    return successRes(res, "Colors fetched successfully", data, meta);
});

const update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, hexCode } = req.body;
    
    if (!name) return errorRes(res, "Color name is required", 400);
    if (!hexCode) return errorRes(res, "Hex code is required", 400);

    let slug = generateSlug(name);

    const exists = await colorService.checkSlugExists(slug, id);
    if (exists) return errorRes(res, "Name already taken by another color", 400);

    const affectedRows = await colorService.updateColor(id, name, slug, hexCode);
    if (affectedRows === 0) return errorRes(res, "Color not found", 404);

    return successRes(res, "Color updated successfully");
});

const deleteColor = catchAsync(async (req, res) => {
    const { id } = req.params;

    const affectedRows = await colorService.deleteColor(id);
    if (affectedRows === 0) return errorRes(res, "Color not found", 404);

    return successRes(res, "Color deleted successfully");
});

module.exports = { 
    create, 
    getAll, 
    update, 
    delete: deleteColor 
};