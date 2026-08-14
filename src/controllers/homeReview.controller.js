const homeReviewService = require('../services/homeReview.service');

exports.getSettings = async (req, res) => {
  try {
    const data = await homeReviewService.getSettings();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error getting home review settings:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const data = await homeReviewService.upsertSettings(req.body);
    res.status(200).json({ success: true, message: "Settings updated successfully", data });
  } catch (error) {
    console.error("Error updating home review settings:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const { viewMode } = req.query;
    const data = await homeReviewService.getAllReviews(viewMode);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error getting all home reviews:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getPublicData = async (req, res) => {
  try {
    const data = await homeReviewService.getPublicData();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error getting public home reviews:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.createReview = async (req, res) => {
  try {
    const data = req.body;
    if (req.file) {
      data.customer_image = `${req.protocol}://${req.get('host')}/uploads/home-reviews/${req.file.filename}`;
    }
    const newReview = await homeReviewService.createReview(data);
    res.status(201).json({ success: true, message: "Review created successfully", data: newReview });
  } catch (error) {
    console.error("Error creating home review:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.bulkCreateReviews = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    }
    const imagePaths = req.files.map(file => `${req.protocol}://${req.get('host')}/uploads/home-reviews/${file.filename}`);
    const createdReviews = await homeReviewService.bulkCreateReviews(imagePaths);
    res.status(201).json({ success: true, message: "Reviews created successfully", data: createdReviews });
  } catch (error) {
    console.error("Error bulk creating home reviews:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    if (req.file) {
      data.customer_image = `${req.protocol}://${req.get('host')}/uploads/home-reviews/${req.file.filename}`;
    }
    const updatedReview = await homeReviewService.updateReview(id, data);
    res.status(200).json({ success: true, message: "Review updated successfully", data: updatedReview });
  } catch (error) {
    console.error("Error updating home review:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.softDeleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    await homeReviewService.softDeleteReview(id);
    res.status(200).json({ success: true, message: "Review moved to trash" });
  } catch (error) {
    console.error("Error deleting home review:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.restoreReview = async (req, res) => {
  try {
    const { id } = req.params;
    await homeReviewService.restoreReview(id);
    res.status(200).json({ success: true, message: "Review restored successfully" });
  } catch (error) {
    console.error("Error restoring home review:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
