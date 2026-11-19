const User = require('../models/User');

// Use after verifyToken. Reads the role from the database rather than the
// token, so promoting or demoting someone takes effect immediately.
const requireAdmin = async (req, res, next) => {
  const user = await User.findById(req.user.id).select('role');
  if (user?.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  next();
};

module.exports = requireAdmin;
