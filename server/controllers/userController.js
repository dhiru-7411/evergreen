const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const FixRequest = require('../models/FixRequest');
const HttpError = require('../utils/httpError');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Public profile: who they are, how trustworthy their posts are, and how much
// they've helped keep other people's posts current. Never exposes email.
const getProfile = async (req, res) => {
  const user = await User.findOne({
    username: new RegExp(`^${escapeRegex(req.params.username)}$`, 'i'),
  }).select('username createdAt');
  if (!user) throw new HttpError(404, 'User not found');

  const id = new mongoose.Types.ObjectId(String(user._id));
  const [byStatus, [scores], mergedFixes, openFixes] = await Promise.all([
    Post.aggregate([{ $match: { author: id } }, { $group: { _id: '$freshness.status', count: { $sum: 1 } } }]),
    Post.aggregate([
      { $match: { author: id, 'freshness.score': { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$freshness.score' } } },
    ]),
    FixRequest.countDocuments({ proposer: id, status: 'merged' }),
    FixRequest.countDocuments({ proposer: id, status: 'open' }),
  ]);

  const posts = { total: 0, fresh: 0, aging: 0, stale: 0, untracked: 0 };
  for (const { _id, count } of byStatus) {
    posts[_id ?? 'untracked'] += count;
    posts.total += count;
  }

  res.json({
    user: { id: user._id, username: user.username, joinedAt: user.createdAt },
    posts,
    averageScore: scores ? Math.round(scores.avg) : null,
    fixes: { merged: mergedFixes, open: openFixes },
  });
};

module.exports = { getProfile };
