const { authenticate } = require('../services/sessions');

// Requires a signed-in user (access-token cookie for a live session).
const verifyToken = async (req, res, next) => {
  const user = await authenticate(req);
  if (!user) return res.status(401).json({ message: 'Not signed in or session expired' });
  req.user = user;
  next();
};

// For public routes that show extra detail to signed-in users.
const optionalAuth = async (req, res, next) => {
  const user = await authenticate(req);
  if (user) req.user = user;
  next();
};

module.exports = verifyToken;
module.exports.optionalAuth = optionalAuth;
