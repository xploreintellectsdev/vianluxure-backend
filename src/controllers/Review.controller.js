// src/controllers/review.controller.js
//
// req.user is populated (or set to null for guests) by the global
// optionalAuth middleware already mounted in server.js — no extra
// middleware needed here.
const ReviewService = require("../services/review.service");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ReviewController = {
  /**
   * POST /api/reviews
   */
  async createReview(req, res) {
    try {
      const customer_name = req.user?.name || (req.body.customer_name ? String(req.body.customer_name).trim() : "");
      const customer_email = req.user?.email || (req.body.customer_email ? String(req.body.customer_email).trim() : "");

      const errors = [];
      if (!req.body.fab_id || isNaN(Number(req.body.fab_id))) {
        errors.push("fab_id is required and must be a number.");
      }
      
      // If we don't have a customer name, it means they are not logged in and didn't provide one.
      if (!customer_name || !customer_email) {
        return res.status(401).json({ success: false, message: "Please log in to leave a review." });
      }
      
      if (!EMAIL_RE.test(customer_email)) {
        errors.push("A valid customer_email is required.");
      }
      if (
        req.body.rating === undefined ||
        req.body.rating === null ||
        isNaN(Number(req.body.rating)) ||
        Number(req.body.rating) < 1 ||
        Number(req.body.rating) > 5
      ) {
        errors.push("rating is required and must be between 1 and 5.");
      }
      if (!req.body.review_text || !String(req.body.review_text).trim()) {
        errors.push("review_text is required.");
      }

      if (errors.length) {
        return res.status(400).json({ success: false, message: errors.join(" ") });
      }

      const rev_id = await ReviewService.create({
        fab_id: Number(req.body.fab_id),
        customer_name,
        customer_email,
        rating: Number(req.body.rating),
        review_title: req.body.review_title ? String(req.body.review_title).trim() : null,
        review_text: String(req.body.review_text).trim(),
        review_image_url: req.body.review_image_url || null,
      });

      const created = await ReviewService.findById(rev_id);

      return res.status(201).json({
        success: true,
        message: "Review submitted",
        review: created,
      });
    } catch (err) {
      console.error("createReview error:", err);
      return res.status(500).json({ success: false, message: "Failed to submit review." });
    }
  },

  /**
   * GET /api/reviews/:fabricId
   */
  async getReviewsByFabric(req, res) {
    try {
      const fab_id = Number(req.params.fabricId);
      if (!fab_id || isNaN(fab_id)) {
        return res.status(400).json({ success: false, message: "Invalid fabricId." });
      }

      const [reviews, summary] = await Promise.all([
        ReviewService.findByFabricId(fab_id),
        ReviewService.getRatingSummary(fab_id),
      ]);

      return res.status(200).json({ success: true, reviews, summary });
    } catch (err) {
      console.error("getReviewsByFabric error:", err);
      return res.status(500).json({ success: false, message: "Failed to fetch reviews." });
    }
  },

  /**
   * DELETE /api/reviews/:id (soft delete)
   */
  async deleteReview(req, res) {
    try {
      const rev_id = Number(req.params.id);
      if (!rev_id || isNaN(rev_id)) {
        return res.status(400).json({ success: false, message: "Invalid review id." });
      }

      const deleted = await ReviewService.softDelete(rev_id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: "Review not found." });
      }

      return res.status(200).json({ success: true, message: "Review deleted." });
    } catch (err) {
      console.error("deleteReview error:", err);
      return res.status(500).json({ success: false, message: "Failed to delete review." });
    }
  },

  /**
   * GET /api/reviews/admin
   * Fetch all reviews (paginated, sortable, searchable, optional fab_id filter).
   */
  async getAllForAdmin(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const search = req.query.search || "";
      const fab_id = req.query.fab_id || null;
      const offset = (page - 1) * limit;

      const { rows, total } = await ReviewService.getAllForAdmin({ search, limit, offset, fab_id });

      return res.status(200).json({ success: true, data: rows, meta: { total } });
    } catch (err) {
      console.error("getAllForAdmin error:", err);
      return res.status(500).json({ success: false, message: "Failed to fetch admin reviews." });
    }
  },

  /**
   * PUT /api/reviews/:id
   */
  async updateReview(req, res) {
    try {
      const rev_id = Number(req.params.id);
      if (!rev_id || isNaN(rev_id)) {
        return res.status(400).json({ success: false, message: "Invalid review id." });
      }

      const data = {};
      if (req.body.is_approved !== undefined) {
        data.is_approved = Boolean(req.body.is_approved);
      }
      if (req.body.rating !== undefined) {
        const r = Number(req.body.rating);
        if (!isNaN(r) && r >= 1 && r <= 5) {
          data.rating = r;
        } else {
          return res.status(400).json({ success: false, message: "Invalid rating value." });
        }
      }
      if (req.body.review_title !== undefined) {
        data.review_title = String(req.body.review_title).trim();
      }
      if (req.body.review_text !== undefined) {
        data.review_text = String(req.body.review_text).trim();
        if (!data.review_text) {
          return res.status(400).json({ success: false, message: "Review text cannot be empty." });
        }
      }
      if (req.body.review_image_url !== undefined) {
        data.review_image_url = req.body.review_image_url;
      }

      const updated = await ReviewService.update(rev_id, data);
      if (!updated) {
        return res.status(404).json({ success: false, message: "Review not found or no changes provided." });
      }

      return res.status(200).json({ success: true, message: "Review updated successfully." });
    } catch (err) {
      console.error("updateReview error:", err);
      return res.status(500).json({ success: false, message: "Failed to update review." });
    }
  }
};

module.exports = ReviewController;