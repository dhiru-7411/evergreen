const Topic = require('../models/Topic');
const Resource = require('../models/Resource');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { checkResource } = require('../services/resourceChecker');
const { UnsafeUrlError } = require('../services/safeFetch');

const PUBLIC_FIELDS = 'url title kind description checks.version checks.pageTitle submittedBy reviewedBy reviewedAt createdAt status';
const VERSION_ORDER = { current: 0, unknown: 1, outdated: 2 };

// Approved resources for a topic, current ones first.
async function approvedResources(topicId) {
  const items = await Resource.find({ topic: topicId, status: 'approved' })
    .select(PUBLIC_FIELDS)
    .populate('submittedBy reviewedBy', 'username')
    .sort({ reviewedAt: -1 })
    .lean();
  return items.sort(
    (a, b) => (VERSION_ORDER[a.checks?.version?.status] ?? 1) - (VERSION_ORDER[b.checks?.version?.status] ?? 1)
  );
}

// The signed-in user's own pending/rejected suggestions, so they can see
// what happened to them.
async function ownResources(topicId, userId) {
  if (!userId) return [];
  return Resource.find({ topic: topicId, submittedBy: userId, status: { $ne: 'approved' } })
    .select(`${PUBLIC_FIELDS} reviewNote`)
    .sort({ createdAt: -1 })
    .lean();
}

const submitResource = async (req, res) => {
  const topic = await Topic.findOne({ slug: req.params.slug });
  if (!topic) throw new HttpError(404, 'Topic not found');

  const { url, title, kind, description } = req.body;
  const urlKey = Resource.normalizeUrl(url);
  const existing = await Resource.findOne({ topic: topic._id, urlKey }).select('status');
  if (existing) {
    throw new HttpError(409, existing.status === 'rejected' ? 'This link was already reviewed and rejected' : 'This link has already been suggested');
  }

  let checks;
  try {
    const primary = topic.live?.packages?.find((p) => p.name === topic.packages[0]);
    checks = await checkResource(topic, url, primary?.version);
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw new HttpError(400, err.message);
    throw err;
  }

  // Hard gates: these never reach a reviewer.
  if (!checks.reachable) {
    throw new HttpError(422, `We couldn't open that page${checks.httpStatus ? ` (HTTP ${checks.httpStatus})` : ''}. Check the link.`, { checks });
  }
  if (!checks.relevant) {
    throw new HttpError(
      422,
      `That page doesn't seem to be about ${topic.name}. Resources must be about this topic.`,
      { checks }
    );
  }

  const submitter = await User.findById(req.user.id).select('role');
  const isAdmin = submitter?.role === 'admin';

  const resource = await Resource.create({
    topic: topic._id,
    url,
    urlKey,
    title,
    kind,
    description,
    submittedBy: req.user.id,
    checks,
    // Admin suggestions skip the queue; everyone else's are reviewed.
    ...(isAdmin && { status: 'approved', reviewedBy: req.user.id, reviewedAt: new Date() }),
  });

  res.status(201).json({
    _id: resource._id,
    status: resource.status,
    checks: resource.checks,
    message: isAdmin
      ? 'Published.'
      : "Thanks! It passed the automatic checks and is waiting for a reviewer to confirm it's accurate.",
  });
};

// Admin queue: everything pending, plus approved resources readers reported.
const reviewQueue = async (req, res) => {
  const [pending, reported] = await Promise.all([
    Resource.find({ status: 'pending' })
      .populate('submittedBy', 'username')
      .populate('topic', 'name slug')
      .sort({ createdAt: 1 })
      .lean(),
    Resource.find({ status: 'approved', 'reports.0': { $exists: true } })
      .populate('submittedBy reports.user', 'username')
      .populate('topic', 'name slug')
      .sort({ updatedAt: -1 })
      .lean(),
  ]);
  res.json({ pending, reported });
};

async function review(req, res, status) {
  const resource = await Resource.findById(req.params.id);
  if (!resource) throw new HttpError(404, 'Resource not found');
  resource.status = status;
  resource.reviewedBy = req.user.id;
  resource.reviewedAt = new Date();
  resource.reviewNote = req.body.reviewNote;
  // Approving again after reports means the reports were checked.
  if (status === 'approved') resource.reports = [];
  await resource.save();
  res.json({ _id: resource._id, status: resource.status });
}

const approveResource = (req, res) => review(req, res, 'approved');
const rejectResource = (req, res) => review(req, res, 'rejected');

const reportResource = async (req, res) => {
  const resource = await Resource.findOne({ _id: req.params.id, status: 'approved' });
  if (!resource) throw new HttpError(404, 'Resource not found');
  if (resource.reports.some((r) => String(r.user) === String(req.user.id))) {
    throw new HttpError(409, 'You already reported this');
  }
  resource.reports.push({ user: req.user.id, reason: req.body.reason });
  await resource.save();
  res.status(201).json({ message: 'Thanks, a reviewer will take a look.' });
};

module.exports = {
  approvedResources,
  ownResources,
  submitResource,
  reviewQueue,
  approveResource,
  rejectResource,
  reportResource,
};
