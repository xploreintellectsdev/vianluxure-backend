const styleService = require('../services/style.service');
const generateSlug = require('../utils/generateSlug');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const create = catchAsync(async (req, res) => {
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Style name is required", 400);

    let slug = generateSlug(name);

    const exists = await styleService.checkSlugExists(slug);
    if (exists) return errorRes(res, "This Style already exists", 400);

    const id = await styleService.createStyle(name, slug);
    return successRes(res, "Style created successfully", { insertId: id }, null, 201);
});

const getAll = catchAsync(async (req, res) => {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "sty_id";
    const sortOrder = req.query.sortOrder || "DESC";

    const { data, meta } = await styleService.getAllStyles(
        search, page, limit, sortBy, sortOrder
    );
    
    return successRes(res, "Styles fetched successfully", data, meta);
});

const update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Style name is required", 400);

    let slug = generateSlug(name);

    const exists = await styleService.checkSlugExists(slug, id);
    if (exists) return errorRes(res, "Name already taken by another style", 400);

    const affectedRows = await styleService.updateStyle(id, name, slug);
    if (affectedRows === 0) return errorRes(res, "Style not found", 404);

    return successRes(res, "Style updated successfully");
});

const deleteStyle = catchAsync(async (req, res) => {
    const { id } = req.params;

    const affectedRows = await styleService.deleteStyle(id);
    if (affectedRows === 0) return errorRes(res, "Style not found", 404);

    return successRes(res, "Style deleted successfully");
});

module.exports = { 
    create, 
    getAll, 
    update, 
    delete: deleteStyle 
};