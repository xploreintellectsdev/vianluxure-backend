const fabricService = require('../services/fabric.service');
const generateSlug = require('../utils/generateSlug');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const { deleteFiles } = require('../middleware/upload.middleware');

const toNullableInt = (v) => (v === undefined || v === null || v === '' ? null : v);
const toBoolInt = (v) => (v === true || v === 'true' || v === '1' || v === 1 ? 1 : 0);

const create = catchAsync(async (req, res) => {
    // ── FIX: Added RTW Checkboxes and GST / Stitching Charges to destructuring ──
    const { name, fc_id, org_id, wt_id, wv_id, pat_id, col_id, price, shortDesc, longDesc, disclaimer, isNewArrival, isBestSeller, rtwName, rtwPrice, rtwShortDesc, rtwIsNewArrival, rtwIsBestSeller, gst, stitching_charges, stock_quantity, rtwStock } = req.body;

    let styles = [], specifications = [], productTypes = [];
    try {
        if (req.body.styles) styles = JSON.parse(req.body.styles);
        if (req.body.specifications) specifications = JSON.parse(req.body.specifications);
        if (req.body.productTypes) productTypes = JSON.parse(req.body.productTypes);
    } catch (e) {
        deleteFiles(req.files);
        return errorRes(res, "Invalid JSON in styles, specifications, or productTypes", 400);
    }

    if (!name || !price || productTypes.length === 0) {
        deleteFiles(req.files);
        return errorRes(res, "Required fields are missing (Name, Price, or Product Type)", 400);
    }

    const slug = generateSlug(name);
    if (await fabricService.checkSlugExists(slug)) {
        deleteFiles(req.files);
        return errorRes(res, "Fabric slug already exists", 400);
    }

    if (!req.files?.coverImage) {
        deleteFiles(req.files);
        return errorRes(res, "Cover image is required", 400);
    }

    const fabricData = {
        name, slug, 
        fc_id: toNullableInt(fc_id),
        org_id: toNullableInt(org_id),
        wt_id: toNullableInt(wt_id),
        wv_id: toNullableInt(wv_id),
        pat_id: toNullableInt(pat_id),
        price, shortDesc, longDesc, disclaimer: disclaimer || null,
        groupCode: req.body.groupCode || null,
        gst: gst !== undefined && gst !== '' && gst !== null ? parseFloat(gst) : 0,
        stitching_charges: stitching_charges !== undefined && stitching_charges !== '' && stitching_charges !== null ? parseFloat(stitching_charges) : 0,
        isNewArrival: toBoolInt(isNewArrival),
        isBestSeller: toBoolInt(isBestSeller),
        coverImage: `/uploads/fabric/${req.files.coverImage[0].filename}`,
        
        // ── FIX: Added RTW Checkboxes to data object ──
        rtwName: rtwName || null,
        rtwPrice: rtwPrice || null,
        rtwShortDesc: rtwShortDesc || null,
        rtwCoverImage: req.files?.rtwCoverImage ? `/uploads/fabric/${req.files.rtwCoverImage[0].filename}` : null,
        rtwIsNewArrival: toBoolInt(rtwIsNewArrival),
        rtwIsBestSeller: toBoolInt(rtwIsBestSeller),
        stock_quantity: stock_quantity !== undefined && stock_quantity !== null && stock_quantity !== '' ? parseFloat(stock_quantity) : 0,
        rtwStock: rtwStock !== undefined && rtwStock !== null && rtwStock !== '' ? parseFloat(rtwStock) : 0
    };

    const galleryImages = req.files.galleryImages?.map(f => `/uploads/fabric/${f.filename}`) || [];
    
    // ── FIX: Capture RTW Gallery Images ──
    const rtwGalleryImages = req.files.rtwGalleryImages?.map(f => `/uploads/fabric/${f.filename}`) || [];

    try {
        const result = await fabricService.createFabric(fabricData, styles, specifications, galleryImages, productTypes, rtwGalleryImages);
        return successRes(res, "Fabric stored successfully", result, null, 201);
    } catch (error) {
        deleteFiles(req.files);
        throw error;
    }
});

const getAll = catchAsync(async (req, res) => {
    const { search = "", page = 1, limit = 10, sortBy = "fab_id", sortOrder = "DESC" } = req.query;
    const { data, meta } = await fabricService.findAllFabrics(search, page, limit, sortBy, sortOrder);
    return successRes(res, "Fabrics retrieved", data, meta);
});

const getById = catchAsync(async (req, res) => {
    const data = await fabricService.findOneFabric(req.params.id);
    if (!data) return errorRes(res, "Fabric not found", 404);
    return successRes(res, "Fabric retrieved", data);
});

