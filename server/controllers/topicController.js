const Topic = require('../models/Topic');
const Post = require('../models/Post');
const Resource = require('../models/Resource');
const HttpError = require('../utils/httpError');
const { getPackageInfo } = require('../services/packageInfo');
const { refreshTopic, isStale } = require('../services/topicService');
const { CATEGORIES } = require('../config/categories');
const { approvedResources, ownResources } = require('./resourceController');

const RELATED_POST_LIMIT = 20;
const STATUS_ORDER = { fresh: 0, aging: 1, untracked: 2, stale: 3 };

const snapshotFor = (topic, name) => {
  const snap = topic.live?.packages?.find((p) => p.name === name);
  if (!snap) return null;
  return typeof snap.toObject === 'function' ? snap.toObject() : snap;
};

const summarize = (topic) => ({
  _id: topic._id,
  name: topic.name,
  slug: topic.slug,
  category: topic.category,
  summary: topic.summary || snapshotFor(topic, topic.packages[0])?.description || '',
  packages: topic.packages,
  primary: snapshotFor(topic, topic.packages[0]),
  alternativeCount: topic.alternatives.length,
  checkedAt: topic.live?.checkedAt ?? null,
});

const listTopics = async (req, res) => {
  const topics = await Topic.find().sort({ name: 1 });
  res.json(topics.map(summarize));
};

const listCategories = (req, res) => res.json(CATEGORIES);

// Where every fact on the page comes from. Shown as numbered citations so
// readers can verify anything themselves.
function buildSources(topic) {
  const sources = [];
  for (const name of topic.allPackageNames()) {
    const p = snapshotFor(topic, name);
    if (!p?.found) continue;
    sources.push({
      id: `npm:${name}`,
      package: name,
      label: `npm registry: ${name}`,
      url: p.npmUrl,
      provides: 'latest version, description, license, links, deprecation notice, weekly downloads',
    });
    sources.push({
      id: `depsdev:${name}`,
      package: name,
      label: `deps.dev (Open Source Insights): ${name}@${p.version}`,
      url: `https://deps.dev/npm/${encodeURIComponent(name)}/${encodeURIComponent(p.version)}`,
      provides: 'release date, known security advisories',
    });
    if (topic.packages.includes(name) && p.homepage) {
      sources.push({ id: `docs:${name}`, package: name, label: `Official site: ${name}`, url: p.homepage, provides: 'official documentation' });
    }
    if (topic.packages.includes(name) && p.repository) {
      sources.push({ id: `repo:${name}`, package: name, label: `Source code: ${name}`, url: p.repository, provides: 'releases and changelog' });
    }
  }
  return sources;
}

// Tutorials on this blog that use any of the topic's packages, freshest first,
// so learners see what's safe to follow before what's out of date.
async function relatedPosts(packages) {
  const posts = await Post.find({ 'stack.name': { $in: packages } })
    .select('-content')
    .populate('author', 'username')
    .sort({ 'freshness.score': -1, createdAt: -1 })
    .limit(RELATED_POST_LIMIT);
  return posts.sort(
    (a, b) => (STATUS_ORDER[a.freshness?.status] ?? 9) - (STATUS_ORDER[b.freshness?.status] ?? 9)
  );
}

const getTopic = async (req, res) => {
  const topic = await Topic.findOne({ slug: req.params.slug });
  if (!topic) throw new HttpError(404, 'Topic not found');

  // Refresh on read when the snapshot is old. If npm is down this still
  // succeeds: refreshTopic keeps the previous data for packages it can't reach.
  if (isStale(topic)) {
    try {
      await refreshTopic(topic);
    } catch (err) {
      console.error(`[topics] refresh failed for ${topic.slug}:`, err.message);
    }
  }

  const primaryName = topic.packages[0];
  const primary = snapshotFor(topic, primaryName);

  res.json({
    ...summarize(topic),
    packages: topic.packages.map((name) => snapshotFor(topic, name) ?? { name, found: false }),
    alternatives: topic.alternatives.map(({ name, note }) => ({
      note,
      ...(snapshotFor(topic, name) ?? { name, found: false }),
    })),
    primaryName,
    primary,
    category: CATEGORIES.find((c) => c.id === topic.category) ?? null,
    // The summary is either written by an editor or npm's own description.
    summarySource: topic.summary ? 'editor' : primary?.description ? `npm:${primaryName}` : null,
    sources: buildSources(topic),
    posts: await relatedPosts(topic.packages),
    resources: await approvedResources(topic._id),
    myResources: await ownResources(topic._id, req.user?.id),
  });
};

const createTopic = async (req, res) => {
  const { name, category, summary, packages, alternatives, keywords } = req.body;
  const slug = Topic.slugify(name);
  if (!slug) throw new HttpError(400, 'Name needs at least one letter or number');
  if (await Topic.exists({ slug })) throw new HttpError(409, `A topic called "${name}" already exists`);

  const cleanAlternatives = alternatives.filter((a) => !packages.includes(a.name));

  // The primary package anchors the page, so make sure it's real before saving.
  if (!(await getPackageInfo(packages[0]))) {
    throw new HttpError(422, `Couldn't find "${packages[0]}" on npm`);
  }

  const topic = await Topic.create({
    name,
    slug,
    category,
    summary,
    packages,
    alternatives: cleanAlternatives,
    keywords,
    createdBy: req.user.id,
  });
  await refreshTopic(topic);
  res.status(201).json(summarize(topic));
};

const deleteTopic = async (req, res) => {
  const topic = await Topic.findOneAndDelete({ slug: req.params.slug });
  if (!topic) throw new HttpError(404, 'Topic not found');
  await Resource.deleteMany({ topic: topic._id });
  res.json({ message: 'Topic deleted' });
};

module.exports = { listTopics, listCategories, getTopic, createTopic, deleteTopic };
