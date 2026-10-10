// Looks up the latest published version of npm packages.
// Results are cached in memory so the freshness job makes one request per
// package per TTL, no matter how many posts mention it.

const REGISTRY_URL = process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';
const TTL_MS = 6 * 60 * 60 * 1000;
const CONCURRENCY = 8;

const cache = new Map(); // name -> { version, expires }
let fetchImpl = (...args) => fetch(...args);

const packageUrl = (name) => `${REGISTRY_URL}/${name.replace('/', '%2F')}/latest`;

async function getLatestVersion(name) {
  const hit = cache.get(name);
  if (hit && hit.expires > Date.now()) return hit.version;

  let version = null;
  try {
    const res = await fetchImpl(packageUrl(name), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) version = (await res.json()).version ?? null;
  } catch {
    // Network failure or timeout: report unknown rather than failing the whole check.
  }

  // Cache misses briefly so a flaky registry doesn't get hammered.
  cache.set(name, { version, expires: Date.now() + (version ? TTL_MS : 60 * 1000) });
  return version;
}

// Resolves many packages with bounded concurrency. Returns Map<name, version|null>.
async function getLatestVersions(names) {
  const unique = [...new Set(names)];
  const results = new Map();
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const versions = await Promise.all(batch.map(getLatestVersion));
    batch.forEach((name, idx) => results.set(name, versions[idx]));
  }
  return results;
}

// Test hooks.
const setFetch = (fn) => {
  fetchImpl = fn;
};
const clearCache = () => cache.clear();

module.exports = { getLatestVersion, getLatestVersions, setFetch, clearCache };
