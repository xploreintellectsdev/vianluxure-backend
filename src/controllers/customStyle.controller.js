const customStyleService = require('../services/customStyle.service');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const { deleteFiles } = require('../middleware/upload.middleware');

const create = catchAsync(async (req, res) => {
    // ── FIX: Read 'type' from URL query (e.g., ?type=collar) ──
    const type = req.query.type || req.body.type;
    const { name, price } = req.body;

    if (!name || price === undefined || !type) {
        if (req.file) deleteFiles([req.file]);
        return errorRes(res, "Name, Price, and Option Type are required", 400);
    }

    const optionData = {
        type, name, price,
        image: req.file ? `/uploads/custom-styles/${req.file.filename}` : null
    };

    try {
        const id = await customStyleService.createOption(optionData);
        return successRes(res, "Style created successfully", { option_id: id }, null, 201);
    } catch (error) {
        if (req.file) deleteFiles([req.file]);
        throw error;
    }
});

const getAll = catchAsync(async (req, res) => {
    // ── FIX: Fetch filter type from query ──
    const { type, search = "", page = 1, limit = 10, sortBy = "option_id", sortOrder = "DESC" } = req.query;

    if (!type) {
        return errorRes(res, "Query parameter 'type' is required", 400);
    }

    const { data, meta } = await customStyleService.getAllOptions(type, search, page, limit, sortBy, sortOrder);
    return successRes(res, "Styles retrieved successfully", data, meta);
});

const getById = catchAsync(async (req, res) => {
    const data = await customStyleService.findOneOption(req.params.id);
    if (!data) return errorRes(res, "Style not found", 404);
    return successRes(res, "Style retrieved successfully", data);
});

const update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, price } = req.body;

    const optionData = {
        name, price,
        image: req.file ? `/uploads/custom-styles/${req.file.filename}` : null
    };

    try {
        const affected = await customStyleService.updateOption(id, optionData);
        if (affected === 0) {
            if (req.file) deleteFiles([req.file]);
            return errorRes(res, "Style not found", 404);
        }
        return successRes(res, "Style updated successfully");
    } catch (error) {
        if (req.file) deleteFiles([req.file]);
        throw error;
    }
});

const remove = catchAsync(async (req, res) => {
    const affected = await customStyleService.removeOption(req.params.id);
    if (affected === 0) return errorRes(res, "Style not found", 404);
    return successRes(res, "Style removed successfully");
});

module.exports = { create, getAll, getById, update, delete: remove };