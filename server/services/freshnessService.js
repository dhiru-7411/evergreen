const Post = require('../models/Post');
const { getLatestVersions } = require('./npmRegistry');
const { assessPost } = require('./freshness');

const HOUR_MS = 60 * 60 * 1000;

async function refreshPostFreshness(post) {
  const latest = await getLatestVersions(post.stack.map((s) => s.name));
  const freshness = assessPost(post.stack, latest, post.lastRevisedAt);
  await Post.updateOne({ _id: post._id }, { $set: { freshness } });
  post.freshness = freshness;
  return freshness;
}

// Re-checks every post whose report is older than maxAgeMs. All packages across
// all due posts are resolved in one batched pass, so 500 posts that mention
// "react" cost one registry request, not 500.
async function refreshDuePosts({ maxAgeMs = 12 * HOUR_MS } = {}) {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const due = await Post.find({
    'stack.0': { $exists: true },
    $or: [{ 'freshness.checkedAt': { $exists: false } }, { 'freshness.checkedAt': { $lt: cutoff } }],
  })
    .select('stack lastRevisedAt')
    .lean();

  if (due.length === 0) return 0;

  const latest = await getLatestVersions(due.flatMap((p) => p.stack.map((s) => s.name)));
  await Post.bulkWrite(
    due.map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { freshness: assessPost(p.stack, latest, p.lastRevisedAt) } },
      },
    }))
  );
  return due.length;
}

function startFreshnessJob({ intervalHours = Number(process.env.FRESHNESS_INTERVAL_HOURS) || 12 } = {}) {
  const run = async () => {
    try {
      const count = await refreshDuePosts({ maxAgeMs: intervalHours * HOUR_MS });
      if (count) console.log(`[freshness] re-checked ${count} post(s)`);
    } catch (err) {
      console.error('[freshness] job failed:', err.message);
    }
  };
  run();
  const timer = setInterval(run, Math.min(intervalHours * HOUR_MS, HOUR_MS));
  timer.unref();
  return timer;
}

module.exports = { refreshPostFreshness, refreshDuePosts, startFreshnessJob };
