const weightService = require('../services/weight.service');
const generateSlug = require('../utils/generateSlug');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const create = catchAsync(async (req, res) => {
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Weight name is required", 400);

    let slug = generateSlug(name);

    const exists = await weightService.checkSlugExists(slug);
    if (exists) return errorRes(res, "This Weight already exists", 400);

    const id = await weightService.createWeight(name, slug);
    return successRes(res, "Weight created successfully", { insertId: id }, null, 201);
});

const getAll = catchAsync(async (req, res) => {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "wt_id";
    const sortOrder = req.query.sortOrder || "DESC";

    const { data, meta } = await weightService.getAllWeights(
        search, page, limit, sortBy, sortOrder
    );
    
    return successRes(res, "Weights fetched successfully", data, meta);
});

const update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) return errorRes(res, "Weight name is required", 400);

    let slug = generateSlug(name);

    const exists = await weightService.checkSlugExists(slug, id);
    if (exists) return errorRes(res, "Name already taken by another weight", 400);

    const affectedRows = await weightService.updateWeight(id, name, slug);
    if (affectedRows === 0) return errorRes(res, "Weight not found", 404);

    return successRes(res, "Weight updated successfully");
});

const deleteWeight = catchAsync(async (req, res) => {
    const { id } = req.params;

    const affectedRows = await weightService.deleteWeight(id);
    if (affectedRows === 0) return errorRes(res, "Weight not found", 404);

    return successRes(res, "Weight deleted successfully");
});

module.exports = { 
    create, 
    getAll, 
    update, 
    delete: deleteWeight 
};