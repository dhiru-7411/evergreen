// Link previews and search-engine files. The front-end host forwards bot
// requests for any page to /api/og, and /sitemap.xml and /robots.txt here.
const express = require('express');
const router = express.Router();
const Topic = require('../models/Topic');
const Post = require('../models/Post');
const appUrl = require('../utils/appUrl');
const { metaForPath, renderMetaPage, escapeHtml } = require('../services/pageMeta');

router.get('/og', async (req, res) => {
  const path = String(req.query.path || '/');
  if (!path.startsWith('/') || path.length > 300) return res.status(400).send('Bad path');
  const meta = await metaForPath(path);
  res
    .status(meta.found ? 200 : 404)
    .set('Cache-Control', 'public, max-age=600')
    .type('html')
    .send(renderMetaPage(meta));
});

router.get('/sitemap.xml', async (req, res) => {
  const base = appUrl();
  const [topics, posts] = await Promise.all([
    Topic.find().select('slug updatedAt').lean(),
    Post.find().select('slug _id lastRevisedAt updatedAt').lean(),
  ]);
  const url = (loc, lastmod) =>
    `  <url><loc>${escapeHtml(base + loc)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`;
  const entries = [
    url('/'),
    url('/learn'),
    url('/learn/requests'),
    ...topics.map((t) => url(`/learn/${t.slug}`, t.updatedAt)),
    ...posts.map((p) => url(`/posts/${p.slug || p._id}`, p.lastRevisedAt || p.updatedAt)),
  ];
  res
    .set('Cache-Control', 'public, max-age=3600')
    .type('application/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`);
});

router.get('/robots.txt', (req, res) => {
  const base = appUrl();
  res
    .type('text/plain')
    .send(
      `User-agent: *\nDisallow: /account\nDisallow: /inbox\nDisallow: /learn/review\nDisallow: /reset-password\nDisallow: /verify-email\n\nSitemap: ${base}/sitemap.xml\n`
    );
});

module.exports = router;
