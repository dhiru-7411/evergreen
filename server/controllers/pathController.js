const semver = require('semver');
const Topic = require('../models/Topic');
const LearningPath = require('../models/LearningPath');
const HttpError = require('../utils/httpError');
const claude = require('../services/claude');
const { startGeneration } = require('../services/learningPathService');

const GENERATING_TIMEOUT_MS = 15 * 60 * 1000;

// A path stuck in "generating" (e.g. the server restarted mid-draft) is
// reported as failed rather than spinning forever.
function present(path) {
  const obj = typeof path.toObject === 'function' ? path.toObject() : path;
  if (obj.status === 'generating' && Date.now() - new Date(obj.createdAt).getTime() > GENERATING_TIMEOUT_MS) {
    return { ...obj, status: 'failed', error: 'Generation was interrupted. Try again.' };
  }
  return obj;
}

// What learners see: the published path with only verified sources, plus
// whether a newer major version has come out since it was written.
async function publicPath(topic) {
  const path = await LearningPath.findOne({ topic: topic._id, status: 'published' })
    .sort({ reviewedAt: -1 })
    .populate('reviewedBy', 'username')
    .lean();
  if (!path) return null;
  const current = topic.live?.packages?.find((p) => p.name === topic.packages[0])?.version;
  const currentMajor = semver.coerce(current)?.major;
  return {
    _id: path._id,
    intro: path.intro,
    assumedKnowledge: path.assumedKnowledge,
    basedOnVersion: path.basedOnVersion,
    outdated: currentMajor != null && path.basedOnMajor != null && currentMajor > path.basedOnMajor,
    currentVersion: current ?? null,
    reviewedBy: path.reviewedBy,
    reviewedAt: path.reviewedAt,
    generatedWith: path.generation?.servedBy || path.generation?.model,
    steps: path.steps.map((s) => ({ ...s, sources: s.sources.filter((src) => src.verified) })),
  };
}

const findTopic = async (slug) => {
  const topic = await Topic.findOne({ slug });
  if (!topic) throw new HttpError(404, 'Topic not found');
  return topic;
};

const generate = async (req, res) => {
  if (!claude.aiEnabled()) throw new HttpError(503, 'AI features are not configured on this server');
  const topic = await findTopic(req.params.slug);
  const { path, alreadyRunning } = await startGeneration(topic, req.user.id);
  res.status(alreadyRunning ? 200 : 202).json({ path: present(path), alreadyRunning });
};

// Admin view: every draft and version for a topic, newest first.
const listForTopic = async (req, res) => {
  const topic = await findTopic(req.params.slug);
  const paths = await LearningPath.find({ topic: topic._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('requestedBy reviewedBy', 'username')
    .lean();
  res.json({ aiEnabled: claude.aiEnabled(), paths: paths.map(present) });
};

async function review(req, res, status) {
  const path = await LearningPath.findById(req.params.id);
  if (!path) throw new HttpError(404, 'Learning path not found');
  if (path.status !== 'draft') throw new HttpError(409, `Only drafts can be reviewed (this one is ${path.status})`);
  if (status === 'published') {
    // One published path per topic: the previous one becomes history.
    await LearningPath.updateMany({ topic: path.topic, status: 'published' }, { status: 'archived' });
  }
  path.status = status;
  path.reviewedBy = req.user.id;
  path.reviewedAt = new Date();
  path.reviewNote = req.body.reviewNote;
  await path.save();
  res.json(present(path));
}

const publish = (req, res) => review(req, res, 'published');
const reject = (req, res) => review(req, res, 'rejected');

module.exports = { publicPath, generate, listForTopic, publish, reject };
