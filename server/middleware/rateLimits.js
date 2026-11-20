const { rateLimit } = require('express-rate-limit');

const common = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many requests, slow down a little' },
};

// Brute-force protection for login/register.
const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 20 });

// Freshness rechecks call the npm registry; keep them cheap.
const recheckLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 10 });

// Submitting a resource makes the server fetch a third-party page.
const submitLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: 15 });

// AI generation costs money; cap it even for admins.
const aiLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: 20 });

module.exports = { authLimiter, recheckLimiter, submitLimiter, aiLimiter };
