const weaveService = require('../services/weave.service');
const generateSlug = require('../utils/generateSlug');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const create = catchAsync(async (req, res) => {
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Weave name is required", 400);

    let slug = generateSlug(name);

    const exists = await weaveService.checkSlugExists(slug);
    if (exists) return errorRes(res, "This Weave already exists", 400);

    const id = await weaveService.createWeave(name, slug);
    return successRes(res, "Weave created successfully", { insertId: id }, null, 201);
});

const getAll = catchAsync(async (req, res) => {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "wv_id";
    const sortOrder = req.query.sortOrder || "DESC";

    const { data, meta } = await weaveService.getAllWeaves(
        search, page, limit, sortBy, sortOrder
    );
    
    return successRes(res, "Weaves fetched successfully", data, meta);
});

const update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Weave name is required", 400);

    let slug = generateSlug(name);

    const exists = await weaveService.checkSlugExists(slug, id);
    if (exists) return errorRes(res, "Name already taken by another weave", 400);

    const affectedRows = await weaveService.updateWeave(id, name, slug);
    if (affectedRows === 0) return errorRes(res, "Weave not found", 404);

    return successRes(res, "Weave updated successfully");
});

const deleteWeave = catchAsync(async (req, res) => {
    const { id } = req.params;

    const affectedRows = await weaveService.deleteWeave(id);
    if (affectedRows === 0) return errorRes(res, "Weave not found", 404);

    return successRes(res, "Weave deleted successfully");
});

module.exports = { 
    create, 
    getAll, 
    update, 
    delete: deleteWeave 
};