const searchService = require('../services/search.service');
const { successRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const search = catchAsync(async (req, res) => {
    // Get 'q' from the URL (e.g., /api/search?q=cotton)
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
        return successRes(res, "Empty search", []);
    }

    const data = await searchService.searchFabrics(q.trim());
    return successRes(res, "Search results fetched successfully", data);
});

const getFilters = catchAsync(async (req, res) => {
    const data = await searchService.getFilters();
    return successRes(res, "Filters fetched successfully", data);
});

module.exports = { search, getFilters };