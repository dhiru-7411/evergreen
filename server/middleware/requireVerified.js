const User = require('../models/User');
const { verificationRequired } = require('../services/mailer');

// Use after verifyToken on actions that publish content or affect others
// (posts, fixes, suggestions, requests, votes). Only enforced when email
// sending is configured. Reading and signing in never need it.
const requireVerified = async (req, res, next) => {
  if (!verificationRequired()) return next();
  const user = await User.findById(req.user.id).select('emailVerifiedAt');
  if (!user?.emailVerifiedAt) {
    return res.status(403).json({
      message: 'Please confirm your email address first. Check your inbox, or resend the link from your account page.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
  next();
};

module.exports = requireVerified;
