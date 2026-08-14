// src/routes/review.routes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const ReviewController = require("../controllers/Review.controller");

// Self-contained upload config so this route doesn't depend on the
// internals of any other upload route. Saves to src/uploads/reviews/,
// which is already served statically at /uploads via server.js
// (app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')))).
const uploadDir = path.join(__dirname, "..", "uploads", "reviews");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
});

router.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image uploaded." });
  }
  // Absolute URL, matching how other uploads (e.g. fabric images) are
  // stored — a relative path resolves against the Next.js origin in the
  // browser, not the Express origin, which is why images 404'd.
  const url = `${req.protocol}://${req.get("host")}/uploads/reviews/${req.file.filename}`;
  res.status(201).json({ success: true, url });
});

router.get("/admin", ReviewController.getAllForAdmin);
router.post("/", ReviewController.createReview);
router.get("/:fabricId", ReviewController.getReviewsByFabric);
router.put("/:id", ReviewController.updateReview);
router.delete("/:id", ReviewController.deleteReview);

module.exports = router;