// Live facts about npm packages for topic pages: latest version, when it was
// published, weekly downloads, deprecation notice and links.
//
// Three public npm endpoints are combined:
//   registry.npmjs.org/<name>/latest        version, description, links, deprecated
//   api.npmjs.org/downloads/point/last-week weekly downloads
//   api.deps.dev (Google's Open Source Insights) publish date and known
//                                           security advisories for that version
// (npm's own search API also has publish dates but rate-limits aggressively.)
// Every lookup is cached, and any single endpoint failing only blanks that
// field, so one flaky API never takes a topic page down.

const REGISTRY_URL = process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';
const DOWNLOADS_URL = process.env.NPM_DOWNLOADS_URL || 'https://api.npmjs.org';
const DEPS_DEV_URL = process.env.DEPS_DEV_URL || 'https://api.deps.dev';
const TTL_MS = 6 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 1000;
const PARTIAL_TTL_MS = 10 * 60 * 1000; // retry sooner when a side lookup failed
const CONCURRENCY = 6;

const cache = new Map(); // name -> { info, expires }
let fetchImpl = (...args) => fetch(...args);

const encode = (name) => name.replace('/', '%2F');

async function getJson(url) {
  try {
    const res = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const cleanRepoUrl = (repo) => {
  const url = typeof repo === 'string' ? repo : repo?.url;
  if (!url) return null;
  const cleaned = url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/\.git$/, '');
  if (/^github:/.test(cleaned)) return `https://github.com/${cleaned.slice(7)}`;
  return /^https?:\/\//.test(cleaned) ? cleaned : null;
};

const depsDevUrl = (name, version) =>
  `${DEPS_DEV_URL}/v3/systems/npm/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`;

async function fetchPackageInfo(name) {
  const [latest, downloads] = await Promise.all([
    getJson(`${REGISTRY_URL}/${encode(name)}/latest`),
    getJson(`${DOWNLOADS_URL}/downloads/point/last-week/${name}`),
  ]);
  if (!latest?.version) return null;

  const insights = await getJson(depsDevUrl(name, latest.version));
  const publishedAt = insights?.publishedAt ? new Date(insights.publishedAt) : null;
  const advisoryCount = Array.isArray(insights?.advisoryKeys) ? insights.advisoryKeys.length : null;

  return {
    name,
    version: latest.version,
    description: latest.description ?? null,
    publishedAt,
    weeklyDownloads: typeof downloads?.downloads === 'number' ? downloads.downloads : null,
    advisoryCount,
    deprecated: typeof latest.deprecated === 'string' && latest.deprecated ? latest.deprecated : null,
    license: typeof latest.license === 'string' ? latest.license : null,
    homepage: typeof latest.homepage === 'string' ? latest.homepage : null,
    repository: cleanRepoUrl(latest.repository),
    npmUrl: `https://www.npmjs.com/package/${name}`,
  };
}

// Returns the package's info, or null if npm doesn't know it (or is unreachable).
async function getPackageInfo(name) {
  const hit = cache.get(name);
  if (hit && hit.expires > Date.now()) return hit.info;
  const info = await fetchPackageInfo(name);
  const partial = info && (info.publishedAt == null || info.weeklyDownloads == null);
  const ttl = !info ? MISS_TTL_MS : partial ? PARTIAL_TTL_MS : TTL_MS;
  cache.set(name, { info, expires: Date.now() + ttl });
  return info;
}

// Resolves many packages with bounded concurrency. Returns Map<name, info|null>.
async function getPackageInfos(names) {
  const unique = [...new Set(names)];
  const results = new Map();
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const infos = await Promise.all(batch.map(getPackageInfo));
    batch.forEach((name, idx) => results.set(name, infos[idx]));
  }
  return results;
}

// Test hooks.
const setFetch = (fn) => {
  fetchImpl = fn;
};
const clearCache = () => cache.clear();

module.exports = { getPackageInfo, getPackageInfos, setFetch, clearCache, cleanRepoUrl };
