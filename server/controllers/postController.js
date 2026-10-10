const Post = require('../models/Post');
const Revision = require('../models/Revision');
const FixRequest = require('../models/FixRequest');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { commitRevision } = require('../services/revisions');
const { refreshPostFreshness } = require('../services/freshnessService');

const AUTHOR_FIELDS = 'username';

const findPostOr404 = async (id) => {
  const post = await Post.findById(id);
  if (!post) throw new HttpError(404, 'Post not found');
  return post;
};

const assertOwner = (post, userId, action) => {
  if (post.author.toString() !== userId) {
    throw new HttpError(403, `Not authorized to ${action} this post`);
  }
};

const createPost = async (req, res) => {
  const { title, content, stack } = req.body;
  const post = await Post.create({ title, content, stack, author: req.user.id });

  await Revision.create({
    post: post._id,
    number: 1,
    title,
    content,
    stack,
    note: 'First published',
    editor: req.user.id,
  });
  await refreshPostFreshness(post);

  res.status(201).json(post);
};

const getAllPosts = async (req, res) => {
  const { page, limit, status, author } = req.validQuery;
  const filter = {};
  if (status) filter['freshness.status'] = status;
  if (author) filter.author = author;

  const [items, total] = await Promise.all([
    Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-content')
      .populate('author', AUTHOR_FIELDS),
    Post.countDocuments(filter),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
};

// Health of the whole blog: how many posts can readers still trust?
const getStats = async (req, res) => {
  const rows = await Post.aggregate([{ $group: { _id: '$freshness.status', count: { $sum: 1 } } }]);
  const stats = { total: 0, fresh: 0, aging: 0, stale: 0, untracked: 0 };
  for (const { _id, count } of rows) {
    stats[_id ?? 'untracked'] += count;
    stats.total += count;
  }
  const [openFixes, mergedFixes] = await Promise.all([
    FixRequest.countDocuments({ status: 'open' }),
    FixRequest.countDocuments({ status: 'merged' }),
  ]);
  res.json({ ...stats, openFixes, mergedFixes });
};

const getPostById = async (req, res) => {
  const post = await Post.findById(req.params.id).populate('author', AUTHOR_FIELDS);
  if (!post) throw new HttpError(404, 'Post not found');

  // Contributors = anyone other than the author who has a revision credited to them.
  const [editorIds, openFixCount] = await Promise.all([
    Revision.distinct('editor', { post: post._id, editor: { $ne: post.author._id } }),
    FixRequest.countDocuments({ post: post._id, status: 'open' }),
  ]);
  const contributors = await User.find({ _id: { $in: editorIds } }).select(AUTHOR_FIELDS);

  res.json({ ...post.toJSON(), contributors, openFixCount });
};

const updatePost = async (req, res) => {
  const post = await findPostOr404(req.params.id);
  assertOwner(post, req.user.id, 'edit');

  // Only whitelisted fields reach the database. Passing req.body straight
  // through would let a client rewrite `author`, `revision` or `freshness`.
  const { title, content, stack, note, baseRevision } = req.body;
  const changes = Object.fromEntries(
    Object.entries({ title, content, stack }).filter(([, v]) => v !== undefined)
  );

  const updated = await commitRevision({
    postId: post._id,
    baseRevision,
    changes,
    note,
    editor: req.user.id,
  });
  res.json(updated);
};

const deletePost = async (req, res) => {
  const post = await findPostOr404(req.params.id);
  assertOwner(post, req.user.id, 'delete');

  await Promise.all([
    post.deleteOne(),
    Revision.deleteMany({ post: post._id }),
    FixRequest.deleteMany({ post: post._id }),
  ]);
  res.json({ message: 'Post deleted' });
};

const recheckFreshness = async (req, res) => {
  const post = await findPostOr404(req.params.id);
  const freshness = await refreshPostFreshness(post);
  res.json(freshness);
};

const listRevisions = async (req, res) => {
  await findPostOr404(req.params.id);
  const revisions = await Revision.find({ post: req.params.id })
    .sort({ number: -1 })
    .select('-content')
    .populate('editor', AUTHOR_FIELDS);
  res.json(revisions);
};

const getRevision = async (req, res) => {
  const number = Number(req.params.number);
  if (!Number.isInteger(number) || number < 1) throw new HttpError(400, 'Invalid revision number');

  const revision = await Revision.findOne({ post: req.params.id, number }).populate('editor', AUTHOR_FIELDS);
  if (!revision) throw new HttpError(404, 'Revision not found');
  res.json(revision);
};

module.exports = {
  createPost,
  getAllPosts,
  getStats,
  getPostById,
  updatePost,
  deletePost,
  recheckFreshness,
  listRevisions,
  getRevision,
};
