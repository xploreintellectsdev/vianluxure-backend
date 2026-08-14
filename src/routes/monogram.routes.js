const express = require("express");
const monogramController = require("../controllers/monogram.controller");
const { uploadFile } = require("../middleware/upload.middleware");

const adminRoutes = express.Router();
const publicRoutes = express.Router();

const placementUpload = uploadFile("monogram_placements");
const colorUpload = uploadFile("monogram_colors");
const fontUpload = uploadFile("monogram_fonts");

const handleUpload = (uploader) => (req, res, next) => {
    uploader(req, res, (err) => {
        if (err) {
            console.error('MULTER ERROR:', err.message);
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        }
        next();
    });
};

// ========================
// Admin Routes
// Base: /api/admin/monogram
// ========================
adminRoutes.get("/placements", monogramController.getAdminPlacements);
adminRoutes.get("/placements/:id", monogramController.getPlacementById);
adminRoutes.post("/placements", handleUpload(placementUpload.single("placement_image")), monogramController.createPlacement);
adminRoutes.put("/placements/:id", handleUpload(placementUpload.single("placement_image")), monogramController.updatePlacement);
adminRoutes.delete("/placements/:id", monogramController.deletePlacement);

adminRoutes.get("/colors", monogramController.getAdminColors);
adminRoutes.get("/colors/:id", monogramController.getColorById);
adminRoutes.post("/colors", handleUpload(colorUpload.single("color_image")), monogramController.createColor);
adminRoutes.put("/colors/:id", handleUpload(colorUpload.single("color_image")), monogramController.updateColor);
adminRoutes.delete("/colors/:id", monogramController.deleteColor);

adminRoutes.get("/fonts", monogramController.getAdminFonts);
adminRoutes.get("/fonts/:id", monogramController.getFontById);
adminRoutes.post("/fonts", handleUpload(fontUpload.single("font_preview_image")), monogramController.createFont);
adminRoutes.put("/fonts/:id", handleUpload(fontUpload.single("font_preview_image")), monogramController.updateFont);
adminRoutes.delete("/fonts/:id", monogramController.deleteFont);

// ========================
// Public Routes
// Base: /api/monogram
// ========================
publicRoutes.get("/placements", monogramController.getPublicPlacements);
publicRoutes.get("/colors", monogramController.getPublicColors);
publicRoutes.get("/fonts", monogramController.getPublicFonts);

module.exports = {
    adminRoutes,
    publicRoutes
};
