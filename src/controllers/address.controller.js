const addressService = require('../services/address.service');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

// req.user is set by optionalAuth middleware (server.js) from a verified
// JWT — null for guests, never trusted from the request body/query anymore
// (a client could otherwise just claim to be any user_id it liked).
const getUserId = (req) => req.user?.user_id || null;

const getAll = catchAsync(async (req, res) => {
    const userId = getUserId(req);
    // Guests have no saved-address book on the server — they keep their
    // address in localStorage on the frontend instead. Return an empty list
    // rather than querying with a null user_id.
    if (!userId) return successRes(res, "Addresses fetched successfully", []);

    const data = await addressService.getAllAddresses(userId);
    return successRes(res, "Addresses fetched successfully", data);
});

const create = catchAsync(async (req, res) => {
    const userId = getUserId(req);
    // user_addresses.user_id is a FOREIGN KEY into `users`, so a guest
    // (no userId) can never be inserted here — that's what was throwing
    // ER_NO_REFERENCED_ROW_2. Guests should save their address client-side
    // (localStorage) instead of calling this endpoint.
    if (!userId) return errorRes(res, "Sign in to save an address to your account.", 401);

    const { fullName, mobile, house, street, city, state, postalCode } = req.body;

    if (!fullName) return errorRes(res, "Full name is required", 400);
    if (!mobile) return errorRes(res, "Mobile number is required", 400);
    if (!house) return errorRes(res, "House/Building is required", 400);
    if (!street) return errorRes(res, "Street/Locality is required", 400);
    if (!city) return errorRes(res, "City is required", 400);
    if (!state) return errorRes(res, "State is required", 400);
    if (!postalCode) return errorRes(res, "Postal code is required", 400);

    try {
        const id = await addressService.createAddress(userId, req.body);
        return successRes(res, "Address saved successfully", { insertId: id }, null, 201);
    } catch (err) {
        if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
            return errorRes(res, "User account not found or session invalid. Please sign in again.", 401);
        }
        throw err;
    }
});

const update = catchAsync(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return errorRes(res, "Sign in to update an address.", 401);

    const { id } = req.params;
    const { fullName, mobile, house, street, city, state, postalCode } = req.body;

    if (!fullName || !mobile || !house || !street || !city || !state || !postalCode) {
        return errorRes(res, "All required address fields must be provided", 400);
    }

    try {
        const affectedRows = await addressService.updateAddress(userId, id, req.body);
        if (affectedRows === 0) return errorRes(res, "Address not found", 404);

        return successRes(res, "Address updated successfully", { address_id: id });
    } catch (err) {
        if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
            return errorRes(res, "User account not found or session invalid. Please sign in again.", 401);
        }
        throw err;
    }
});

const remove = catchAsync(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return errorRes(res, "Sign in to manage saved addresses.", 401);

    const { id } = req.params;

    const affectedRows = await addressService.deleteAddress(userId, id);
    if (affectedRows === 0) return errorRes(res, "Address not found", 404);

    return successRes(res, "Address deleted successfully");
});

module.exports = { getAll, create, update, delete: remove };