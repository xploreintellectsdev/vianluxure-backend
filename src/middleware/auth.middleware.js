// src/middleware/auth.middleware.js
const jwt = require("jsonwebtoken");

// Blocks the request unless a valid Bearer JWT is present.
// (Same secret/shape as optionalauth.middleware.js — just not optional.)
const authenticateToken = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication token is required." });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};

module.exports = { authenticateToken };