const Post = require('../models/Post');
const Revision = require('../models/Revision');
const FixRequest = require('../models/FixRequest');
const HttpError = require('../utils/httpError');
const { commitRevision } = require('../services/revisions');

const proposeFix = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw new HttpError(404, 'Post not found');
  if (post.author.toString() === req.user.id) {
    throw new HttpError(400, "You're the author: edit the post directly instead");
  }

  const { title, content, stack, note, baseRevision } = req.body;
  if (baseRevision > post.revision) throw new HttpError(400, 'Unknown base revision');

  const fix = await FixRequest.create({
    post: post._id,
    postAuthor: post.author,
    proposer: req.user.id,
    baseRevision,
    title,
    content,
    stack,
    note,
  });
  res.status(201).json(fix);
};

const listFixesForPost = async (req, res) => {
  const filter = { post: req.params.id };
  if (req.validQuery.status) filter.status = req.validQuery.status;
  const fixes = await FixRequest.find(filter)
    .sort({ createdAt: -1 })
    .select('-content')
    .populate('proposer', 'username');
  res.json(fixes);
};

// Open fixes waiting on the current user's review.
const inbox = async (req, res) => {
  const fixes = await FixRequest.find({ postAuthor: req.user.id, status: 'open' })
    .sort({ createdAt: -1 })
    .select('-content')
    .populate('proposer', 'username')
    .populate('post', 'title revision slug');
  res.json(fixes);
};

const mine = async (req, res) => {
  const fixes = await FixRequest.find({ proposer: req.user.id })
    .sort({ createdAt: -1 })
    .select('-content')
    .populate('post', 'title revision slug');
  res.json(fixes);
};

// Everything the review screen needs: the proposal, the revision it was based
// on (to diff against) and whether the post has moved on since.
const getFix = async (req, res) => {
  const fix = await FixRequest.findById(req.params.fixId)
    .populate('proposer', 'username')
    .populate({ path: 'post', select: 'title revision author', populate: { path: 'author', select: 'username' } });
  if (!fix) throw new HttpError(404, 'Fix request not found');
  if (!fix.post) throw new HttpError(404, 'The post for this fix was deleted');

  const base = await Revision.findOne({ post: fix.post._id, number: fix.baseRevision }).select(
    'number title content stack'
  );

  res.json({
    ...fix.toJSON(),
    base,
    outdated: fix.status === 'open' && fix.post.revision !== fix.baseRevision,
    canReview: Boolean(req.user && fix.postAuthor.toString() === req.user.id && fix.status === 'open'),
  });
};

const loadReviewableFix = async (fixId, userId) => {
  const fix = await FixRequest.findById(fixId);
  if (!fix) throw new HttpError(404, 'Fix request not found');
  if (fix.postAuthor.toString() !== userId) throw new HttpError(403, 'Only the post author can review fixes');
  if (fix.status !== 'open') throw new HttpError(409, `This fix was already ${fix.status}`);
  return fix;
};

const mergeFix = async (req, res) => {
  const fix = await loadReviewableFix(req.params.fixId, req.user.id);
  const { force, reviewNote } = req.body;

  // Claim the fix atomically so a double-click can't merge it twice.
  const claimed = await FixRequest.findOneAndUpdate(
    { _id: fix._id, status: 'open' },
    { $set: { status: 'merged', reviewNote, reviewedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!claimed) throw new HttpError(409, 'This fix was already reviewed');

  try {
    const post = await commitRevision({
      postId: fix.post,
      baseRevision: fix.baseRevision,
      changes: { title: fix.title, content: fix.content, stack: fix.stack },
      note: fix.note,
      editor: fix.proposer, // the contributor gets the credit
      fixRequest: fix._id,
      force,
    });
    claimed.mergedRevision = post.revision;
    await claimed.save();
    res.json({ fix: claimed, post });
  } catch (err) {
    await FixRequest.updateOne(
      { _id: fix._id },
      { $set: { status: 'open' }, $unset: { reviewNote: 1, reviewedAt: 1 } }
    );
    throw err;
  }
};

const rejectFix = async (req, res) => {
  const fix = await loadReviewableFix(req.params.fixId, req.user.id);
  const updated = await FixRequest.findOneAndUpdate(
    { _id: fix._id, status: 'open' },
    { $set: { status: 'rejected', reviewNote: req.body.reviewNote, reviewedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!updated) throw new HttpError(409, 'This fix was already reviewed');
  res.json(updated);
};

module.exports = { proposeFix, listFixesForPost, inbox, mine, getFix, mergeFix, rejectFix };
