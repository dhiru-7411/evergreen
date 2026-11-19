const Topic = require('../models/Topic');
const Post = require('../models/Post');
const HttpError = require('../utils/httpError');
const { getPackageInfo } = require('../services/packageInfo');
const { refreshTopic, isStale } = require('../services/topicService');

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
    posts: await relatedPosts(topic.packages),
  });
};

const createTopic = async (req, res) => {
  const { name, summary, packages, alternatives } = req.body;
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
    summary,
    packages,
    alternatives: cleanAlternatives,
    createdBy: req.user.id,
  });
  await refreshTopic(topic);
  res.status(201).json(summarize(topic));
};

const deleteTopic = async (req, res) => {
  const result = await Topic.deleteOne({ slug: req.params.slug });
  if (result.deletedCount === 0) throw new HttpError(404, 'Topic not found');
  res.json({ message: 'Topic deleted' });
};

module.exports = { listTopics, getTopic, createTopic, deleteTopic };