const update = catchAsync(async (req, res) => {
    const { id } = req.params;
    // ── FIX: Added RTW Checkboxes and GST / Stitching Charges ──
    const { name, fc_id, org_id, wt_id, wv_id, pat_id, col_id, price, shortDesc, longDesc, disclaimer, isNewArrival, isBestSeller, rtwName, rtwPrice, rtwShortDesc, rtwIsNewArrival, rtwIsBestSeller, gst, stitching_charges, stock_quantity, rtwStock } = req.body;

    const slug = generateSlug(name);
    if (await fabricService.checkSlugExists(slug, id)) {
        deleteFiles(req.files);
        return errorRes(res, "Fabric slug already exists", 400);
    }

    let styles = req.body.styles ? JSON.parse(req.body.styles) : null;
    let specifications = req.body.specifications ? JSON.parse(req.body.specifications) : null;
    let productTypes = req.body.productTypes ? JSON.parse(req.body.productTypes) : null; 

    if (!name || !price || !productTypes || productTypes.length === 0) {
        deleteFiles(req.files);
        return errorRes(res, "Required fields are missing", 400);
    }

    const fabricData = {
        name, 
        fc_id: toNullableInt(fc_id),
        org_id: toNullableInt(org_id),
        wt_id: toNullableInt(wt_id),
        wv_id: toNullableInt(wv_id),
        pat_id: toNullableInt(pat_id),
        col_id: toNullableInt(col_id),
        price, shortDesc, longDesc, disclaimer: disclaimer || null,
        gst: gst !== undefined && gst !== '' && gst !== null ? parseFloat(gst) : 0,
        stitching_charges: stitching_charges !== undefined && stitching_charges !== '' && stitching_charges !== null ? parseFloat(stitching_charges) : 0,
        isNewArrival: toBoolInt(isNewArrival),
        isBestSeller: toBoolInt(isBestSeller),
        coverImage: req.files?.coverImage ? `/uploads/fabric/${req.files.coverImage[0].filename}` : null,
        
        // ── FIX: Added RTW Checkboxes ──
        rtwName: rtwName || null,
        rtwPrice: rtwPrice || null,
        rtwShortDesc: rtwShortDesc || null,
        rtwCoverImage: req.files?.rtwCoverImage ? `/uploads/fabric/${req.files.rtwCoverImage[0].filename}` : null,
        rtwIsNewArrival: toBoolInt(rtwIsNewArrival),
        rtwIsBestSeller: toBoolInt(rtwIsBestSeller),
        stock_quantity: stock_quantity !== undefined && stock_quantity !== null && stock_quantity !== '' ? parseFloat(stock_quantity) : 0,
        rtwStock: rtwStock !== undefined && rtwStock !== null && rtwStock !== '' ? parseFloat(rtwStock) : 0
    };

    const galleryImages = req.files?.galleryImages?.map(f => `/uploads/fabric/${f.filename}`) || [];
    
    // ── FIX: Capture RTW Gallery Images ──
    const rtwGalleryImages = req.files.rtwGalleryImages?.map(f => `/uploads/fabric/${f.filename}`) || [];

    try {
        await fabricService.updateFabric(id, fabricData, styles, specifications, galleryImages, productTypes, rtwGalleryImages);
        return successRes(res, "Fabric updated successfully");
    } catch (error) {
        deleteFiles(req.files);
        throw error;
    }
});

const getNewArrivals = catchAsync(async (req, res) => {
    const { limit = 10 } = req.query;
    const data = await fabricService.findByFlag('is_new_arrival', limit);
    return successRes(res, "New arrivals retrieved", data);
});

const getBestSellers = catchAsync(async (req, res) => {
    const { limit = 10 } = req.query;
    const data = await fabricService.findByFlag('is_best_seller', limit);
    return successRes(res, "Best sellers retrieved", data);
});

const remove = catchAsync(async (req, res) => {
    const affected = await fabricService.removeFabric(req.params.id);
    if (affected === 0) return errorRes(res, "Fabric not found", 404);
    return successRes(res, "Fabric removed successfully");
});

// ── ADD THIS RIGHT ABOVE module.exports ──
const getAvailableForRTW = catchAsync(async (req, res) => {
    const { search = "", page = 1, limit = 10, sortBy = "fab_id", sortOrder = "DESC" } = req.query;
    const { data, meta } = await fabricService.getAvailableFabricsForRTW(search, page, limit, sortBy, sortOrder);
    return successRes(res, "Available fabrics retrieved", data, meta);
});
module.exports = { create, getAll, getById, update, delete: remove, getNewArrivals, getBestSellers ,getAvailableForRTW};