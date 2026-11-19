const Topic = require('../models/Topic');
const { getPackageInfos } = require('./packageInfo');

const HOUR_MS = 60 * 60 * 1000;
const STALE_AFTER_MS = 6 * HOUR_MS;

// Builds a new live snapshot. When npm can't be reached for a package we keep
// that package's previous snapshot (with its old checkedAt) instead of wiping
// it, so a registry outage shows slightly old data rather than none.
function buildSnapshot(names, infos, previous = [], now = new Date()) {
  const prev = new Map(previous.map((p) => [p.name, p]));
  return names.map((name) => {
    const info = infos.get(name);
    const old = prev.get(name);
    if (info) {
      // A side lookup (downloads, publish date) can fail on its own; reuse the
      // last known value as long as it describes the same version.
      const sameVersion = old?.found && old.version === info.version;
      return {
        ...info,
        publishedAt: info.publishedAt ?? (sameVersion ? old.publishedAt : null),
        weeklyDownloads: info.weeklyDownloads ?? (old?.found ? old.weeklyDownloads : null),
        found: true,
        checkedAt: now,
      };
    }
    if (old?.found) return typeof old.toObject === 'function' ? old.toObject() : old;
    return { name, found: false, checkedAt: now };
  });
}

async function refreshTopic(topic) {
  const names = topic.allPackageNames();
  const infos = await getPackageInfos(names);
  const now = new Date();
  const live = { checkedAt: now, packages: buildSnapshot(names, infos, topic.live?.packages, now) };
  await Topic.updateOne({ _id: topic._id }, { $set: { live } });
  topic.live = live;
  return topic;
}

const isStale = (topic, maxAgeMs = STALE_AFTER_MS) =>
  !topic.live?.checkedAt || Date.now() - new Date(topic.live.checkedAt).getTime() > maxAgeMs;

// Refreshes topics whose snapshot is older than maxAgeMs. Package lookups are
// cached, so topics sharing packages (react, vue…) share requests.
async function refreshDueTopics({ maxAgeMs = STALE_AFTER_MS } = {}) {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const due = await Topic.find({
    $or: [{ 'live.checkedAt': { $exists: false } }, { 'live.checkedAt': { $lt: cutoff } }],
  });
  for (const topic of due) await refreshTopic(topic);
  return due.length;
}

module.exports = { refreshTopic, refreshDueTopics, isStale, buildSnapshot, STALE_AFTER_MS };
