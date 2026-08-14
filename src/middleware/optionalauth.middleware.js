const jwt = require('jsonwebtoken');

// Attaches req.user when a valid Bearer token is present; otherwise leaves
// req.user as null so guest requests keep working exactly as before. This
// never blocks a request just for having no/invalid token — routes that
// require a signed-in user (e.g. address.controller.js's create/remove)
// check req.user themselves and return 401 there instead.
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  req.user = null;

  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      req.user = null; // expired/invalid token -> treat as guest
    }
  }

  next();
};

module.exports = optionalAuth;