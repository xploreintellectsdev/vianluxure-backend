const monogramService = require("../services/monogram.service");

const parseBoolean = (val, defaultVal = true) => {
    if (val === undefined || val === null) return defaultVal;
    if (typeof val === 'string') return val.trim().toLowerCase() === 'true' || val === '1';
    return Boolean(val);
};

const parseNumber = (val, defaultVal = 0) => {
    const num = parseFloat(val);
    return isNaN(num) ? defaultVal : num;
};

// ========================
// Placements
// ========================
const getAdminPlacements = async (req, res) => {
    try {
        const data = await monogramService.getPlacements(false);
        res.status(200).json({ success: true, message: "Placements fetched successfully.", data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getPublicPlacements = async (req, res) => {
    try {
        const data = await monogramService.getPlacements(true);
        res.status(200).json({ success: true, message: "Placements fetched successfully.", data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getPlacementById = async (req, res) => {
    try {
        const data = await monogramService.getPlacementById(req.params.id);
        res.status(200).json({ success: true, message: "Placement fetched successfully.", data });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

const createPlacement = async (req, res) => {
    try {
        const { placement_name, extra_price, is_active } = req.body;
        const nameTrimmed = placement_name?.trim();

        if (!nameTrimmed) {
            return res.status(400).json({ success: false, message: "Placement Name required" });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Image required" });
        }

        const data = await monogramService.createPlacement({
            placement_name: nameTrimmed,
            placement_image: `/uploads/monogram_placements/${req.file.filename}`,
            extra_price: parseNumber(extra_price, 0),
            is_active: parseBoolean(is_active)
        });

        res.status(201).json({ success: true, message: "Placement created successfully.", data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updatePlacement = async (req, res) => {
    try {
        const { placement_name, extra_price, is_active } = req.body;
        const nameTrimmed = placement_name?.trim();

        if (!nameTrimmed) {
            return res.status(400).json({ success: false, message: "Placement Name required" });
        }

        const updateData = {
            placement_name: nameTrimmed,
            placement_image: req.file ? `/uploads/monogram_placements/${req.file.filename}` : null,
            extra_price: parseNumber(extra_price, 0),
            is_active: parseBoolean(is_active)
        };

        const data = await monogramService.updatePlacement(req.params.id, updateData);
        res.status(200).json({ success: true, message: "Placement updated successfully.", data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const deletePlacement = async (req, res) => {
    try {
        await monogramService.deletePlacement(req.params.id);
        res.status(200).json({ success: true, message: "Placement deleted successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ========================
// Colors
// ========================
const getAdminColors = async (req, res) => {
    try {
        const data = await monogramService.getColors(false);
        res.status(200).json({ success: true, message: "Colors fetched successfully.", data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getPublicColors = async (req, res) => {
    try {
        const data = await monogramService.getColors(true);
        res.status(200).json({ success: true, message: "Colors fetched successfully.", data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getColorById = async (req, res) => {
    try {
        const data = await monogramService.getColorById(req.params.id);
        res.status(200).json({ success: true, message: "Color fetched successfully.", data });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

const createColor = async (req, res) => {
    try {
        const { color_name, is_active } = req.body;
        const nameTrimmed = color_name?.trim();

        if (!nameTrimmed) {
            return res.status(400).json({ success: false, message: "Color Name required" });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Image required" });
        }

        const data = await monogramService.createColor({
            color_name: nameTrimmed,
            color_image: `/uploads/monogram_colors/${req.file.filename}`,
            is_active: parseBoolean(is_active)
        });

        res.status(201).json({ success: true, message: "Color created successfully.", data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateColor = async (req, res) => {
    try {
        const { color_name, is_active } = req.body;
        const nameTrimmed = color_name?.trim();

        if (!nameTrimmed) {
            return res.status(400).json({ success: false, message: "Color Name required" });
        }

        const updateData = {
            color_name: nameTrimmed,
            color_image: req.file ? `/uploads/monogram_colors/${req.file.filename}` : null,
            is_active: parseBoolean(is_active)
        };

        const data = await monogramService.updateColor(req.params.id, updateData);
        res.status(200).json({ success: true, message: "Color updated successfully.", data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const deleteColor = async (req, res) => {
    try {
        await monogramService.deleteColor(req.params.id);
        res.status(200).json({ success: true, message: "Color deleted successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ========================
// Fonts
// ========================
const getAdminFonts = async (req, res) => {
    try {
        const data = await monogramService.getFonts(false);
        res.status(200).json({ success: true, message: "Fonts fetched successfully.", data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getPublicFonts = async (req, res) => {
    try {
        const data = await monogramService.getFonts(true);
        res.status(200).json({ success: true, message: "Fonts fetched successfully.", data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getFontById = async (req, res) => {
    try {
        const data = await monogramService.getFontById(req.params.id);
        res.status(200).json({ success: true, message: "Font fetched successfully.", data });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

const createFont = async (req, res) => {
    try {
        const { font_name, is_active } = req.body;
        const nameTrimmed = font_name?.trim();

        if (!nameTrimmed) {
            return res.status(400).json({ success: false, message: "Font Name required" });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Preview Image required" });
        }

        const data = await monogramService.createFont({
            font_name: nameTrimmed,
            font_preview_image: `/uploads/monogram_fonts/${req.file.filename}`,
            is_active: parseBoolean(is_active)
        });

        res.status(201).json({ success: true, message: "Font created successfully.", data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateFont = async (req, res) => {
    try {
        const { font_name, is_active } = req.body;
        const nameTrimmed = font_name?.trim();

        if (!nameTrimmed) {
            return res.status(400).json({ success: false, message: "Font Name required" });
        }

        const updateData = {
            font_name: nameTrimmed,
            font_preview_image: req.file ? `/uploads/monogram_fonts/${req.file.filename}` : null,
            is_active: parseBoolean(is_active)
        };

        const data = await monogramService.updateFont(req.params.id, updateData);
        res.status(200).json({ success: true, message: "Font updated successfully.", data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const deleteFont = async (req, res) => {
    try {
        await monogramService.deleteFont(req.params.id);
        res.status(200).json({ success: true, message: "Font deleted successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAdminPlacements,
    getPublicPlacements,
    getPlacementById,
    createPlacement,
    updatePlacement,
    deletePlacement,
    getAdminColors,
    getPublicColors,
    getColorById,
    createColor,
    updateColor,
    deleteColor,
    getAdminFonts,
    getPublicFonts,
    getFontById,
    createFont,
    updateFont,
    deleteFont
};
