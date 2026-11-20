// Public address of the site (no trailing slash), used for absolute links in
// emails, link previews and the sitemap.
const appUrl = () =>
  (process.env.APP_URL || (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim()).replace(/\/$/, '');

module.exports = appUrl;
