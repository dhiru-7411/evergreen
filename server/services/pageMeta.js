// Titles, descriptions and preview images for shareable pages.
//
// Link-preview bots (LinkedIn, Slack, WhatsApp, X, Discord...) don't run
// JavaScript, so the single-page app can't tell them what a page is about.
// The host forwards bot requests to /api/og, which answers with a tiny HTML
// page carrying Open Graph and Twitter tags built from the database.
const mongoose = require('mongoose');
const Topic = require('../models/Topic');
const Post = require('../models/Post');
const User = require('../models/User');
const LearningPath = require('../models/LearningPath');
const appUrl = require('../utils/appUrl');

const SITE = 'Evergreen';
const DEFAULT = {
  title: "Evergreen: learn what's current",
  description:
    'Live versions, the alternatives worth knowing, and step-by-step learning paths built from official docs, with every fact cited.',
};
const STATUS_TEXT = {
  fresh: 'Up to date with current versions.',
  aging: 'Newer major versions are out; mostly still applies.',
  stale: 'Written for older versions; may not work as written.',
};

const clip = (s, n = 200) => {
  const text = String(s || '').replace(/\s+/g, ' ').trim();
  return text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text;
};

const formatDate = (d) => new Date(d).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });

async function topicMeta(slug) {
  const topic = await Topic.findOne({ slug }).lean();
  if (!topic) return null;
  const primary = topic.live?.packages?.find((p) => p.name === topic.packages[0]);
  const path = await LearningPath.exists({ topic: topic._id, status: 'published' });
  const facts = [];
  if (primary?.version) {
    facts.push(`Latest: v${primary.version}${primary.publishedAt ? ` (${formatDate(primary.publishedAt)})` : ''}.`);
  }
  if (path) facts.push('Step-by-step learning path from the official docs.');
  if (topic.alternatives?.length) facts.push(`Alternatives: ${topic.alternatives.map((a) => a.name).slice(0, 4).join(', ')}.`);
  return {
    title: `Learn ${topic.name}${primary?.version ? ` ${primary.version.split('.')[0]}` : ''} | ${SITE}`,
    description: clip(`${topic.summary || primary?.description || ''} ${facts.join(' ')}`),
  };
}

async function postMeta(key) {
  const filter = mongoose.isValidObjectId(key) && /^[a-f0-9]{24}$/i.test(key) ? { _id: key } : { slug: key.toLowerCase() };
  const post = await Post.findOne(filter).select('title excerpt slug freshness author createdAt lastRevisedAt').populate('author', 'username').lean();
  if (!post) return null;
  const status = STATUS_TEXT[post.freshness?.status];
  return {
    title: `${post.title} | ${SITE}`,
    description: clip(`${status ? `${status} ` : ''}${post.excerpt || ''}`),
    type: 'article',
    canonicalPath: `/posts/${post.slug || post._id}`,
    author: post.author?.username,
    published: post.createdAt,
    modified: post.lastRevisedAt,
  };
}

async function profileMeta(username) {
  const user = await User.findOne({ username: new RegExp(`^${username.replace(/[^a-zA-Z0-9_-]/g, '')}$`, 'i') })
    .select('username')
    .lean();
  if (!user) return null;
  const posts = await Post.countDocuments({ author: user._id });
  return {
    title: `@${user.username} | ${SITE}`,
    description: `${posts} ${posts === 1 ? 'tutorial' : 'tutorials'} on Evergreen, checked for freshness against the latest package versions.`,
    type: 'profile',
  };
}

// Resolves a site path ("/learn/react", "/posts/my-post") to its metadata.
async function metaForPath(rawPath) {
  const path = String(rawPath || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  let meta = null;
  let m;
  if (path === '/learn') {
    meta = {
      title: `Learn what's current | ${SITE}`,
      description:
        'Core software topics with live versions, alternatives, cited sources and learning paths from official docs.',
    };
  } else if (path === '/learn/requests') {
    meta = { title: `Requested topics | ${SITE}`, description: 'Vote for what Evergreen should cover next.' };
  } else if ((m = path.match(/^\/learn\/([a-z0-9-]+)$/))) {
    meta = await topicMeta(m[1]);
  } else if ((m = path.match(/^\/posts\/([A-Za-z0-9-]+)$/))) {
    meta = await postMeta(m[1]);
  } else if ((m = path.match(/^\/u\/([A-Za-z0-9_-]+)$/))) {
    meta = await profileMeta(m[1]);
  }
  const base = appUrl();
  const resolved = { ...DEFAULT, type: 'website', ...(meta || {}) };
  return {
    ...resolved,
    url: `${base}${resolved.canonicalPath || (path === '/' ? '' : path)}`,
    image: `${base}/og-default.png`,
    found: Boolean(meta) || path === '/',
  };
}

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function renderMetaPage(meta) {
  const e = escapeHtml;
  const tags = [
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}">`,
    `<link rel="canonical" href="${e(meta.url)}">`,
    `<meta property="og:site_name" content="${SITE}">`,
    `<meta property="og:type" content="${e(meta.type)}">`,
    `<meta property="og:title" content="${e(meta.title)}">`,
    `<meta property="og:description" content="${e(meta.description)}">`,
    `<meta property="og:url" content="${e(meta.url)}">`,
    `<meta property="og:image" content="${e(meta.image)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${SITE}: learn what's current">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${e(meta.title)}">`,
    `<meta name="twitter:description" content="${e(meta.description)}">`,
    `<meta name="twitter:image" content="${e(meta.image)}">`,
  ];
  if (meta.type === 'article') {
    if (meta.author) tags.push(`<meta property="article:author" content="${e(meta.author)}">`);
    if (meta.published) tags.push(`<meta property="article:published_time" content="${new Date(meta.published).toISOString()}">`);
    if (meta.modified) tags.push(`<meta property="article:modified_time" content="${new Date(meta.modified).toISOString()}">`);
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${tags.join('\n')}
</head>
<body>
<h1>${e(meta.title)}</h1>
<p>${e(meta.description)}</p>
<p><a href="${e(meta.url)}">Open on ${SITE}</a></p>
</body>
</html>
`;
}

module.exports = { metaForPath, renderMetaPage, escapeHtml };
