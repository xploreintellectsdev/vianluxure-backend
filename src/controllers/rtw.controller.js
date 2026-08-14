const rtwService = require('../services/rtw.service');
const generateSlug = require('../utils/generateSlug');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const { deleteFiles } = require('../middleware/upload.middleware');

const toBoolInt = (v) => (v === true || v === 'true' || v === '1' || v === 1 ? 1 : 0);

const create = catchAsync(async (req, res) => {
    const { fab_id, name, price, shortDesc, isNewArrival, isBestSeller, stock_quantity } = req.body;

    if (!name || !price || !fab_id) {
        deleteFiles(req.files);
        return errorRes(res, "Fabric ID, Name, and Price are required", 400);
    }

    const slug = generateSlug(name);
    if (await rtwService.checkSlugExists(slug)) {
        deleteFiles(req.files);
        return errorRes(res, "Ready To Wear slug already exists", 400);
    }

    const rtwData = {
        fab_id, name, slug, price, shortDesc,
        isNewArrival: toBoolInt(isNewArrival),
        isBestSeller: toBoolInt(isBestSeller),
        coverImage: req.files?.coverImage ? `/uploads/rtw/${req.files.coverImage[0].filename}` : null,
        stock_quantity: stock_quantity !== undefined && stock_quantity !== null && stock_quantity !== '' ? parseFloat(stock_quantity) : 0
    };

    const galleryImages = req.files?.galleryImages?.map(f => `/uploads/rtw/${f.filename}`) || [];

    try {
        const id = await rtwService.createRTW(rtwData, galleryImages);
        return successRes(res, "Ready To Wear created successfully", { rtw_id: id }, null, 201);
    } catch (error) {
        deleteFiles(req.files);
        throw error;
    }
});

const getAll = catchAsync(async (req, res) => {
    const { search = "", page = 1, limit = 10, sortBy = "rtw_id", sortOrder = "DESC" } = req.query;
    const { data, meta } = await rtwService.findAllRTW(search, page, limit, sortBy, sortOrder);
    return successRes(res, "Ready To Wear retrieved", data, meta);
});

const getById = catchAsync(async (req, res) => {
    const data = await rtwService.findOneRTW(req.params.id);
    if (!data) return errorRes(res, "Item not found", 404);
    return successRes(res, "Item retrieved", data);
});

const update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { fab_id, name, price, shortDesc, isNewArrival, isBestSeller, stock_quantity } = req.body;

    const slug = generateSlug(name);
    if (await rtwService.checkSlugExists(slug, id)) {
        deleteFiles(req.files);
        return errorRes(res, "Slug already exists", 400);
    }

    const rtwData = {
        fab_id, name, price, shortDesc,
        isNewArrival: toBoolInt(isNewArrival),
        isBestSeller: toBoolInt(isBestSeller),
        coverImage: req.files?.coverImage ? `/uploads/rtw/${req.files.coverImage[0].filename}` : null,
        stock_quantity: stock_quantity !== undefined && stock_quantity !== null && stock_quantity !== '' ? parseFloat(stock_quantity) : 0
    };

    const galleryImages = req.files?.galleryImages?.map(f => `/uploads/rtw/${f.filename}`) || [];

    try {
        await rtwService.updateRTW(id, rtwData, galleryImages);
        return successRes(res, "Item updated successfully");
    } catch (error) {
        deleteFiles(req.files);
        throw error;
    }
});

const remove = catchAsync(async (req, res) => {
    const affected = await rtwService.removeRTW(req.params.id);
    if (affected === 0) return errorRes(res, "Item not found", 404);
    return successRes(res, "Item removed successfully");
});

module.exports = { create, getAll, getById, update, delete: remove };