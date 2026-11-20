// Cross-site request forgery protection for cookie-authenticated requests.
//
// Cookies are SameSite=Lax, so browsers already withhold them from most
// cross-site requests. As a second layer, any state-changing request that a
// browser marks as cross-site, or that comes from an origin not on the
// allow-list, is refused. Requests with no Origin (curl, server-to-server,
// tests) carry no browser cookies to abuse and pass through.
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

const originCheck = (allowedOrigins) => (req, res, next) => {
  if (SAFE.has(req.method)) return next();
  if (req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ message: 'Cross-site requests are not allowed' });
  }
  const origin = req.get('origin');
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ message: 'Request origin not allowed' });
  }
  next();
};

module.exports = originCheck;
