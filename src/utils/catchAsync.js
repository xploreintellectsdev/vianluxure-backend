const { errorRes } = require('./response');

const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            console.error("🔥 Error caught in catchAsync:", err);
            // NOTE: this used to always send 500, even for things like "wrong
            // password" or "email already registered" — services can now set
            // `err.statusCode` (see auth.service.js) and it'll be honored here.
            return errorRes(res, err.message || "Internal Server Error", err.statusCode || 500, err);
        });
    };
};

module.exports = catchAsync;