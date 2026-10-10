// Pure scoring logic: given what a post declares and what's currently published,
// how trustworthy is it? No I/O here, so it's trivially unit-testable.
const semver = require('semver');

const PACKAGE_SCORES = [100, 60, 20, 0]; // by breaking releases behind: 0, 1, 2, 3+
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// "Breaking releases behind": majors for >=1.0, minors for 0.x (where semver
// treats a minor bump as breaking).
function breakingBehind(declared, latest) {
  if (latest.major > declared.major) return latest.major - declared.major;
  if (latest.major === 0 && declared.major === 0) return Math.max(0, latest.minor - declared.minor);
  return 0;
}

function assessPackage({ name, version }, latestVersion) {
  const declared = semver.coerce(version);
  const latest = latestVersion ? semver.coerce(latestVersion) : null;
  if (!declared || !latest) {
    return { name, declared: version, latest: latestVersion ?? null, behind: null, status: 'unknown' };
  }
  const behind = breakingBehind(declared, latest);
  const status = behind === 0 ? 'fresh' : behind === 1 ? 'aging' : 'stale';
  return { name, declared: version, latest: latestVersion, behind, status };
}

function agePenalty(lastRevisedAt, now) {
  const months = (now - new Date(lastRevisedAt).getTime()) / MONTH_MS;
  if (months > 24) return 20;
  if (months > 12) return 10;
  return 0;
}

/**
 * @param {Array<{name, version}>} stack        packages the post depends on
 * @param {Map<string, string|null>} latest      latest published version per package
 * @param {Date} lastRevisedAt                   when the content last changed
 * @returns {{status, score, checkedAt, packages}}
 */
function assessPost(stack, latest, lastRevisedAt, now = Date.now()) {
  const packages = stack.map((item) => assessPackage(item, latest.get(item.name)));
  const known = packages.filter((p) => p.status !== 'unknown');

  if (known.length === 0) {
    return { status: 'untracked', score: null, checkedAt: new Date(now), packages };
  }

  // A tutorial is only as current as its most outdated dependency.
  const worst = Math.min(...known.map((p) => PACKAGE_SCORES[Math.min(p.behind, 3)]));
  const score = Math.max(0, worst - agePenalty(lastRevisedAt, now));
  const status = score >= 80 ? 'fresh' : score >= 50 ? 'aging' : 'stale';

  return { status, score, checkedAt: new Date(now), packages };
}

module.exports = { assessPost, assessPackage, breakingBehind };
