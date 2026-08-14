const originService = require('../services/origin.service');
const generateSlug = require('../utils/generateSlug');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const create = catchAsync(async (req, res) => {
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Origin name is required", 400);

    let slug = generateSlug(name);

    const exists = await originService.checkSlugExists(slug);
    if (exists) return errorRes(res, "This Origin already exists", 400);

    const id = await originService.createOrigin(name, slug);
    return successRes(res, "Origin created successfully", { insertId: id }, null, 201);
});

const getAll = catchAsync(async (req, res) => {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "org_id";
    const sortOrder = req.query.sortOrder || "DESC";

    const { data, meta } = await originService.getAllOrigins(
        search, page, limit, sortBy, sortOrder
    );
    
    return successRes(res, "Origins fetched successfully", data, meta);
});

const update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Origin name is required", 400);

    let slug = generateSlug(name);

    const exists = await originService.checkSlugExists(slug, id);
    if (exists) return errorRes(res, "Name already taken by another origin", 400);

    const affectedRows = await originService.updateOrigin(id, name, slug);
    if (affectedRows === 0) return errorRes(res, "Origin not found", 404);

    return successRes(res, "Origin updated successfully");
});

const deleteOrigin = catchAsync(async (req, res) => {
    const { id } = req.params;

    const affectedRows = await originService.deleteOrigin(id);
    if (affectedRows === 0) return errorRes(res, "Origin not found", 404);

    return successRes(res, "Origin deleted successfully");
});

module.exports = { 
    create, 
    getAll, 
    update, 
    delete: deleteOrigin 
};