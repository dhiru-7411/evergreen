const mongoose = require('mongoose');
const Topic = require('../models/Topic');
const TopicRequest = require('../models/TopicRequest');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { getPackageInfo } = require('../services/packageInfo');

const MAX_OPEN_PER_USER = 5;
const ACTIVE = ['open', 'planned'];

const present = (r, userId) => ({
  _id: r._id,
  name: r.name,
  category: r.category,
  packageName: r.packageName,
  description: r.description,
  requestedBy: r.requestedBy,
  voteCount: r.voteCount,
  voted: Boolean(userId) && r.voters.some((v) => String(v) === String(userId)),
  status: r.status,
  adminNote: r.adminNote,
  topic: r.topic,
  createdAt: r.createdAt,
});

const list = async (req, res) => {
  const { status } = req.validQuery;
  const filter = status ? { status } : { status: { $in: ACTIVE } };
  const items = await TopicRequest.find(filter)
    .sort({ voteCount: -1, createdAt: 1 })
    .limit(100)
    .populate('requestedBy', 'username')
    .populate('topic', 'name slug')
    .lean();
  res.json(items.map((r) => present(r, req.user?.id)));
};

const create = async (req, res) => {
  const { name, category, packageName, description } = req.body;
  const nameKey = Topic.slugify(name);
  if (!nameKey) throw new HttpError(400, 'Name needs at least one letter or number');

  // Already covered? Point people at the existing page instead.
  const existingTopic = await Topic.findOne({
    $or: [{ slug: nameKey }, ...(packageName ? [{ packages: packageName }] : [])],
  }).select('name slug');
  if (existingTopic) {
    throw new HttpError(409, `Evergreen already covers ${existingTopic.name}`, { topic: existingTopic });
  }
  const existingRequest = await TopicRequest.findOne({
    status: { $in: ACTIVE },
    $or: [{ nameKey }, ...(packageName ? [{ packageName }] : [])],
  }).select('name');
  if (existingRequest) {
    throw new HttpError(409, `"${existingRequest.name}" has already been requested. Upvote it instead.`, {
      request: { _id: existingRequest._id, name: existingRequest.name },
    });
  }

  const open = await TopicRequest.countDocuments({ requestedBy: req.user.id, status: 'open' });
  if (open >= MAX_OPEN_PER_USER) {
    throw new HttpError(429, `You can have up to ${MAX_OPEN_PER_USER} open requests at a time`);
  }

  if (packageName && !(await getPackageInfo(packageName))) {
    throw new HttpError(422, `Couldn't find "${packageName}" on npm. Leave it blank if you're not sure.`);
  }

  const request = await TopicRequest.create({
    name,
    nameKey,
    category,
    packageName: packageName || null,
    description,
    requestedBy: req.user.id,
    // Requesting counts as the first vote.
    voters: [req.user.id],
    voteCount: 1,
  });
  await request.populate('requestedBy', 'username');
  res.status(201).json(present(request, req.user.id));
};

// Toggles the current user's vote, atomically so double-clicks can't double-count.
const vote = async (req, res) => {
  const userId = new mongoose.Types.ObjectId(String(req.user.id));
  const base = { _id: req.params.id, status: { $in: ACTIVE } };
  let updated = await TopicRequest.findOneAndUpdate(
    { ...base, voters: { $ne: userId } },
    { $push: { voters: userId }, $inc: { voteCount: 1 } },
    { new: true }
  );
  if (!updated) {
    updated = await TopicRequest.findOneAndUpdate(
      { ...base, voters: userId },
      { $pull: { voters: userId }, $inc: { voteCount: -1 } },
      { new: true }
    );
  }
  if (!updated) throw new HttpError(404, 'Request not found or no longer open for votes');
  res.json({ _id: updated._id, voteCount: updated.voteCount, voted: updated.voters.some((v) => v.equals(userId)) });
};

const update = async (req, res) => {
  const { status, adminNote, topicSlug } = req.body;
  const request = await TopicRequest.findById(req.params.id);
  if (!request) throw new HttpError(404, 'Request not found');
  if (topicSlug) {
    const topic = await Topic.findOne({ slug: topicSlug }).select('_id');
    if (!topic) throw new HttpError(404, `No topic "${topicSlug}"`);
    request.topic = topic._id;
  }
  if (status) request.status = status;
  if (adminNote !== undefined) request.adminNote = adminNote;
  await request.save();
  await request.populate('requestedBy', 'username');
  await request.populate('topic', 'name slug');
  res.json(present(request, req.user.id));
};

// Called when an admin creates a topic: matching requests become "done".
async function closeRequestsFor(topic) {
  await TopicRequest.updateMany(
    {
      status: { $in: ACTIVE },
      $or: [{ nameKey: topic.slug }, { packageName: { $in: topic.packages } }],
    },
    { status: 'done', topic: topic._id }
  );
}

// Requests a user made, for their profile and the "my requests" view.
const mine = async (req, res) => {
  const user = await User.findById(req.user.id).select('_id');
  if (!user) throw new HttpError(401, 'Account no longer exists');
  const items = await TopicRequest.find({ requestedBy: user._id })
    .sort({ createdAt: -1 })
    .populate('requestedBy', 'username')
    .populate('topic', 'name slug')
    .lean();
  res.json(items.map((r) => present(r, req.user.id)));
};

module.exports = { list, create, vote, update, mine, closeRequestsFor, MAX_OPEN_PER_USER };
